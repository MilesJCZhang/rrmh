/**
 * 收入汇总路由
 * 提供收入查询API
 * GET /income/summary - 获取收入汇总（用户端）
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();

/**
 * 获取收入汇总（用户端）
 * GET /income/summary
 * 返回：总收入、已提现、冻结中、可提现
 */
router.get('/summary', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  
  try {
    // 1. 计算总收入（从 commission_records 表，已确认的佣金）
    const totalResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM commission_records 
      WHERE user_id = ? AND status = 'confirmed'
    `).get(user_id);
    
    // 2. 计算已提现金额（已审核通过或已支付的提现）
    const withdrawnResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM withdrawals 
      WHERE user_id = ? AND status IN ('approved', 'paid')
    `).get(user_id);
    
    // 3. 计算冻结中金额（待审核的提现申请）
    const frozenResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM withdrawals 
      WHERE user_id = ? AND status = 'pending'
    `).get(user_id);
    
    const total = totalResult.total || 0;
    const withdrawn = withdrawnResult.total || 0;
    const frozen = frozenResult.total || 0;
    const withdrawable = Math.max(total - withdrawn - frozen, 0);
    
    res.json({
      code: 0,
      data: {
        withdrawable: parseFloat(withdrawable.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        withdrawn: parseFloat(withdrawn.toFixed(2)),
        frozen: parseFloat(frozen.toFixed(2))
      }
    });
  } catch (error) {
    console.error('[income] 查询汇总失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

module.exports = router;
