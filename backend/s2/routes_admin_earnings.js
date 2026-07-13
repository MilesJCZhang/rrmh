/**
 * routes_admin_earnings.js - 管理后台收益/支付/财务统计路由
 *
 * 端点：
 *   GET  /earnings        收益明细列表（分页+筛选）
 *   GET  /payments        支付记录列表（分页+筛选）
 *   GET  /finance-stats   财务统计汇总
 *
 * 用于兼容前端 /api/admin/earnings 等调用
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * GET /earnings - 收益明细列表
 * 从 commissions 表查询管理员收益数据
 * 支持分页、userId、type、startDate、endDate 筛选
 */
router.get('/earnings', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, pageSize = 20, userId, type, startDate, endDate } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize)));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ' AND c.recipient_id = ?'; params.push(parseInt(userId)); }
    if (type) { where += ' AND c.pay_type = ?'; params.push(type); }
    if (startDate) { where += ' AND c.created_at >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND c.created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    let total = 0, list = [];
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM commissions c ${where}`).get(...params);
      total = countRow?.total || 0;

      list = db.prepare(`
        SELECT c.*, u.nickname as user_nickname, u.phone as user_phone
        FROM commissions c
        LEFT JOIN users u ON u.id = c.recipient_id
        ${where}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSizeNum, offset);
    } catch (e) {
      logger.error('[admin_earnings] query error:', e.message);
    }

    // 格式化为前端期望格式
    const items = list.map(c => ({
      id: c.id,
      userId: c.recipient_id,
      userNickname: c.user_nickname || '',
      userPhone: c.user_phone || '',
      type: c.pay_type || 'other',
      amount: parseFloat(c.amount || 0),
      rate: 0.1,
      status: c.status === 'pending' ? 'pending' : 'confirmed',
      createdAt: c.created_at || '',
    }));

    // 统计
    let todayCount = 0;
    try {
      const today = db.prepare(
        "SELECT COUNT(*) as count FROM commissions WHERE date(created_at) = date('now')"
      ).get();
      todayCount = today?.count || 0;
    } catch (e) {}

    res.json({
      code: 0,
      data: {
        list: items,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        stats: {
          total,
          today: todayCount,
          settled: items.filter(i => i.status === 'confirmed').length,
          pending: items.filter(i => i.status === 'pending').length,
        },
      },
    });
  } catch (err) {
    logger.error('[admin_earnings] list error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0 } });
  }
});

/**
 * GET /payments - 支付记录列表
 * 从 orders 表查询支付数据
 */
router.get('/payments', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, pageSize = 20, userId, status, startDate, endDate } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize)));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ' AND o.user_id = ?'; params.push(parseInt(userId)); }
    if (status) { where += ' AND o.status = ?'; params.push(status === 'success' ? 'paid' : status); }
    if (startDate) { where += ' AND o.created_at >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND o.created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    let total = 0, list = [];
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM orders o ${where}`).get(...params);
      total = countRow?.total || 0;

      list = db.prepare(`
        SELECT o.*, u.nickname as user_nickname, u.phone as user_phone
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSizeNum, offset);
    } catch (e) {
      logger.error('[admin_earnings] payments query error:', e.message);
    }

    const items = list.map(o => ({
      id: o.id,
      orderNo: o.order_no || o.id,
      userId: o.user_id,
      payerNickname: o.user_nickname || '',
      type: o.type || 'registration',
      totalFee: parseFloat(o.amount || 0),
      status: o.status || 'pending',
      payTime: o.pay_time || '',
      createdAt: o.created_at || '',
    }));

    // 支付渠道统计
    let todayCount = 0, wechatCount = 0, alipayCount = 0;
    try {
      const today = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')"
      ).get();
      todayCount = today?.count || 0;
    } catch (e) {}

    res.json({
      code: 0,
      data: {
        list: items,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        stats: {
          total,
          today: todayCount,
          wechat: wechatCount,
          alipay: alipayCount,
        },
      },
    });
  } catch (err) {
    logger.error('[admin_earnings] payments error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0 } });
  }
});

/**
 * GET /finance-stats - 财务统计汇总
 */
router.get('/finance-stats', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  try {
    let totalEarnings = 0, todayEarnings = 0;
    let totalPayments = 0, todayPayments = 0;
    let totalWithdrawals = 0, pendingWithdrawals = 0;

    try {
      const e = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE status = 'pending'").get();
      totalEarnings = parseFloat(e?.total || 0);
    } catch (e) {}

    try {
      const te = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE date(created_at) = date('now')").get();
      todayEarnings = parseFloat(te?.total || 0);
    } catch (e) {}

    try {
      const p = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'").get();
      totalPayments = parseFloat(p?.total || 0);
    } catch (e) {}

    try {
      const tp = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE date(created_at) = date('now') AND status = 'paid'").get();
      todayPayments = parseFloat(tp?.total || 0);
    } catch (e) {}

    try {
      const w = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'paid'").get();
      totalWithdrawals = parseFloat(w?.total || 0);
    } catch (e) {}

    try {
      const pw = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status = 'pending'").get();
      pendingWithdrawals = parseFloat(pw?.total || 0);
    } catch (e) {}

    res.json({
      code: 200,
      data: {
        totalEarnings,
        todayEarnings,
        pendingEarnings: pendingWithdrawals,
        totalPayments,
        todayPayments,
        totalWithdrawals,
        pendingWithdrawals,
      },
    });
  } catch (err) {
    logger.error('[admin_earnings] finance-stats error:', err.message);
    res.json({ code: 200, data: {} });
  }
});

module.exports = router;
