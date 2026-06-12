/**
 * routes_apply.js - 角色申请路由（SQLite）
 *
 * 路由挂载：/v1/apply
 * 前端 API 定义见 services/api.js → APPLY
 *
 * 接口清单：
 *   POST /public-matchmaker       申请公益推荐官（免费，自动通过）
 *   POST /partner-matchmaker      申请联创推荐官（含支付，审核制）
 *   POST /professional-recommender 申请专业推荐官（含支付，审核制）
 *   POST /city-franchisee         申请城市合伙人（含支付，审核制）
 *   POST /community-station       申请社区服务站（审核制）
 *   GET  /status                  查询申请状态
 *
 * 核心原则：现有用户数据不修改，仅对新申请操作生效。
 * 推荐码前缀规则（与 routes_referral-codes.js 保持一致）：
 *   GYRG = 公益推荐官, LCRG = 联创推荐官, ZYRG = 专业推荐官,
 *   SQZD = 社区服务站, CSHH = 城市合伙人
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');
const logger = require('./utils/logger');

const router = express.Router();

// 五类身份推荐码前缀映射
const CODE_PREFIX_MAP = {
  'public_matchmaker': 'GYRG',        // 公益推荐官
  'partner_matchmaker': 'LCRG',       // 联创推荐官
  'professional_recommender': 'ZYRG', // 专业推荐官
  'community_station': 'SQZD',        // 社区服务站
  'city_franchisee': 'CSHH',          // 城市合伙人
};

// 五类身份 → referral_codes.code_type 映射
const ROLE_TO_CODE_TYPE = {
  'public_matchmaker': 'public_welfare',
  'partner_matchmaker': 'creator',
  'professional_recommender': 'professional',
  'community_station': 'community_station',
  'city_franchisee': 'city_partner',
};

/**
 * 生成唯一推荐码（SQLite 版本）
 * @param {Object} db - better-sqlite3 实例
 * @param {string} role - 用户角色
 * @returns {string} 生成的推荐码
 */
function generateUniqueCode(db, role) {
  const prefix = CODE_PREFIX_MAP[role] || 'GYRG';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = prefix + suffix;
    // 同时检查 referral_codes 表和 users 表（兼容既有旧格式推荐码）
    const existsInCodes = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
    const existsInUsers = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
    if (!existsInCodes && !existsInUsers) {
      return code;
    }
  }
  // 极端情况回退：加时间戳后缀
  const fallbackCode = prefix + Date.now().toString(36).slice(-4).toUpperCase();
  return fallbackCode;
}

/**
 * 检查用户是否已有推荐码（兼容两种存储方式）
 * @param {Object} db - better-sqlite3 实例
 * @param {number} userId - 用户ID
 * @returns {string|null} 用户的推荐码（如有），否则 null
 */
function getUserExistingCode(db, userId) {
  const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId);
  if (user && user.referral_code) {
    return user.referral_code;
  }
  // 也检查 referral_codes 表
  const codeRow = db.prepare(
    'SELECT code FROM referral_codes WHERE referrer_id = ? AND status = ? LIMIT 1'
  ).get(userId, 'active');
  return codeRow ? codeRow.code : null;
}

// ========================================================
// POST /v1/apply/public-matchmaker
// 申请公益推荐官（免费，自动审核通过）
// ========================================================
router.post('/public-matchmaker', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.userId;
    const { real_name, gender, age, phone } = req.body;

    // 参数校验
    if (!real_name || typeof real_name !== 'string' || real_name.trim().length < 2) {
      return res.json({ code: -1, message: '请输入真实姓名（至少2个字）' });
    }

    // 1. 检查该用户是否已经是推荐官角色
    const user = db.prepare('SELECT id, role, referral_code FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' });
    }

    // 如果已经是公益推荐官或更高级别，返回成功（幂等）
    const higherRoles = ['public_matchmaker', 'partner_matchmaker', 'professional_recommender', 'city_franchisee', 'community_station'];
    if (higherRoles.includes(user.role)) {
      // 已有推荐码则直接返回
      const existingCode = getUserExistingCode(db, userId);
      return res.json({
        code: 0,
        data: {
          role: user.role,
          recommendCode: existingCode || user.referral_code || '',
          message: '您已经是推荐官',
        },
        message: '申请成功',
      });
    }

    // 2. 生成或复用推荐码
    let code = user.referral_code;
    if (!code) {
      // 生成公益推荐官推荐码（GYRG + 4位随机）
      code = generateUniqueCode(db, 'public_matchmaker');

      // 事务：创建推荐码 + 更新用户
      const applyTransaction = db.transaction(() => {
        // 插入 referral_codes 表
        db.prepare(`
          INSERT INTO referral_codes (code, code_type, referrer_id, status, created_by, use_count, max_uses, created_at)
          VALUES (?, ?, ?, 'active', ?, 0, 0, datetime('now'))
        `).run(code, 'public_welfare', userId, userId);

        // 更新用户角色和推荐码
        db.prepare(`
          UPDATE users SET role = ?, referral_code = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run('public_matchmaker', code, userId);
      });

      applyTransaction();
    } else {
      // 已有推荐码，只需更新角色
      db.prepare(`
        UPDATE users SET role = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run('public_matchmaker', userId);
    }

    logger.info(`[apply] 用户${userId} 申请公益推荐官成功，推荐码: ${code}`);

    res.json({
      code: 0,
      data: {
        role: 'public_matchmaker',
        recommendCode: code || user.referral_code || '',
      },
      message: '申请成功，已自动通过审核',
    });

  } catch (err) {
    logger.error('[apply] public-matchmaker error:', err);
    res.json({ code: -1, message: '申请失败，请稍后重试', error: err.message });
  }
});

