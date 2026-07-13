/**
 * routes_matchmaker.js - 推荐官工作台路由（本地开发版）
 *
 * 端点：
 *   GET /v1/matchmaker/status      推荐官状态
 *   GET /v1/matchmaker/list        推荐官列表
 *   GET /v1/matchmaker/dashboard   推荐官工作台数据
 *   POST /v1/matchmaker/withdraw   推荐官提现
 *   GET /v1/matchmaker/my-members  我的会员列表
 *   GET /v1/matchmaker/:id/info    推荐官详情
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');
const logger = require('../../utils/logger');

// 推荐官角色列表（与 constants/roles.js 保持一致）
const MATCHMAKER_ROLES = [
  'public_matchmaker', 'partner_matchmaker', 'professional_recommender',
  'community_station', 'city_franchisee'
];

const router = express.Router();

/**
 * GET /v1/matchmaker/status - 推荐官状态
 */
router.get('/status', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;

  try {
    const user = db.prepare('SELECT id, role, referral_code FROM users WHERE id = ?').get(userId);
    const isMatchmaker = user?.role && (MATCHMAKER_ROLES.includes(user.role) || user.role === 'admin');

    res.json({
      code: 0,
      data: {
        isMatchmaker: !!isMatchmaker,
        role: user?.role || 'user',
        referralCode: user?.referral_code || '',
      },
    });
  } catch (err) {
    logger.error('[matchmaker] status error:', err.message);
    res.json({ code: 0, data: { isMatchmaker: false, role: 'user', referralCode: '' } });
  }
});

/**
 * GET /v1/matchmaker/list - 推荐官列表
 */
router.get('/list', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, page_size = 20 } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * pageSize;

    const matchmakerRolesList = MATCHMAKER_ROLES.map(r => `'${r}'`).join(',');
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM users WHERE role IN (${matchmakerRolesList})`).get();
    const total = countRow?.total || 0;
    const rows = db.prepare(`SELECT id, nickname, avatar, role, created_at FROM users WHERE role IN (${matchmakerRolesList}) ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(pageSize, offset);

    res.json({
      code: 0,
      data: { list: rows, total, page: pageNum, page_size: pageSize, has_more: offset + pageSize < total },
    });
  } catch (err) {
    logger.error('[matchmaker] list error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0, page: 1, page_size: 20, has_more: false } });
  }
});

/**
 * GET /v1/matchmaker/dashboard - 推荐官工作台数据
 */
router.get('/dashboard', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;

  try {
    const user = db.prepare('SELECT id, nickname, avatar, role, referral_code, profile_score, score_tier FROM users WHERE id = ?').get(userId);

    let totalReferrals = 0, todayReferrals = 0, totalIncome = 0;
    try {
      const r = db.prepare("SELECT COUNT(*) as count FROM user_referrals WHERE referrer_id = ? AND is_locked = 1").get(userId);
      totalReferrals = r?.count || 0;
      const t = db.prepare("SELECT COUNT(*) as count FROM user_referrals WHERE referrer_id = ? AND is_locked = 1 AND date(created_at) = date('now')").get(userId);
      todayReferrals = t?.count || 0;
    } catch (e) {}

    try {
      const inc = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_records WHERE user_id = ? AND status = 'confirmed'").get(userId);
      totalIncome = inc?.total || 0;
    } catch (e) {}

    res.json({
      code: 0,
      data: {
        profile: { nickname: user?.nickname || '', avatar: user?.avatar || '', role: user?.role || 'user', referralCode: user?.referral_code || '' },
        stats: { totalReferrals, todayReferrals, totalIncome, profileScore: user?.profile_score || 0, scoreTier: user?.score_tier || 'unrated' },
      },
    });
  } catch (err) {
    logger.error('[matchmaker] dashboard error:', err.message);
    res.json({ code: 0, data: { profile: {}, stats: {} } });
  }
});

/**
 * POST /v1/matchmaker/withdraw - 推荐官提现
 */
router.post('/withdraw', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const { amount } = req.body;

  try {
    if (!amount || amount <= 0) return res.status(400).json({ code: -1, message: '提现金额无效' });

    db.prepare(`
      INSERT INTO withdrawals (user_id, amount, status, created_at, updated_at)
      VALUES (?, ?, 'pending', datetime('now'), datetime('now'))
    `).run(userId, amount);

    logger.info(`[matchmaker] 用户${userId}申请提现${amount}元`);
    res.json({ code: 0, message: '提现申请已提交', data: { amount } });
  } catch (err) {
    logger.error('[matchmaker] withdraw error:', err.message);
    res.status(500).json({ code: -1, message: '提现申请失败' });
  }
});

/**
 * GET /v1/matchmaker/my-members - 我的会员列表
 */
router.get('/my-members', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const { page = 1, page_size = 20 } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * pageSize;
    let total = 0, list = [];

    try {
      const countRow = db.prepare("SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ? AND is_locked = 1").get(userId);
      total = countRow?.total || 0;
      list = db.prepare(`
        SELECT ur.user_id as id, u.nickname, u.avatar, u.gender, u.age, u.role, ur.bind_time
        FROM user_referrals ur LEFT JOIN users u ON u.id = ur.user_id
        WHERE ur.referrer_id = ? AND ur.is_locked = 1
        ORDER BY ur.created_at DESC LIMIT ? OFFSET ?
      `).all(userId, pageSize, offset);
    } catch (e) {}

    res.json({ code: 0, data: { list, total, page: pageNum, page_size: pageSize, has_more: offset + pageSize < total } });
  } catch (err) {
    logger.error('[matchmaker] my-members error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0, page: 1, page_size: 20, has_more: false } });
  }
});

/**
 * GET /v1/matchmaker/:id/info - 推荐官详情
 */
router.get('/:id/info', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const targetId = req.params.id;

  try {
    const user = db.prepare('SELECT id, nickname, avatar, role, referral_code, profile_score, score_tier, intro FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });
    res.json({ code: 0, data: user });
  } catch (err) {
    logger.error('[matchmaker] info error:', err.message);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

module.exports = router;
