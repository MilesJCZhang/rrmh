/**
 * routes_admin_orders.js - 订单/佣金/档案/验资/托管 管理 API
 * 管理员专用
 */
const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAuth, requireAdmin);

// ==================== 订单管理 ====================

/**
 * GET /v1/admin/orders
 * 订单列表（线上解锁+沙龙报名+建档）
 */
router.get('/orders', (req, res) => {
  const db = req.app.get('db');
  const { type, status, page = 1, pageSize = 20, startDate, endDate } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = [];
    let params = [];

    if (type) { where.push('o.type = ?'); params.push(type); }
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (startDate) { where.push("DATE(o.created_at) >= ?"); params.push(startDate); }
    if (endDate) { where.push("DATE(o.created_at) <= ?"); params.push(endDate); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM orders o ${whereClause}`).get(...params)?.count || 0;

    const orders = db.prepare(`
      SELECT o.*, u.nickname as payer_nickname, u.avatar_url as payer_avatar
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    // 订单类型统计
    const typeStats = db.prepare(`
      SELECT type, COUNT(*) as count, COALESCE(SUM(total_fee), 0) as total_amount
      FROM orders WHERE status = 'paid'
      GROUP BY type
    `).all();

    res.json({
      code: 0,
      data: {
        list: orders,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        typeStats,
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取订单列表失败', error: err.message });
  }
});

// ==================== 佣金管理 ====================

/**
 * GET /v1/admin/commissions
 * 佣金明细列表
 */
router.get('/commissions', (req, res) => {
  const db = req.app.get('db');
  const { recipientId, payType, status, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = [];
    let params = [];

    if (recipientId) { where.push('c.recipient_id = ?'); params.push(recipientId); }
    if (payType) { where.push('c.pay_type = ?'); params.push(payType); }
    if (status) { where.push('c.status = ?'); params.push(status); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM commissions c ${whereClause}`).get(...params)?.count || 0;

    const commissions = db.prepare(`
      SELECT c.*, u.nickname as recipient_nickname, u.role as recipient_role,
             p.nickname as payer_nickname
      FROM commissions c
      LEFT JOIN users u ON c.recipient_id = u.id
      LEFT JOIN users p ON c.payer_id = p.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    // 推荐人佣金汇总
    const referrerSummary = db.prepare(`
      SELECT c.recipient_id, u.nickname, u.role,
             COUNT(*) as total_count,
             SUM(c.amount) as total_amount,
             SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as pending_amount,
             SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as paid_amount
      FROM commissions c
      LEFT JOIN users u ON c.recipient_id = u.id
      WHERE c.recipient_type IN ('referrer', 'organizer', 'self')
      GROUP BY c.recipient_id
      ORDER BY total_amount DESC
      LIMIT 20
    `).all();

    res.json({
      code: 0,
      data: {
        list: commissions,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        referrerSummary,
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取佣金列表失败', error: err.message });
  }
});

// ==================== 档案管理 ====================

/**
 * GET /v1/admin/archives
 * 用户档案列表
 */
router.get('/archives', (req, res) => {
  const db = req.app.get('db');
  const { keyword, scoreTier, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = [];
    let params = [];

    if (keyword) {
      where.push('(u.nickname LIKE ? OR u.phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (scoreTier) { where.push('us.score_tier = ?'); params.push(scoreTier); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      ${whereClause}
    `).get(...params)?.count || 0;

    const archives = db.prepare(`
      SELECT u.id, u.nickname, u.avatar_url, u.phone, u.gender, u.role,
             u.profile_score, u.score_tier, u.face_auth_status, u.asset_verified_status,
             u.created_at,
             us.total_score, us.basic_score, us.career_score, us.hobby_score,
             us.preference_score, us.verification_score, us.asset_score
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      ${whereClause}
      ORDER BY us.total_score DESC, u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    res.json({
      code: 0,
      data: {
        list: archives,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取档案列表失败', error: err.message });
  }
});

/**
 * GET /v1/admin/archives/:id
 * 用户档案详情
 */
router.get('/archives/:id', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;

  try {
    // 用户基本信息 + 评分
    const user = db.prepare(`
      SELECT u.*, us.total_score, us.basic_score, us.career_score, us.hobby_score,
             us.preference_score, us.verification_score, us.asset_score, us.score_tier,
             us.detail_json
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // 验资记录
    const verifications = db.prepare(
      'SELECT * FROM user_asset_verifications WHERE user_id = ? ORDER BY created_at DESC'
    ).all(id);

    // 高端验资记录
    const premiumVerifications = db.prepare(
      'SELECT * FROM premium_verifications WHERE user_id = ? ORDER BY created_at DESC'
    ).all(id);

    // 基金托管记录
    const custodyRecords = db.prepare(
      'SELECT * FROM fund_custody_accounts WHERE user_id = ? ORDER BY created_at DESC'
    ).all(id);

    // 匹配记录
    const matchRecords = db.prepare(
      'SELECT * FROM premium_match_records WHERE user_id = ? OR matched_user_id = ? ORDER BY created_at DESC'
    ).all(id, id);

    // 订单记录
    const orders = db.prepare(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
    ).all(id);

    // 佣金记录
    const commissions = db.prepare(
      "SELECT c.*, u.nickname as recipient_nickname FROM commissions c LEFT JOIN users u ON c.recipient_id = u.id WHERE c.payer_id = ? OR c.recipient_id = ? ORDER BY c.created_at DESC LIMIT 20"
    ).all(id, id);

    res.json({
      code: 0,
      data: {
        user,
        verifications,
        premiumVerifications,
        custodyRecords,
        matchRecords,
        orders,
        commissions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取档案详情失败', error: err.message });
  }
});

// ==================== 高端验资审核 ====================

/**
 * GET /v1/admin/premium-verifications
 * 高端验资审核列表
 */
router.get('/premium-verifications', (req, res) => {
  const db = req.app.get('db');
  const { status, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = [];
    let params = [];

    if (status) { where.push('pv.status = ?'); params.push(status); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM premium_verifications pv ${whereClause}
    `).get(...params)?.count || 0;

    const list = db.prepare(`
      SELECT pv.*, u.nickname, u.avatar_url, u.phone
      FROM premium_verifications pv
      LEFT JOIN users u ON pv.user_id = u.id
      ${whereClause}
      ORDER BY pv.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    res.json({
      code: 0,
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取验资列表失败', error: err.message });
  }
});

/**
 * PUT /v1/admin/premium-verifications/:id
 * 审核高端验资（approve/reject）
 */
router.put('/premium-verifications/:id', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { action, rejectReason } = req.body;

  try {
    const record = db.prepare('SELECT * FROM premium_verifications WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ code: -1, message: '记录不存在' });
    }

    if (record.status !== 'pending') {
      return res.status(400).json({ code: -1, message: '该记录已审核' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(`
      UPDATE premium_verifications
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'),
          reject_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, req.user.userId, rejectReason || null, id);

    // 如果通过，更新用户验资状态
    if (newStatus === 'approved') {
      db.prepare(`
        UPDATE users SET asset_verified_status = 'verified', asset_verified_at = datetime('now')
        WHERE id = ?
      `).run(record.user_id);

      // 触发评分重算
      try {
        const scoreEngine = require('../../utils/scoreEngine');
        scoreEngine.recalculateAndSave(record.user_id, db);
      } catch (e) {
        // 评分重算失败不影响审核
      }
    }

    res.json({ code: 0, message: newStatus === 'approved' ? '审核通过' : '已拒绝' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '审核操作失败', error: err.message });
  }
});

// ==================== 基金托管管理 ====================

/**
 * GET /v1/admin/fund-custody
 * 基金托管列表
 */
router.get('/fund-custody', (req, res) => {
  const db = req.app.get('db');
  const { status, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = [];
    let params = [];

    if (status) { where.push('fc.status = ?'); params.push(status); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM fund_custody_accounts fc ${whereClause}
    `).get(...params)?.count || 0;

    const list = db.prepare(`
      SELECT fc.*, u.nickname, u.avatar_url, u.phone
      FROM fund_custody_accounts fc
      LEFT JOIN users u ON fc.user_id = u.id
      ${whereClause}
      ORDER BY fc.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    // 托管统计
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as active_amount,
        SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as settled_amount
      FROM fund_custody_accounts
    `).get();

    res.json({
      code: 0,
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize), stats },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取托管列表失败', error: err.message });
  }
});

/**
 * PUT /v1/admin/fund-custody/:id
 * 结算基金托管
 */
router.put('/fund-custody/:id', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { settleType } = req.body; // marriage / refund

  try {
    const record = db.prepare('SELECT * FROM fund_custody_accounts WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ code: -1, message: '记录不存在' });
    }

    if (record.status !== 'active') {
      return res.status(400).json({ code: -1, message: '该托管记录不可结算' });
    }

    const serviceFee = settleType === 'marriage' ? record.service_fee : 0;
    const refundAmount = record.amount - serviceFee;

    db.prepare(`
      UPDATE fund_custody_accounts
      SET status = 'settled', settle_type = ?, service_fee_deducted = ?,
          refund_amount = ?, settled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(settleType, serviceFee, refundAmount, id);

    res.json({
      code: 0,
      message: settleType === 'marriage' ? '结婚结算完成' : '到期退款完成',
      data: { refundAmount, serviceFee },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '结算操作失败', error: err.message });
  }
});

module.exports = router;
