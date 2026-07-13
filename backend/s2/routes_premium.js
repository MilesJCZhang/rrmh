/**
 * routes_premium.js - 高端验资匹配 + 基金托管
 *
 * POST /v1/premium/verify            - 提交验资资料
 * GET  /v1/premium/verify/status     - 查询验资状态
 * POST /v1/premium/match/start       - 开始高端AI匹配
 * GET  /v1/premium/match/status      - 查询匹配状态
 * POST /v1/premium/match/confirm     - 确认匹配对象
 * POST /v1/premium/custody/create    - 创建10万基金托管
 * GET  /v1/premium/custody/status    - 查询托管状态
 * POST /v1/premium/custody/settle    - 结算（管理员）
 * GET  /v1/admin/premium-verifications - 管理员审核列表
 * PUT  /v1/admin/premium-verifications/:id - 管理员审核
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth-middleware');

// 确保表存在
function ensurePremiumTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS premium_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verify_type TEXT NOT NULL DEFAULT 'online',
      status TEXT DEFAULT 'pending',
      asset_type TEXT,
      asset_description TEXT,
      document_urls TEXT,
      estimated_value TEXT,
      contact_phone TEXT,
      preferred_time TEXT,
      preferred_location TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      reject_reason TEXT,
      admin_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS fund_custody_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      partner_user_id INTEGER,
      match_record_id INTEGER,
      amount INTEGER NOT NULL DEFAULT 100000,
      service_fee INTEGER NOT NULL DEFAULT 15000,
      custody_years INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pending',
      start_date TEXT,
      end_date TEXT,
      settle_type TEXT,
      settle_amount INTEGER,
      settled_at TEXT,
      order_id INTEGER,
      contract_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (partner_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS premium_match_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      verification_id INTEGER,
      status TEXT DEFAULT 'ai_matching',
      ai_matched_user_id INTEGER,
      ai_match_score REAL,
      ai_match_reason TEXT,
      ai_matched_at TEXT,
      human_matched_user_id INTEGER,
      human_matchmaker_id INTEGER,
      human_matched_at TEXT,
      confirmed_user_id INTEGER,
      confirmed_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (verification_id) REFERENCES premium_verifications(id)
    );
  `);
}

/**
 * POST /v1/premium/verify
 * 提交高端验资资料
 */
