/**
 * routes_stats.js - 统计概览路由（本地开发版）
 *
 * 端点：
 *   GET /v1/stats/overview  首页统计概览
 */

const express = require('express');
const { optionalAuth } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * GET /v1/stats/overview - 首页统计概览
 */
router.get('/overview', optionalAuth, (req, res) => {
  const db = req.app.get('db');

  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    const matchmakerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'partner_matchmaker' OR role LIKE '%matchmaker%'").get()?.count || 0;
    const activityCount = (() => {
      try {
        return db.prepare('SELECT COUNT(*) as count FROM activities').get()?.count || 0;
      } catch (e) {
        try {
          return db.prepare('SELECT COUNT(*) as count FROM salons').get()?.count || 0;
        } catch (e2) {
          return 0;
        }
      }
    })();

    // 额外统计（兼容管理后台 Dashboard 调用）
    let todayNewUsers = 0;
    let totalRevenue = 0;
    let pendingPartners = 0;
    let pendingWithdrawals = 0;
    let totalOrders = 0;
    let paidMembers = 0;
    let referrerCount = 0;

    try {
      todayNewUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE('now')").get()?.count || 0;
    } catch (e) {}
    try {
      totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get()?.count || 0;
    } catch (e) {}
    try {
      const rev = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'").get();
      totalRevenue = parseFloat(rev?.total || 0);
    } catch (e) {}
    try {
      pendingPartners = db.prepare("SELECT COUNT(*) as count FROM partners WHERE status = 'pending'").get()?.count || 0;
    } catch (e) {}
    try {
      pendingWithdrawals = db.prepare("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'").get()?.count || 0;
    } catch (e) {}
    try {
      paidMembers = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE type = 'single_registration' AND status = 'paid'").get()?.count || 0;
    } catch (e) {}
    try {
      referrerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('partner_matchmaker','professional_recommender','city_franchisee','community_station','public_matchmaker','creator','professional','city_partner','public_welfare')").get()?.count || 0;
    } catch (e) {}

    res.json({
      code: 0,
      data: {
        userCount,
        matchmakerCount,
        activityCount,
        salonCount: activityCount,
        // Dashboard 兼容字段
        totalUsers: userCount,
        todayNewUsers,
        totalOrders,
        totalRevenue,
        pendingPartners,
        pendingWithdrawals,
        totalMembers: paidMembers,
        paidMembers,
        referrerCount,
        pendingActivities: pendingPartners,
      },
    });
  } catch (err) {
    logger.error('[stats] overview error:', err.message);
    res.json({ code: 0, data: { userCount: 0, matchmakerCount: 0, activityCount: 0, salonCount: 0 } });
  }
});

module.exports = router;
