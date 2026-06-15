/**
 * 管理后台仪表盘统计路由
 * 提供仪表盘所需的统计数据API
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

/**
 * 获取仪表盘统计数据
 * GET /api/admin/dashboard/stats
 */
router.get('/dashboard/stats', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  
  try {
    // 1. 总用户数
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    // 2. 今日新增用户数
    const todayNewUsers = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE DATE(created_at) = DATE('now')
    `).get().count;
    
    // 3. 总订单数（如果orders表存在）
    let totalOrders = 0;
    try {
      totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    } catch (e) {
      // orders表可能不存在，忽略错误
    }
    
    // 4. 总收益（如果orders表存在）
    let totalRevenue = 0;
    try {
      totalRevenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = "paid"').get().total;
    } catch (e) {
      // orders表可能不存在，忽略错误
    }
    
    // 5. 待审核合伙人数量
    const pendingPartners = db.prepare(`
      SELECT COUNT(*) as count FROM partners WHERE status = 'pending'
    `).get().count;
    
    // 6. 待处理提现数量（如果withdrawals表存在）
    let pendingWithdrawals = 0;
    try {
      pendingWithdrawals = db.prepare(`
        SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'
      `).get().count;
    } catch (e) {
      // withdrawals表可能不存在，忽略错误
    }
    
    res.json({
      code: 0,
      data: {
        totalUsers,
        todayNewUsers,
        totalOrders,
        totalRevenue,
        pendingPartners,
        pendingWithdrawals,
      },
    });
  } catch (error) {
    console.error('[admin] 获取统计数据失败:', error);
    res.status(500).json({
      code: -1,
      message: '获取统计数据失败',
    });
  }
});

module.exports = router;
