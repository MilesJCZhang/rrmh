/**
 * routes_match.js - 匹配推荐路由（含评分分层过滤）
 *
 * GET /v1/match/recommend  - 推荐匹配列表（按tier分层过滤）
 * GET /v1/match/tier-access - 获取当前用户tier访问权限
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth-middleware');
const { canViewTier, getTierAccessInfo } = require('../../utils/pricing');

/**
 * GET /v1/match/recommend
 * 推荐匹配列表，按评分分层过滤
 *
 * Query params:
 *  - distance: nearby/same_city/same_province/nationwide
 *  - page: 页码 (default 1)
 *  - pageSize: 每页条数 (default 10)
 *  - tier_filter: 只看某个tier (可选)
 */
router.get('/recommend', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.userId;
    const { distance = 'same_city', page = 1, pageSize = 10, tier_filter } = req.query;
    const offset = (page - 1) * pageSize;

    // 获取当前用户tier
    const user = db.prepare('SELECT id, gender, score_tier, profile_score, city, province FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    const viewerTier = user.score_tier || 'unrated';
    const viewerGender = user.gender;

    // 根据tier确定可见的对方tier列表
    let visibleTiers = canViewTier(viewerTier) ? getTierAccessInfo(viewerTier).visibleTiers : [];
    if (tier_filter && visibleTiers.includes(tier_filter)) {
      visibleTiers = [tier_filter];
    }

    if (visibleTiers.length === 0) {
      return res.json({
        code: 0,
        data: { list: [], total: 0, page: Number(page), pageSize: Number(pageSize), viewerTier },
      });
    }

    // 构建查询条件
    const params = [];
    const conditions = ['u.id != ?', 'u.profile_score > 0'];

    params.push(userId);

    // 性别筛选：推荐异性
    if (viewerGender === 'male') {
      conditions.push("u.gender = 'female'");
    } else if (viewerGender === 'female') {
      conditions.push("u.gender = 'male'");
    }

    // tier筛选
    const tierPlaceholders = visibleTiers.map(() => '?').join(',');
    conditions.push(`u.score_tier IN (${tierPlaceholders})`);
    params.push(...visibleTiers);

    // 距离筛选
    if (distance === 'same_city' && user.city) {
      conditions.push('u.city = ?');
      params.push(user.city);
    } else if (distance === 'same_province' && user.province) {
      conditions.push('u.province = ?');
      params.push(user.province);
    }
    // nearby/nationwide 不额外筛选

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM users u WHERE ${conditions.join(' AND ')}`;
    const { total } = db.prepare(countSql).get(...params);

    // 查询列表
    const listSql = `
      SELECT u.id, u.nickname, u.avatar, u.gender, u.birth_year, u.city,
             u.occupation, u.income, u.intro, u.profile_score, u.score_tier,
             u.education, u.marital_status,
             CASE WHEN u.birth_year IS NOT NULL THEN (strftime('%Y','now') - u.birth_year) ELSE NULL END as age
      FROM users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.profile_score DESC, u.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(Number(pageSize), offset);
    const list = db.prepare(listSql).all(...params);

    // 为每条记录添加解锁状态
    const listWithUnlock = list.map(item => {
      // 查是否已解锁
      const unlock = db.prepare(
        'SELECT id, unlock_type FROM unlock_records WHERE user_id = ? AND target_user_id = ? AND status = \'active\''
      ).get(userId, item.id);

      // 查是否已有推荐码关系
      const referral = db.prepare(
        'SELECT id FROM user_referrals WHERE referrer_id = ? AND referred_id = ?'
      ).get(userId, item.id);

      return {
        ...item,
        isUnlocked: !!unlock,
        unlockType: unlock?.unlock_type || null,
        isMyReferral: !!referral,
        // 根据target的tier决定线上解锁价格
        onlinePrice: item.score_tier === 'gold' ? 199 : item.score_tier === 'silver' ? 299 : 0,
        canOnlineUnlock: item.score_tier === 'gold' || item.score_tier === 'silver',
      };
    });

    res.json({
      code: 0,
      data: {
        list: listWithUnlock,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        viewerTier,
      },
    });
  } catch (err) {
    console.error('[match] recommend error:', err);
    res.status(500).json({ code: -1, message: '推荐加载失败' });
  }
});

/**
 * GET /v1/match/tier-access
 * 获取当前用户tier访问权限说明
 */
router.get('/tier-access', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.userId;

    const user = db.prepare('SELECT id, score_tier, profile_score FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    const tier = user.score_tier || 'unrated';
    const accessInfo = getTierAccessInfo(tier);

    res.json({
      code: 0,
      data: {
        tier,
        profileScore: user.profile_score || 0,
        ...accessInfo,
      },
    });
  } catch (err) {
    console.error('[match] tier-access error:', err);
    res.status(500).json({ code: -1, message: '获取权限失败' });
  }
});

module.exports = router;
