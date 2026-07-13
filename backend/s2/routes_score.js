/**
 * routes_score.js - 评分相关API路由
 *
 * 端点：
 *   GET  /v1/score/profile       获取当前用户评分详情
 *   GET  /v1/score/rules          获取评分规则列表
 *   POST /v1/score/recalculate    手动触发评分重算
 *   GET  /v1/score/tier-info      获取分数等级说明
 *   PUT  /v1/admin/score/rules    管理员更新评分规则
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const scoreEngine = require('../../utils/scoreEngine');
const logger = require('../../utils/logger');

const router = express.Router();

function getDb(req) {
  return req.app.get('db');
}

// ========== GET /v1/score/profile ==========
// 获取当前用户评分详情（含各维度分数、进度、缺失字段提示）
router.get('/profile', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ code: -1, message: '未登录' });

    const result = scoreEngine.recalculateAndSave(db, userId);
    const groupMaxScores = scoreEngine.getGroupMaxScores();

    // 构建维度进度
    const groupProgress = {};
    for (const group of scoreEngine.GROUP_ORDER) {
      groupProgress[group] = {
        label: scoreEngine.GROUP_LABELS[group],
        earned: result.groupScores[group] || 0,
        max: groupMaxScores[group] || 0,
        percentage: groupMaxScores[group]
          ? Math.round((result.groupScores[group] || 0) / groupMaxScores[group] * 100)
          : 0,
      };
    }

    // 缺失字段提示（未填写的字段）
    const missingFields = Object.entries(result.detail)
      .filter(([, v]) => !v.filled)
      .map(([k, v]) => ({ key: k, label: v.label, maxScore: v.maxScore }));

    res.json({
      code: 0,
      data: {
        totalScore: result.totalScore,
        tier: result.tier,
        tierLabel: scoreEngine.getTierLabel(result.tier),
        groupProgress,
        missingFields,
        detail: result.detail,
      },
    });

  } catch (err) {
    logger.error('[score] profile error:', err);
    res.status(500).json({ code: -1, message: '获取评分失败' });
  }
});

// ========== GET /v1/score/rules ==========
// 获取评分规则列表（前端建档页使用，无需登录）
router.get('/rules', (req, res) => {
  try {
    const db = getDb(req);
    const rules = scoreEngine.getRules(db);
    const groupMaxScores = scoreEngine.getGroupMaxScores();

    res.json({
      code: 0,
      data: {
        rules,
        groupLabels: scoreEngine.GROUP_LABELS,
        groupMaxScores,
        groupOrder: scoreEngine.GROUP_ORDER,
      },
    });

  } catch (err) {
    logger.error('[score] rules error:', err);
    res.status(500).json({ code: -1, message: '获取评分规则失败' });
  }
});

// ========== POST /v1/score/recalculate ==========
// 手动触发评分重算
router.post('/recalculate', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;
    const result = scoreEngine.recalculateAndSave(db, userId);

    res.json({
      code: 0,
      data: {
        totalScore: result.totalScore,
        tier: result.tier,
        tierLabel: scoreEngine.getTierLabel(result.tier),
      },
    });

  } catch (err) {
    logger.error('[score] recalculate error:', err);
    res.status(500).json({ code: -1, message: '评分重算失败' });
  }
});

// ========== GET /v1/score/tier-info ==========
// 获取分数等级说明
router.get('/tier-info', (req, res) => {
  res.json({
    code: 0,
    data: {
      tiers: [
        {
          key: 'gold',
          label: '优质',
          range: '80-100分',
          onlineUnlock: true,
          onlinePrice: 199,
          offlineAccess: true,
          canUnlockGold: true,
          description: '可使用线上一对一沟通(199元) + 线下6人组沙龙两种社交方式',
        },
        {
          key: 'silver',
          label: '良好',
          range: '60-79分',
          onlineUnlock: true,
          onlinePrice: 299,
          offlineAccess: true,
          canUnlockGold: false,
          description: '可使用线上一对一沟通(299元) + 线下6人组沙龙，不可解锁80分以上用户',
        },
        {
          key: 'bronze',
          label: '基础',
          range: '60分以下',
          onlineUnlock: false,
          onlinePrice: 0,
          offlineAccess: true,
          canUnlockGold: false,
          description: '仅可参与线下3男3女标准6人组沙龙，无法使用线上解锁沟通功能',
        },
        {
          key: 'unrated',
          label: '未建档',
          range: '未填写资料',
          onlineUnlock: false,
          onlinePrice: 0,
          offlineAccess: false,
          canUnlockGold: false,
          description: '请先完善个人资料',
        },
      ],
      notice: '资料完善度越高，匹配维度越全面、匹配结果越精准；同时可解锁更多使用权限、享受更低服务费用。平台严格按分值分层匹配，同圈层对等社交。',
    },
  });
});

// ========== PUT /v1/admin/score/rules ==========
// 管理员更新评分规则
router.put('/rules', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb(req);
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ code: -1, message: 'rules必须是数组' });
    }

    const transaction = db.transaction(() => {
      for (const rule of rules) {
        if (!rule.id || !rule.field_key) continue;
        db.prepare(`
          UPDATE score_rules
          SET max_score = ?, status = ?, sort_order = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(rule.max_score || 0, rule.status || 'active', rule.sort_order || 0, rule.id);
      }
    });

    transaction();

    logger.info('[score] 管理员更新评分规则:', rules.length, '条');
    res.json({ code: 0, message: '评分规则更新成功' });

  } catch (err) {
    logger.error('[score] admin rules update error:', err);
    res.status(500).json({ code: -1, message: '更新评分规则失败' });
  }
});

module.exports = router;
