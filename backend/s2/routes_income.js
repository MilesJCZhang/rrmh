/**
 * 收入汇总路由
 * 提供收入查询API
 * GET /income/summary - 获取收入汇总（用户端）
 *
 * 数据源：commissions 表（由 commission_engine.js processCommission 写入）
 * ⚠️ 注意：不要查询 commission_records 表，该表未被任何代码写入
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();

/**
 * 获取收入汇总（用户端）
 * GET /income/summary
 * 返回：今日/本月/累计收入、已提现、冻结中、可提现
 */
router.get('/summary', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;

  try {
    // 确保 commissions 表存在
    db.exec(`CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER, payer_id INTEGER, pay_type TEXT,
      total_amount REAL, recipient_id INTEGER, recipient_role TEXT,
      recipient_type TEXT, amount REAL, platform_fee REAL DEFAULT 0,
      settlement_pool REAL DEFAULT 0, referrer_id INTEGER,
      is_self_referral INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending', note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`);
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_comm_recipient ON commissions(recipient_id)'); } catch(e) {}
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_comm_status ON commissions(status)'); } catch(e) {}
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_comm_paytype ON commissions(pay_type)'); } catch(e) {}

    // 1. 累计总收入（已结算的佣金）
    const totalResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM commissions
      WHERE recipient_id = ? AND status IN ('withdrawn', 'paid', 'settled', 'confirmed')
    `).get(user_id);

    // 2. 今日收益
    const todayResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM commissions
      WHERE recipient_id = ? AND status IN ('withdrawn', 'paid', 'settled', 'confirmed')
        AND date(created_at) = date('now', 'localtime')
    `).get(user_id);

    // 3. 本月收益
    const monthResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM commissions
      WHERE recipient_id = ? AND status IN ('withdrawn', 'paid', 'settled', 'confirmed')
        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
    `).get(user_id);

    // 4. 已提现金额
    const withdrawnResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM withdrawals
      WHERE user_id = ? AND status IN ('approved', 'paid')
    `).get(user_id);

    // 5. 冻结中金额
    const frozenResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM withdrawals
      WHERE user_id = ? AND status = 'pending'
    `).get(user_id);

    const totalIncome = parseFloat((totalResult.total || 0).toFixed(2));
    const todayIncome = parseFloat((todayResult.total || 0).toFixed(2));
    const monthIncome = parseFloat((monthResult.total || 0).toFixed(2));
    const withdrawn = parseFloat((withdrawnResult.total || 0).toFixed(2));
    const frozen = parseFloat((frozenResult.total || 0).toFixed(2));
    const withdrawable = Math.max(totalIncome - withdrawn - frozen, 0);

    res.json({
      code: 0,
      data: {
        todayIncome,
        monthIncome,
        totalIncome,
        today_income: todayIncome,
        month_income: monthIncome,
        total_income: totalIncome,
        withdrawable: parseFloat(withdrawable.toFixed(2)),
        total: totalIncome,
        withdrawn,
        frozen,
      }
    });
  } catch (error) {
    console.error('[income] 查询汇总失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

// GET /v1/income/records - 收益明细列表（从 commissions 表查询）
router.get('/records', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  const { page = 1, page_size = 20, type } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let whereClause = 'WHERE recipient_id = ?';
    const params = [user_id];
    if (type) {
      whereClause += ' AND pay_type = ?';
      params.push(type);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM commissions ${whereClause}`).get(...params);
    const total = countRow?.total || 0;

    const rows = db.prepare(`
      SELECT * FROM commissions ${whereClause}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    // 业务类型图标映射
    const _iconMap = {
      single_registration: '💑', partner_matchmaker: '👑',
      professional_recommender: '🏅', city_franchisee: '🏙️',
      salon_signup: '🎉', salon_attend: '🎉',
      online_unlock_gold: '🔓', online_unlock_silver: '🔓',
      platform_fund: '💎', upgrade: '⬆️',
    };
    const _titleMap = {
      single_registration: '推荐建档', partner_matchmaker: '推荐联创推荐官',
      professional_recommender: '推荐专业推荐官', city_franchisee: '推荐城市合伙人',
      salon_signup: '沙龙补贴', salon_attend: '沙龙补贴',
      online_unlock_gold: '线上解锁(优质)', online_unlock_silver: '线上解锁(良好)',
      platform_fund: '沉淀资金分成', upgrade: '身份升级',
    };

    res.json({
      code: 0,
      data: {
        list: rows.map(r => ({
          id: r.id,
          type: r.pay_type,
          amount: parseFloat(r.amount || 0),
          rate: 0,
          status: r.status,
          orderId: r.order_id,
          remark: r.note || '',
          createdAt: r.created_at,
          confirmedAt: r.updated_at || '',
          // 前端展示友好字段
          icon: _iconMap[r.pay_type] || '💰',
          title: _titleMap[r.pay_type] || '其他收益',
          time: r.created_at || '',
          settled: r.status === 'withdrawn' || r.status === 'paid' || r.status === 'settled',
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

// GET /v1/income/stats - 业务统计（从 commissions 表查询）
router.get('/stats', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;

  try {
    // 建档数：通过推荐关系绑定 + 有单次注册佣金记录
    const memberRow = db.prepare(`
      SELECT COUNT(DISTINCT c.payer_id) as count
      FROM commissions c
      JOIN user_referrals ur ON ur.user_id = c.payer_id AND ur.referrer_id = ? AND ur.is_locked = 1
      WHERE c.recipient_id = ? AND c.pay_type = 'single_registration'
    `).get(user_id, user_id);

    // 建档收入
    const memberIncomeRow = db.prepare(`
      SELECT COALESCE(SUM(c.amount), 0) as total
      FROM commissions c
      WHERE c.recipient_id = ? AND c.pay_type = 'single_registration'
        AND c.status IN ('withdrawn', 'paid', 'settled', 'confirmed')
    `).get(user_id);

    // 联创推荐官数
    const partnerRow = db.prepare(`
      SELECT COUNT(DISTINCT c.payer_id) as count
      FROM commissions c
      JOIN user_referrals ur ON ur.user_id = c.payer_id AND ur.referrer_id = ? AND ur.is_locked = 1
      JOIN users u ON u.id = c.payer_id
      WHERE c.recipient_id = ? AND c.pay_type = 'partner_matchmaker' AND u.role = 'partner_matchmaker'
    `).get(user_id, user_id);

    // 联创收入
    const partnerIncomeRow = db.prepare(`
      SELECT COALESCE(SUM(c.amount), 0) as total
      FROM commissions c
      WHERE c.recipient_id = ? AND c.pay_type = 'partner_matchmaker'
        AND c.status IN ('withdrawn', 'paid', 'settled', 'confirmed')
    `).get(user_id);

    // 沙龙参与次数
    let salonCount = 0;
    try {
      const salonRow = db.prepare(`
        SELECT COUNT(*) as count FROM salon_group_members m
        JOIN salons s ON s.id = m.salon_id
        WHERE m.user_id = ? AND m.status = 'checked_in'
      `).get(user_id);
      salonCount = salonRow?.count || 0;
    } catch (e) {
      try {
        const salonRow = db.prepare(`
          SELECT COUNT(*) as count FROM activity_registrations
          WHERE user_id = ? AND status = 'checked_in'
        `).get(user_id);
        salonCount = salonRow?.count || 0;
      } catch (e2) { salonCount = 0; }
    }

    // 沙龙收入
    let salonIncome = 0;
    try {
      const salonIncomeRow = db.prepare(`
        SELECT COALESCE(SUM(c.amount), 0) as total
        FROM commissions c
        WHERE c.recipient_id = ? AND c.pay_type IN ('salon_signup', 'salon_attend')
          AND c.status IN ('withdrawn', 'paid', 'settled', 'confirmed')
      `).get(user_id);
      salonIncome = salonIncomeRow?.total || 0;
    } catch (e) { salonIncome = 0; }

    res.json({
      code: 0,
      data: {
        memberCount: memberRow?.count || 0,
        memberIncome: parseFloat((memberIncomeRow?.total || 0).toFixed(2)),
        partnerCount: partnerRow?.count || 0,
        partnerIncome: parseFloat((partnerIncomeRow?.total || 0).toFixed(2)),
        salonCount,
        salonIncome: parseFloat((salonIncome || 0).toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[income] stats error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

module.exports = router;
