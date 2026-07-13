/**
 * routes_admin_finance.js - 管理后台财务路由（本地开发版）
 *
 * 端点：
 *   GET  /v1/admin/finance/overview    财务概览
 *   GET  /v1/admin/finance/orders      订单列表
 *   GET  /v1/admin/finance/withdrawals 提现审核列表
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * GET /v1/admin/finance/overview - 财务概览
 */
router.get('/finance/overview', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');

  try {
    let totalOrders = 0, totalRevenue = 0, totalWithdrawals = 0, totalWithdrawn = 0;

    try {
      const o = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'").get();
      totalOrders = o?.count || 0;
      totalRevenue = o?.total || 0;
    } catch (e) {}

    try {
      const w = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE status IN ('approved', 'paid')").get();
      totalWithdrawals = w?.count || 0;
      totalWithdrawn = w?.total || 0;
    } catch (e) {}

    res.json({
      code: 0,
      data: {
        totalOrders,
        totalRevenue: parseFloat((totalRevenue / 100).toFixed(2)),
        totalWithdrawals,
        totalWithdrawn: parseFloat((totalWithdrawn / 100).toFixed(2)),
        netRevenue: parseFloat(((totalRevenue - totalWithdrawn) / 100).toFixed(2)),
      },
    });
  } catch (err) {
    logger.error('[admin_finance] overview error:', err.message);
    res.json({ code: 0, data: {} });
  }
});

/**
 * GET /v1/admin/finance/orders - 订单列表
 */
router.get('/finance/orders', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, page_size = 20, status } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * pageSize;

    let where = '';
    const params = [];
    if (status) { where = ' WHERE status = ?'; params.push(status); }

    let total = 0, list = [];
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM orders${where}`).get(...params);
      total = countRow?.total || 0;
      list = db.prepare(`SELECT * FROM orders${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    } catch (e) {}

    res.json({ code: 0, data: { list, total, page: pageNum, page_size: pageSize, has_more: offset + pageSize < total } });
  } catch (err) {
    logger.error('[admin_finance] orders error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0 } });
  }
});

/**
 * GET /v1/admin/finance/withdrawals - 提现审核列表
 */
router.get('/finance/withdrawals', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, page_size = 20, status } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * pageSize;

    let where = '';
    const params = [];
    if (status) { where = ' WHERE status = ?'; params.push(status); }

    let total = 0, list = [];
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM withdrawals${where}`).get(...params);
      total = countRow?.total || 0;
      list = db.prepare(`SELECT w.*, u.nickname as user_name FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id${where} ORDER BY w.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    } catch (e) {}

    res.json({ code: 0, data: { list, total, page: pageNum, page_size: pageSize, has_more: offset + pageSize < total } });
  } catch (err) {
    logger.error('[admin_finance] withdrawals error:', err.message);
    res.json({ code: 0, data: { list: [], total: 0 } });
  }
});

module.exports = router;
