/**
 * routes_referral_visitor.js - 推荐官工作台访客接口（无需登录）
 *
 * 路由挂载：/v1/referral （在 server.js 中注册时无需 requireAuth）
 * 接口清单：
 *   POST /visitor-log     记录访客到访
 *   PUT  /visitor-update  更新访客注册状态
 */

const express = require('express');
const logger = require('./utils/logger');

const router = express.Router();

function getDb(req) {
  return req.app.get('db');
}

/**
 * 确保 visitor_logs 表存在
 */
function ensureVisitorLogsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referrer_code TEXT NOT NULL,
      visitor_openid TEXT NOT NULL,
      visitor_nickname TEXT,
      visitor_avatar TEXT,
      visit_time TEXT DEFAULT (datetime('now', 'localtime')),
      reg_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (referrer_id) REFERENCES users(id)
    )
  `);
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_referrer ON visitor_logs(referrer_id)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_openid ON visitor_logs(visitor_openid)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_logs(reg_status)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_time ON visitor_logs(visit_time)'); } catch (e) {}
}

// ═══════════════════════════════════════════════
// POST /v1/referral/visitor-log
// 记录访客到访（无需登录）
// Body: { referrer_code, visitor_openid, visitor_nickname, visitor_avatar }
// ═══════════════════════════════════════════════
router.post('/visitor-log', (req, res) => {
  try {
    const db = getDb(req);
    ensureVisitorLogsTable(db);

    const { referrer_code, visitor_openid, visitor_nickname, visitor_avatar } = req.body;

    if (!referrer_code || !visitor_openid) {
      return res.status(400).json({ code: -1, message: '推荐码和访客openid不能为空' });
    }

    // 解析推荐码对应的推荐官
    const codeRow = db.prepare(`
      SELECT id, referrer_id, referrer_name FROM referral_codes WHERE code = ? AND status = 'active'
    `).get(String(referrer_code).toUpperCase());

    if (!codeRow || !codeRow.referrer_id) {
      return res.status(400).json({ code: -1, message: '推荐码无效或未关联推荐官' });
    }

    const referrerId = codeRow.referrer_id;

    // 检查是否已存在记录（同一 openid + 同一推荐官去重）
    const existing = db.prepare(`
      SELECT id FROM visitor_logs WHERE visitor_openid = ? AND referrer_id = ?
    `).get(visitor_openid, referrerId);

    if (existing) {
      db.prepare(`
        UPDATE visitor_logs SET visit_time = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(existing.id);

      return res.json({ code: 0, data: { id: existing.id, updated: true }, message: '更新到访时间成功' });
    }

    const result = db.prepare(`
      INSERT INTO visitor_logs (referrer_id, referrer_code, visitor_openid, visitor_nickname, visitor_avatar)
      VALUES (?, ?, ?, ?, ?)
    `).run(referrerId, String(referrer_code).toUpperCase(), visitor_openid, visitor_nickname || '', visitor_avatar || '');

    logger.info(`[visitor-log] 记录访客: openid=${visitor_openid}, referrer_code=${referrer_code}`);
    res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '记录访客成功' });

  } catch (err) {
    logger.error('[visitor-log] error:', err);
    res.status(500).json({ code: -1, message: '记录访客失败' });
  }
});

// ═══════════════════════════════════════════════
// PUT /v1/referral/visitor-update
// 更新访客注册状态（无需登录）
// Body: { visitor_openid, reg_status, referrer_code? }
// reg_status: 'registered' | 'pending'
// ═══════════════════════════════════════════════
router.put('/visitor-update', (req, res) => {
  try {
    const db = getDb(req);
    ensureVisitorLogsTable(db);

    const { visitor_openid, reg_status, referrer_code } = req.body;

    if (!visitor_openid || !reg_status) {
      return res.status(400).json({ code: -1, message: '参数不完整' });
    }

    if (!['registered', 'pending'].includes(reg_status)) {
      return res.status(400).json({ code: -1, message: '无效的注册状态' });
    }

    let whereClause = 'visitor_openid = ?';
    let params = [visitor_openid];

    if (referrer_code) {
      whereClause += ' AND referrer_code = ?';
      params.push(String(referrer_code).toUpperCase());
    }

    const result = db.prepare(`
      UPDATE visitor_logs
      SET reg_status = ?, updated_at = datetime('now', 'localtime')
      WHERE ${whereClause}
    `).run(reg_status, ...params);

    if (result.changes === 0) {
      return res.json({ code: 0, data: { updated: false }, message: '未找到匹配的访客记录' });
    }

    logger.info(`[visitor-update] 更新访客状态: openid=${visitor_openid}, status=${reg_status}`);
    res.json({ code: 0, data: { updated: true }, message: '更新成功' });

  } catch (err) {
    logger.error('[visitor-update] error:', err);
    res.status(500).json({ code: -1, message: '更新访客状态失败' });
  }
});

module.exports = router;