// ========================================================
// POST /v1/apply/partner-matchmaker
// 申请联创推荐官（提交资料，后续通过支付完成）
// ========================================================
router.post('/partner-matchmaker', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.userId;

    // 联创推荐官：前端提交资料后引导支付，角色升级在支付回调中处理
    // 此处仅记录申请意向，支付成功后在 /payment/notify 中升级角色并生成推荐码

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' });
    }

    // 如果已经是联创推荐官，幂等返回
    if (user.role === 'partner_matchmaker') {
      const existingCode = getUserExistingCode(db, userId);
      return res.json({
        code: 0,
        data: { role: 'partner_matchmaker', recommendCode: existingCode || '' },
        message: '您已经是联创推荐官',
      });
    }

    // 记录申请（写入 apply_records 表，如不存在则建表）
    try {
      db.prepare(`
        INSERT OR REPLACE INTO apply_records (user_id, target_role, status, created_at, updated_at)
        VALUES (?, 'partner_matchmaker', 'pending', datetime('now'), datetime('now'))
      `).run(userId);
    } catch (e) {
      // 表不存在则创建
      if (e.message && e.message.includes('no such table')) {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS apply_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            target_role TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        db.prepare(`
          INSERT INTO apply_records (user_id, target_role, status, created_at, updated_at)
          VALUES (?, 'partner_matchmaker', 'pending', datetime('now'), datetime('now'))
        `).run(userId);
      } else {
        throw e;
      }
    }

    logger.info(`[apply] 用户${userId} 提交联创推荐官申请`);

    res.json({
      code: 0,
      data: { status: 'pending', message: '资料已提交，请完成支付' },
      message: '资料提交成功',
    });

  } catch (err) {
    logger.error('[apply] partner-matchmaker error:', err);
    res.json({ code: -1, message: '提交失败，请稍后重试' });
  }
});

// ========================================================
// GET /v1/apply/status
// 查询用户申请状态
// ========================================================
router.get('/status', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.userId;

    const user = db.prepare('SELECT id, role, referral_code FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.json({ code: -1, message: '用户不存在' });
    }

    // 从用户角色推断申请状态
    const roleStatusMap = {
      'public_matchmaker': 'approved',
      'partner_matchmaker': 'approved',
      'professional_recommender': 'approved',
      'city_franchisee': 'approved',
      'community_station': 'approved',
      'user': 'none',
    };

    const applyStatus = roleStatusMap[user.role] || 'none';

    // 检查是否有待审核的申请记录
    let pendingRecord = null;
    try {
      pendingRecord = db.prepare(
        "SELECT target_role, status, created_at FROM apply_records WHERE user_id = ? AND status = 'pending' LIMIT 1"
      ).get(userId);
    } catch (e) {
      // 表不存在则忽略
    }

    const roleNames = {
      'public_matchmaker': '公益推荐官',
      'partner_matchmaker': '联创推荐官',
      'professional_recommender': '专业推荐官',
      'city_franchisee': '城市合伙人',
      'community_station': '社区服务站',
    };

    let recommendCode = user.referral_code;
    if (!recommendCode) {
      const codeRow = db.prepare(
        'SELECT code FROM referral_codes WHERE referrer_id = ? AND status = ? LIMIT 1'
      ).get(userId, 'active');
      recommendCode = codeRow ? codeRow.code : null;
    }

    res.json({
      code: 0,
      data: {
        role: user.role,
        role_name: roleNames[user.role] || '',
        apply_status: applyStatus,
        recommendCode: recommendCode || '',
        pending_apply: pendingRecord ? {
          target_role: pendingRecord.target_role,
          status: pendingRecord.status,
          created_at: pendingRecord.created_at,
        } : null,
      },
      message: '查询成功',
    });

  } catch (err) {
    logger.error('[apply] status error:', err);
    res.json({ code: -1, message: '查询失败' });
  }
});

// ========================================================
// 专业推荐官、城市合伙人、社区服务站 — 暂用统一占位
// 后续由管理后台审核流程对接
// ========================================================

router.post('/professional-recommender', requireAuth, (req, res) => {
  res.json({ code: -1, message: '专业推荐官申请功能开发中，请联系管理员' });
});

router.post('/city-franchisee', requireAuth, (req, res) => {
  res.json({ code: -1, message: '城市合伙人申请功能开发中，请联系管理员' });
});

router.post('/community-station', requireAuth, (req, res) => {
  res.json({ code: -1, message: '社区服务站申请功能开发中，请联系管理员' });
});

module.exports = router;
