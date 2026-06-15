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

// GET /v1/income/records - 收益明细列表
router.get('/records', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  const { page = 1, page_size = 20, type } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let whereClause = 'WHERE user_id = ?';
    const params = [user_id];
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM commission_records ${whereClause}`).get(...params);
    const total = countRow?.total || 0;

    const rows = db.prepare(`
      SELECT * FROM commission_records ${whereClause}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      code: 0,
      data: {
        list: rows.map(r => ({
          id: r.id,
          type: r.type,
          amount: parseFloat(r.amount || 0),
          rate: parseFloat(r.rate || 0),
          status: r.status,
          orderId: r.order_id,
          remark: r.remark || '',
          createdAt: r.created_at,
          confirmedAt: r.confirmed_at || '',
        })),
        total,
        page: pageNum,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      },
    });
  } catch (err) {
    console.error('[income] records error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// GET /v1/income/stats - 业务统计（建档数/联创数/沙龙次数）
router.get('/stats', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;

  try {
    // 建档数：通过推荐关系绑定的、且支付过 single_registration 的用户
    const memberRow = db.prepare(`
      SELECT COUNT(DISTINCT ur.user_id) as count
      FROM user_referrals ur
      JOIN orders o ON o.user_id = ur.user_id AND o.type = 'single_registration' AND o.status = 'paid'
      WHERE ur.referrer_id = ? AND ur.is_locked = 1
    `).get(user_id);

    // 联创推荐官数
    const partnerRow = db.prepare(`
      SELECT COUNT(DISTINCT ur.user_id) as count
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'partner_matchmaker'
    `).get(user_id);

    // 沙龙参与次数（从 salon_group_members）
    const salonRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM salon_group_members m
      JOIN salons s ON s.id = m.salon_id
      WHERE m.user_id = ? AND m.status = 'checked_in'
    `).get(user_id);

    res.json({
      code: 0,
      data: {
        memberCount: memberRow?.count || 0,
        partnerCount: partnerRow?.count || 0,
        salonCount: salonRow?.count || 0,
      },
    });
  } catch (err) {
    console.error('[income] stats error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

module.exports = router;
