/**
 * routes_member.js - 会员建档路由（本地开发版）
 *
 * 端点：
 *   POST /v1/member/register  会员建档
 *   GET  /v1/member/detail    会员详情
 *   GET  /v1/member/list      会员列表（推荐官用）
 *   PUT  /v1/member/update    更新会员信息
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /v1/member/register - 会员建档
 */
router.post('/register', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const data = req.body;

  try {
    const ALLOWED = ['nickname', 'gender', 'age', 'city', 'phone', 'occupation', 'income', 'education', 'intro', 'wechatAccount', 'wechat_account'];
    const updates = [];
    const values = [];
    for (const f of ALLOWED) {
      if (data[f] !== undefined) {
        const col = ({ wechatAccount: 'wechat_account', })[f] || f;
        updates.push(`${col} = ?`);
        values.push(data[f]);
      }
    }

    if (updates.length > 0) {
      values.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    logger.info(`[member] 用户${userId}建档成功`);
    res.json({ code: 0, message: '建档成功', data: { userId } });
  } catch (err) {
    logger.error('[member] register error:', err.message);
    res.status(500).json({ code: -1, message: '建档失败' });
  }
});

/**
 * GET /v1/member/detail - 会员详情
 */
router.get('/detail', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.query.user_id || req.user.userId;

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });
    res.json({ code: 0, data: user });
  } catch (err) {
    logger.error('[member] detail error:', err.message);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * GET /v1/member/list - 我名下的会员列表（推荐官用）
 */
router.get('/list', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const { page = 1, page_size = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let total = 0;
    let rows = [];
    try {
      const countRow = db.prepare("SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ? AND is_locked = 1").get(userId);
      total = countRow?.total || 0;
      rows = db.prepare(`
        SELECT ur.user_id as id, u.nickname, u.avatar, u.gender, u.age, u.role, ur.bind_time, ur.created_at
        FROM user_referrals ur
        LEFT JOIN users u ON u.id = ur.user_id
        WHERE ur.referrer_id = ? AND ur.is_locked = 1
        ORDER BY ur.created_at DESC LIMIT ? OFFSET ?
      `).all(userId, pageSize, offset);
    } catch (e) {
      // user_referrals 表不存在
      total = 0;
      rows = [];
    }

    res.json({
      code: 0,
      data: {
        list: rows,
        total,
        page: pageNum,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      },
    });
  } catch (err) {
    logger.error('[member] list error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0, page: pageNum, page_size: pageSize, has_more: false } });
  }
});

/**
 * PUT /v1/member/update - 更新会员信息
 */
router.put('/update', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const data = req.body;

  try {
    const ALLOWED = ['nickname', 'gender', 'age', 'city', 'phone', 'occupation', 'income', 'education', 'intro'];
    const updates = [];
    const values = [];
    for (const f of ALLOWED) {
      if (data[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(data[f]);
      }
    }
    if (updates.length === 0) return res.json({ code: 0, message: '无需更新' });

    values.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    logger.error('[member] update error:', err.message);
    res.status(500).json({ code: -1, message: '更新失败' });
  }
});

module.exports = router;
