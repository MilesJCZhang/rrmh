/**
 * routes_user.js - 用户信息路由
 *
 * 端点：
 *   GET  /v1/user/profile        获取当前用户档案
 *   PUT  /v1/user/profile/update 更新用户档案（保存后自动触发评分重算）
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');
const scoreEngine = require('./utils/scoreEngine');
const logger = require('./utils/logger');
const { calculateUserRoles } = require('./utils/roleUtils');

const router = express.Router();

function getDb(req) {
  return req.app.get('db');
}

// ========== GET /v1/user/profile ==========
router.get('/profile', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // 获取评分（容错处理，评分失败不影响基本资料返回）
    let scoreData = null;
    try {
      if (scoreEngine && typeof scoreEngine.getUserScore === 'function') {
        scoreData = scoreEngine.getUserScore(db, userId);
      }
    } catch (scoreErr) {
      logger.warn('[user] 获取评分失败，继续使用默认评分:', scoreErr.message);
    }

    // 计算用户的角色列表
    const roleList = calculateUserRoles(db, user);

    // 构建返回数据（排除敏感字段）
    const profile = {
      id: user.id,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      gender: user.gender || '',
      age: user.age || null,
      city: user.city || '',
      phone: user.phone || '',
      wechatAccount: user.wechatAccount || user.wechat_account || '',
      education: user.education || '',
      maritalStatus: user.maritalStatus || user.marital_status || '',
      intro: user.intro || '',
      occupation: user.occupation || '',
      income: user.income || '',
      hasProperty: user.hasProperty || user.has_property || false,
      hasCar: user.hasCar || user.has_car || false,
      healthTags: user.healthTags || user.health_tags || '',
      sleepHabit: user.sleepHabit || user.sleep_habit || '',
      sportHabit: user.sportHabit || user.sport_habit || '',
      dietTags: user.dietTags || user.diet_tags || '',
      smoking: user.smoking || '',
      drinking: user.drinking || '',
      expectAgeMin: user.expectAgeMin || user.expect_age_min || '',
      expectAgeMax: user.expectAgeMax || user.expect_age_max || '',
      expectEducation: user.expectEducation || user.expect_education || '',
      expectIncome: user.expectIncome || user.expect_income || '',
      marriageExpect: user.marriageExpect || user.marriage_expect || '',
      // 认证相关
      faceAuthStatus: user.face_auth_status || 'none',
      idCardFrontImage: user.id_card_front_image || '',
      idCardBackImage: user.id_card_back_image || '',
      // 资产相关
      propertyImages: user.property_images || '[]',
      vehicleImages: user.vehicle_images || '[]',
      bankDepositProof: user.bank_deposit_proof || '',
      insuranceProof: user.insurance_proof || '',
      financeProof: user.finance_proof || '',
      assetVerifiedStatus: user.asset_verified_status || 'none',
      // 评分（容错）
      profileScore: user.profile_score || (scoreData && scoreData.total_score) || 0,
      scoreTier: user.score_tier || (scoreData && scoreData.score_tier) || 'unrated',
      // 角色信息
      role: user.role || 'user',
      roleList: roleList,
    };

    res.json({ code: 0, data: profile });

  } catch (err) {
    logger.error('[user] profile error:', err);
    res.status(500).json({ code: -1, message: '获取用户信息失败' });
  }
});

// ========== PUT /v1/user/profile/update ==========
// 更新用户档案，保存后自动触发评分重算
router.put('/profile/update', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;
    const data = req.body;

    // 允许更新的字段白名单（防止注入）
    const ALLOWED_FIELDS = [
      'nickname', 'avatar', 'gender', 'age', 'city', 'phone',
      'wechatAccount', 'wechat_account', 'education', 'maritalStatus', 'marital_status',
      'intro',
      'occupation', 'income', 'hasProperty', 'has_property', 'hasCar', 'has_car',
      'healthTags', 'health_tags', 'sleepHabit', 'sleep_habit',
      'sportHabit', 'sport_habit', 'dietTags', 'diet_tags',
      'smoking', 'drinking',
      'expectAgeMin', 'expect_age_min', 'expectAgeMax', 'expect_age_max',
      'expectEducation', 'expect_education', 'expectIncome', 'expect_income',
      'marriageExpect', 'marriage_expect',
      // 认证
      'face_auth_status', 'face_auth_image',
      'id_card_front_image', 'id_card_back_image',
      // 资产
      'property_images', 'vehicle_images',
      'bank_deposit_proof', 'insurance_proof', 'finance_proof',
    ];

    // 构建动态 UPDATE 语句
    const updates = [];
    const values = [];
    for (const field of ALLOWED_FIELDS) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ code: -1, message: '没有需要更新的字段' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    // 自动触发评分重算
    const scoreResult = scoreEngine.recalculateAndSave(db, userId);

    logger.info(`[user] 用户${userId}更新资料，评分: ${scoreResult.totalScore}(${scoreResult.tier})`);

    res.json({
      code: 0,
      message: '更新成功',
      data: {
        profileScore: scoreResult.totalScore,
        scoreTier: scoreResult.tier,
        tierLabel: scoreEngine.getTierLabel(scoreResult.tier),
      },
    });

  } catch (err) {
    logger.error('[user] profile update error:', err);
    res.status(500).json({ code: -1, message: '更新失败' });
  }
});

module.exports = router;