router.post('/verify', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const {
      verify_type, asset_type, asset_description, document_urls,
      estimated_value, contact_phone, preferred_time, preferred_location,
    } = req.body;

    if (!verify_type || !['online', 'offline'].includes(verify_type)) {
      return res.status(400).json({ code: -1, message: 'verify_type须为online或offline' });
    }

    // 检查用户评分
    const user = db.prepare('SELECT id, score_tier, profile_score FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // 检查是否有进行中的验资
    const existing = db.prepare(
      "SELECT id, status FROM premium_verifications WHERE user_id = ? AND status IN ('pending', 'reviewing')"
    ).get(userId);
    if (existing) {
      return res.status(400).json({
        code: -1,
        message: '您已有进行中的验资申请',
        data: { verification_id: existing.id, status: existing.status },
      });
    }

    const result = db.prepare(`
      INSERT INTO premium_verifications (user_id, verify_type, status, asset_type, asset_description,
        document_urls, estimated_value, contact_phone, preferred_time, preferred_location)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, verify_type, asset_type || null, asset_description || null,
      document_urls ? JSON.stringify(document_urls) : null,
      estimated_value || null, contact_phone || null,
      preferred_time || null, preferred_location || null
    );

    res.json({
      code: 0,
      message: '验资申请已提交，将在1-3个工作日内审核',
      data: { verification_id: result.lastInsertRowid },
    });
  } catch (err) {
    console.error('[premium] verify error:', err);
    res.status(500).json({ code: -1, message: '提交验资申请失败' });
  }
});

/**
 * GET /v1/premium/verify/status
 */
router.get('/verify/status', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const records = db.prepare(
      'SELECT * FROM premium_verifications WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);

    // 解析document_urls
    const parsed = records.map(r => ({
      ...r,
      document_urls: r.document_urls ? JSON.parse(r.document_urls) : [],
    }));

    res.json({ code: 0, data: parsed });
  } catch (err) {
    console.error('[premium] verify/status error:', err);
    res.status(500).json({ code: -1, message: '查询验资状态失败' });
  }
});

/**
 * POST /v1/premium/match/start
 * 开始高端AI匹配（需先通过验资）
 */
router.post('/match/start', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;

    // 检查验资状态
    const verification = db.prepare(
      "SELECT id, status FROM premium_verifications WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1"
    ).get(userId);

    if (!verification) {
      return res.status(403).json({ code: -1, message: '需先通过高端验资审核才能开始匹配' });
    }

    // 检查是否有进行中的匹配
    const activeMatch = db.prepare(
      "SELECT id, status FROM premium_match_records WHERE user_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC LIMIT 1"
    ).get(userId);

    if (activeMatch) {
      return res.json({
        code: 0,
        message: '已有进行中的匹配',
        data: { match_id: activeMatch.id, status: activeMatch.status },
      });
    }

    // 创建匹配记录
    const matchResult = db.prepare(`
      INSERT INTO premium_match_records (user_id, verification_id, status)
      VALUES (?, ?, 'ai_matching')
    `).run(userId, verification.id);

    // 模拟AI匹配：找同tier的高分异性用户
    const user = db.prepare('SELECT id, gender, score_tier, profile_score, city FROM users WHERE id = ?').get(userId);
    const oppositeGender = user.gender === 'male' ? 'female' : 'male';

    const candidates = db.prepare(`
      SELECT id, nickname, avatar, profile_score, score_tier, city, occupation, income,
        CASE WHEN birth_year IS NOT NULL THEN (strftime('%Y','now') - birth_year) ELSE NULL END as age
      FROM users
      WHERE id != ? AND gender = ? AND profile_score >= 60 AND score_tier IN ('gold', 'silver')
      ORDER BY profile_score DESC
      LIMIT 5
    `).all(userId, oppositeGender);

    // 选最佳匹配
    let aiMatch = null;
    if (candidates.length > 0) {
      aiMatch = candidates[0];
      // 更新匹配记录
      db.prepare(`
        UPDATE premium_match_records
        SET ai_matched_user_id = ?, ai_match_score = ?, ai_match_reason = ?,
            ai_matched_at = datetime('now'), status = 'matched', updated_at = datetime('now')
        WHERE id = ?
      `).run(
        aiMatch.id,
        70 + Math.random() * 25,
        `评分${aiMatch.profile_score}分${aiMatch.score_tier === 'gold' ? '优质' : '良好'}会员，${aiMatch.city || '同城'}，${aiMatch.occupation || ''}`,
        matchResult.lastInsertRowid
      );
    } else {
      // 无匹配候选人
      db.prepare(`
        UPDATE premium_match_records SET status = 'human_matching', updated_at = datetime('now') WHERE id = ?
      `).run(matchResult.lastInsertRowid);
    }

    res.json({
      code: 0,
      message: aiMatch ? 'AI匹配成功' : '正在为您安排人工匹配',
      data: {
        match_id: matchResult.lastInsertRowid,
        status: aiMatch ? 'matched' : 'human_matching',
        ai_match: aiMatch ? {
          user_id: aiMatch.id,
          nickname: aiMatch.nickname,
          avatar: aiMatch.avatar,
          profile_score: aiMatch.profile_score,
          score_tier: aiMatch.score_tier,
          city: aiMatch.city,
          age: aiMatch.age,
          occupation: aiMatch.occupation,
        } : null,
      },
    });
  } catch (err) {
    console.error('[premium] match/start error:', err);
    res.status(500).json({ code: -1, message: '启动匹配失败' });
  }
});

/**
 * GET /v1/premium/match/status
 */
router.get('/match/status', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const match = db.prepare(
      'SELECT * FROM premium_match_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).all(userId);

    res.json({ code: 0, data: match });
  } catch (err) {
    console.error('[premium] match/status error:', err);
    res.status(500).json({ code: -1, message: '查询匹配状态失败' });
  }
});

/**
 * POST /v1/premium/match/confirm
 * 确认匹配对象
 * Body: { confirmed_user_id }
 */
router.post('/match/confirm', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const { confirmed_user_id } = req.body;

    if (!confirmed_user_id) {
      return res.status(400).json({ code: -1, message: '缺少confirmed_user_id' });
    }

    const match = db.prepare(
      "SELECT * FROM premium_match_records WHERE user_id = ? AND status IN ('matched', 'human_matching') ORDER BY created_at DESC LIMIT 1"
    ).get(userId);

    if (!match) {
      return res.status(400).json({ code: -1, message: '没有可确认的匹配记录' });
    }

    db.prepare(`
      UPDATE premium_match_records
      SET confirmed_user_id = ?, confirmed_at = datetime('now'), status = 'confirmed', updated_at = datetime('now')
      WHERE id = ?
    `).run(confirmed_user_id, match.id);

    res.json({
      code: 0,
      message: '已确认匹配对象',
      data: { match_id: match.id, confirmed_user_id },
    });
  } catch (err) {
    console.error('[premium] match/confirm error:', err);
    res.status(500).json({ code: -1, message: '确认匹配失败' });
  }
});

/**
 * POST /v1/premium/custody/create
 * 创建10万基金托管
 */
router.post('/custody/create', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const { match_record_id, custody_years } = req.body;

    // 检查匹配记录
    const match = db.prepare(
      "SELECT * FROM premium_match_records WHERE id = ? AND user_id = ? AND status = 'confirmed'"
    ).get(match_record_id, userId);

    if (!match) {
      return res.status(400).json({ code: -1, message: '匹配记录不存在或未确认' });
    }

    // 检查是否已有托管
    const existingCustody = db.prepare(
      "SELECT id FROM fund_custody_accounts WHERE user_id = ? AND status IN ('pending', 'active')"
    ).get(userId);

    if (existingCustody) {
      return res.status(400).json({ code: -1, message: '您已有进行中的基金托管' });
    }

    const years = custody_years || 3;
    if (years < 3 || years > 5) {
      return res.status(400).json({ code: -1, message: '托管期限须为3-5年' });
    }

    const result = db.prepare(`
      INSERT INTO fund_custody_accounts (user_id, partner_user_id, match_record_id, amount, service_fee, custody_years, status)
      VALUES (?, ?, ?, 100000, 15000, ?, 'pending')
    `).run(userId, match.confirmed_user_id, match_record_id, years);

    // 更新匹配状态
    db.prepare(`
      UPDATE premium_match_records SET status = 'custody_created', updated_at = datetime('now') WHERE id = ?
    `).run(match_record_id);

    res.json({
      code: 0,
      message: '基金托管申请已创建，等待支付',
      data: {
        custody_id: result.lastInsertRowid,
        amount: 100000,
        amount_yuan: 100000 / 100,
        service_fee: 15000,
        service_fee_yuan: 15000 / 100,
        custody_years: years,
      },
    });
  } catch (err) {
    console.error('[premium] custody/create error:', err);
    res.status(500).json({ code: -1, message: '创建基金托管失败' });
  }
});

/**
 * GET /v1/premium/custody/status
 */
router.get('/custody/status', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const userId = req.user.userId;
    const accounts = db.prepare(
      'SELECT * FROM fund_custody_accounts WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);

    res.json({
      code: 0,
      data: accounts.map(a => ({
        ...a,
        amount_yuan: a.amount / 100,
        service_fee_yuan: a.service_fee / 100,
        settle_amount_yuan: a.settle_amount ? a.settle_amount / 100 : null,
      })),
    });
  } catch (err) {
    console.error('[premium] custody/status error:', err);
    res.status(500).json({ code: -1, message: '查询托管状态失败' });
  }
});

/**
 * POST /v1/premium/custody/settle
 * 结算（管理员）
 * Body: { custody_id, settle_type: 'marriage'|'refund' }
 */
router.post('/custody/settle', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const { custody_id, settle_type } = req.body;

    if (!custody_id || !['marriage', 'refund'].includes(settle_type)) {
      return res.status(400).json({ code: -1, message: '参数错误' });
    }

    const account = db.prepare('SELECT * FROM fund_custody_accounts WHERE id = ?').get(custody_id);
    if (!account) {
      return res.status(404).json({ code: -1, message: '托管账户不存在' });
    }

    let settleAmount;
    if (settle_type === 'marriage') {
      // 结婚：扣服务费，剩余返还
      settleAmount = account.amount - account.service_fee;
    } else {
      // 未结婚到期：全额返还
      settleAmount = account.amount;
    }

    db.prepare(`
      UPDATE fund_custody_accounts
      SET settle_type = ?, settle_amount = ?, settled_at = datetime('now'),
          status = 'settled', updated_at = datetime('now')
      WHERE id = ?
    `).run(settle_type, settleAmount, custody_id);

    res.json({
      code: 0,
      message: settle_type === 'marriage' ? '结婚结算完成' : '到期退款完成',
      data: {
        custody_id,
        settle_type,
        original_amount: account.amount,
        service_fee: account.service_fee,
        settle_amount: settleAmount,
      },
    });
  } catch (err) {
    console.error('[premium] custody/settle error:', err);
    res.status(500).json({ code: -1, message: '结算失败' });
  }
});

/**
 * GET /v1/admin/premium-verifications
 * 管理员获取验资审核列表
 */
router.get('/admin/premium-verifications', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT pv.*, u.nickname, u.avatar, u.profile_score, u.score_tier, u.gender
      FROM premium_verifications pv
      LEFT JOIN users u ON pv.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('pv.status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY pv.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(pageSize), offset);

    const list = db.prepare(sql).all(...params);

    res.json({
      code: 0,
      data: list.map(r => ({
        ...r,
        document_urls: r.document_urls ? JSON.parse(r.document_urls) : [],
      })),
    });
  } catch (err) {
    console.error('[premium] admin list error:', err);
    res.status(500).json({ code: -1, message: '获取验资列表失败' });
  }
});

/**
 * PUT /v1/admin/premium-verifications/:id
 * 管理员审核验资
 * Body: { action: 'approve'|'reject', reject_reason, admin_notes }
 */
router.put('/admin/premium-verifications/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = req.app.get('db');
    ensurePremiumTables(db);

    const { id } = req.params;
    const { action, reject_reason, admin_notes } = req.body;
    const adminId = req.user.userId;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: -1, message: 'action须为approve或reject' });
    }

    const record = db.prepare('SELECT * FROM premium_verifications WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ code: -1, message: '验资记录不存在' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    db.prepare(`
      UPDATE premium_verifications
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'),
          reject_reason = ?, admin_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, adminId, reject_reason || null, admin_notes || null, id);

    res.json({
      code: 0,
      message: action === 'approve' ? '审核通过' : '已拒绝',
    });
  } catch (err) {
    console.error('[premium] admin review error:', err);
    res.status(500).json({ code: -1, message: '审核操作失败' });
  }
});

module.exports = router;
