/**
 * routes_referral.js - 用户端推荐关系接口（SQLite）
 *
 * 路由挂载：/v1/referral
 * 前端 API 定义见 services/api.js → REFERRAL
 *
 * 接口清单：
 *   POST /bind           绑定推荐关系（核心接口）
 *   GET  /info           获取推荐人信息（无需登录）
 *   GET  /my-list        我推荐的用户列表
 *   GET  /my-insight     我的推荐洞察
 *   GET  /my-code        获取我的推荐码
 */

const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const { requireAuth, optionalAuth } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 共享数据库连接
function getDb(req) {
  return req.app.get('db');
}

// ═══════════════════════════════════════════════
// POST /v1/referral/bind
// 绑定推荐关系（用户端，需登录）
//
// 请求体（三选一）：
//   { referrer_id: number }                       — 通过推荐人ID绑定
//   { referral_code: string }                      — 通过推荐码绑定（如 LCRG001）
//   { referrer_id: number, referral_code: string } — 两者都传，推荐码优先
//
// 前端 utils/referral.js 调用方式：
//   bindReferrer(referrerId, code) → 发送 { referrer_id, referral_code }
// ═══════════════════════════════════════════════
router.post('/bind', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;
    const { referrer_id, referral_code } = req.body;

    // 兼容前端旧字段名
    const finalReferralCode = referral_code || req.body.code || req.body.recommendCode || null;
    const finalReferrerId = referrer_id || null;

    let resolvedReferrerId = finalReferrerId;
    let resolvedCode = finalReferralCode ? String(finalReferralCode).toUpperCase() : null;

    // 1. 如果传了推荐码，验证并解析出 referrer_id
    if (resolvedCode && !resolvedReferrerId) {
      const codeRow = db.prepare(
        `SELECT id, code, code_type, referrer_id, referrer_name, status, use_count, max_uses, expires_at
         FROM referral_codes WHERE code = ?`
      ).get(resolvedCode);

      if (!codeRow) {
        return res.status(400).json({ code: -1, message: '推荐码不存在' });
      }
      if (codeRow.status !== 'active') {
        return res.status(400).json({ code: -1, message: '推荐码已失效' });
      }
      if (codeRow.max_uses > 0 && codeRow.use_count >= codeRow.max_uses) {
        return res.status(400).json({ code: -1, message: '推荐码使用次数已达上限' });
      }
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        return res.status(400).json({ code: -1, message: '推荐码已过期' });
      }
      if (!codeRow.referrer_id) {
        return res.status(400).json({ code: -1, message: '推荐码尚未分配推荐官，请联系管理员' });
      }

      resolvedReferrerId = codeRow.referrer_id;
    }

    // 2. 必须有推荐人ID
    if (!resolvedReferrerId) {
      return res.status(400).json({ code: -1, message: '请提供推荐人ID或推荐码' });
    }

    // 3. 不能绑定自己
    if (Number(resolvedReferrerId) === Number(userId)) {
      return res.status(400).json({ code: -1, message: '不能绑定自己为推荐人' });
    }

    // 4. 验证推荐人是否存在
    const referrer = db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(resolvedReferrerId);
    if (!referrer) {
      return res.status(404).json({ code: -1, message: '推荐人不存在' });
    }

    // 5. 检查是否已经绑定过（永久锁定）
    const existingBinding = db.prepare(
      'SELECT referrer_id FROM user_referrals WHERE user_id = ? AND is_locked = 1'
    ).get(userId);

    if (existingBinding) {
      // 已锁定 → 返回现有绑定信息（幂等）
      const existingReferrer = db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(existingBinding.referrer_id);
      return res.json({
        code: 0,
        data: {
          bound: true,
          locked: true,
          isNew: false,
          referrer_info: {
            id: existingReferrer?.id || existingBinding.referrer_id,
            name: existingReferrer?.nickname || '',
            role: existingReferrer?.role || '',
          },
        },
      });
    }

    // 6. 创建绑定关系（事务）
    const bindResult = db.transaction(() => {
      // 写入 user_referrals
      try {
        db.prepare(`
          INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
          VALUES (?, ?, ?, datetime('now'), 1)
        `).run(userId, resolvedReferrerId, resolvedCode || null);
      } catch (e) {
        // 如果没有 user_referrals 表，尝试建表后重试
        if (e.message && e.message.includes('no such table')) {
          db.prepare(`
            CREATE TABLE IF NOT EXISTS user_referrals (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              referrer_id INTEGER NOT NULL,
              referral_code TEXT,
              bind_time TEXT,
              is_locked INTEGER DEFAULT 1,
              created_at TEXT DEFAULT (datetime('now')),
              UNIQUE(user_id)
            )
          `).run();
          db.prepare(`
            INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
            VALUES (?, ?, ?, datetime('now'), 1)
          `).run(userId, resolvedReferrerId, resolvedCode || null);
        } else {
          throw e;
        }
      }

      // 更新 users 表的 referrer_id
      try {
        db.prepare('UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)')
          .run(resolvedReferrerId, userId);
      } catch (e) {
        // users 表可能没有 referrer_id 列，忽略
        logger.debug('[referral] update users.referrer_id skipped:', e.message);
      }

      // 如果使用了推荐码，更新使用次数
      if (resolvedCode) {
        db.prepare(`
          UPDATE referral_codes
          SET use_count = use_count + 1,
              last_used_at = datetime('now'),
              last_bound_user_id = ?,
              last_bound_at = datetime('now')
          WHERE code = ?
        `).run(userId, resolvedCode);
      }
    })();

    // 7. 返回结果
    logger.info(`[referral] 用户${userId}绑定推荐人${resolvedReferrerId}成功`);
    res.json({
      code: 0,
      data: {
        bound: true,
        locked: true,
        isNew: true,
        referrer_info: {
          id: referrer.id,
          name: referrer.nickname,
          role: referrer.role,
        },
      },
    });

  } catch (err) {
    logger.error('[referral] bind error:', err);
    res.status(500).json({ code: -1, message: '绑定失败，请稍后重试' });
  }
});

// ═══════════════════════════════════════════════
// GET /v1/referral/info
// 获取推荐人信息（无需登录）
// Query: referrer_id
// ═══════════════════════════════════════════════
router.get('/info', optionalAuth, (req, res) => {
  try {
    const db = getDb(req);
    const { referrer_id } = req.query;

    if (!referrer_id) {
      return res.status(400).json({ code: -1, message: '推荐人ID不能为空' });
    }

    const user = db.prepare(
      'SELECT id, nickname, avatar_url, role, matchmaker_level FROM users WHERE id = ?'
    ).get(referrer_id);

    if (!user) {
      return res.status(404).json({ code: -1, message: '推荐人不存在' });
    }

    res.json({
      code: 0,
      data: {
        id: user.id,
        name: user.nickname,
        avatar: user.avatar_url,
        role: user.role,
        matchmaker_level: user.matchmaker_level,
      },
    });

  } catch (err) {
    logger.error('[referral] info error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// ═══════════════════════════════════════════════
// GET /v1/referral/my-list
// 我推荐的用户列表（需登录）
// ═══════════════════════════════════════════════
router.get('/my-list', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    const rows = db.prepare(`
      SELECT ur.user_id, ur.bind_time, ur.created_at,
             u.nickname, u.avatar_url, u.role
      FROM user_referrals ur
      LEFT JOIN users u ON ur.user_id = u.id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1
      ORDER BY ur.created_at DESC
      LIMIT 100
    `).all(userId);

    res.json({
      code: 0,
      data: {
        list: rows.map(r => ({
          user_id: r.user_id,
          nickname: r.nickname,
          avatar: r.avatar_url,
          role: r.role,
          bind_time: r.bind_time,
        })),
      },
    });

  } catch (err) {
    logger.error('[referral] my-list error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// ═══════════════════════════════════════════════
// GET /v1/referral/my-insight
// 我的推荐洞察数据（需登录）
// ═══════════════════════════════════════════════
router.get('/my-insight', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    // 总推荐人数
    const totalRow = db.prepare(
      "SELECT COUNT(*) as total FROM user_referrals WHERE referrer_id = ? AND is_locked = 1"
    ).get(userId);

    // 本月新增
    const monthRow = db.prepare(`
      SELECT COUNT(*) as total FROM user_referrals
      WHERE referrer_id = ? AND is_locked = 1
        AND created_at >= datetime('now', 'start of month')
    `).get(userId);

    // 推荐码信息
    const codeRow = db.prepare(`
      SELECT code, code_type, status, use_count, max_uses, created_at
      FROM referral_codes
      WHERE referrer_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId);

    // 推荐用户列表（最近10人）
    const referredUsers = db.prepare(`
      SELECT ur.user_id as id, u.nickname, u.avatar, u.role, u.gender, u.age,
             ur.bind_time, ur.created_at as ref_created_at
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1
      ORDER BY ur.created_at DESC LIMIT 10
    `).all(userId);

    // 推荐链（我推荐的人 + 他们推荐的人）
    const chain = db.prepare(`
      SELECT ur.user_id as id, u.nickname, u.avatar, u.role, u.gender, u.age,
             ur.bind_time, ur.created_at as createdAt
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1
      ORDER BY ur.created_at DESC LIMIT 20
    `).all(userId);

    res.json({
      code: 0,
      data: {
        total_referrals: totalRow?.total || 0,
        month_referrals: monthRow?.total || 0,
        code_info: codeRow ? {
          code: codeRow.code,
          code_type: codeRow.code_type,
          status: codeRow.status,
          use_count: codeRow.use_count,
          max_uses: codeRow.max_uses,
          created_at: codeRow.created_at,
        } : null,
        referred_users: referredUsers || [],
        referral_chain: chain || [],
        stats: {
          total_referred: totalRow?.total || 0,
          month_referred: monthRow?.total || 0,
        },
      },
    });

  } catch (err) {
    logger.error('[referral] my-insight error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// ═══════════════════════════════════════════════
// GET /v1/referral/my-code
// 获取我的推荐码（需登录）
// ═══════════════════════════════════════════════
router.get('/my-code', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    const codeRow = db.prepare(`
      SELECT code, code_type, status, use_count, max_uses
      FROM referral_codes
      WHERE referrer_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    if (!codeRow) {
      return res.json({ code: 0, data: { has_code: false } });
    }

    res.json({
      code: 0,
      data: {
        has_code: true,
        code: codeRow.code,
        code_type: codeRow.code_type,
        status: codeRow.status,
        use_count: codeRow.use_count,
        max_uses: codeRow.max_uses,
      },
    });

  } catch (err) {
    logger.error('[referral] my-code error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

// ═══════════════════════════════════════════════
// 推荐官工作台数据看板（新增）
// ═══════════════════════════════════════════════

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
  // 索引（忽略已存在的错误）
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_referrer ON visitor_logs(referrer_id)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_openid ON visitor_logs(visitor_openid)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_logs(reg_status)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_time ON visitor_logs(visit_time)'); } catch (e) {}
}

// ═══════════════════════════════════════════════
// GET /v1/referral/workbench-stats
// 推荐官工作台 - 四大分类统计数据（需登录）
// ═══════════════════════════════════════════════
router.get('/workbench-stats', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    // 确保 visitor_logs 表存在
    ensureVisitorLogsTable(db);

    // 1. 联创推荐官：通过本推荐官渠道入驻、角色为 partner_matchmaker 的用户
    const partnerRow = db.prepare(`
      SELECT COUNT(DISTINCT ur.user_id) as count
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'partner_matchmaker'
    `).get(userId);

    // 2. 公益推荐官：通过本推荐官渠道入驻、角色为 public_matchmaker 的用户
    const publicRow = db.prepare(`
      SELECT COUNT(DISTINCT ur.user_id) as count
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'public_matchmaker'
    `).get(userId);

    // 3. 已注册单身会员：通过本推荐官渠道注册、已支付 199 建档费的用户
    //    通过 orders 表 type='single_registration', status='paid' 判定
    const memberRow = db.prepare(`
      SELECT COUNT(DISTINCT ur.user_id) as count
      FROM user_referrals ur
      JOIN users u ON u.id = ur.user_id
      LEFT JOIN orders o ON o.user_id = ur.user_id AND o.type = 'single_registration' AND o.status = 'paid'
      WHERE ur.referrer_id = ? AND ur.is_locked = 1
        AND u.role = 'user'
        AND o.id IS NOT NULL
    `).get(userId);

    // 4. 未注册访客：visitor_logs 表中 reg_status='pending' 的记录
    const visitorRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM visitor_logs
      WHERE referrer_id = ? AND reg_status = 'pending'
    `).get(userId);

    res.json({
      code: 0,
      data: {
        partner_matchmaker_count: partnerRow?.count || 0,
        public_matchmaker_count: publicRow?.count || 0,
        registered_member_count: memberRow?.count || 0,
        visitor_count: visitorRow?.count || 0,
      },
    });

  } catch (err) {
    logger.error('[workbench] stats error:', err);
    res.status(500).json({ code: -1, message: '查询统计数据失败' });
  }
});

// ═══════════════════════════════════════════════
// GET /v1/referral/workbench-detail
// 推荐官工作台 - 分类明细列表（需登录）
// Query: { type, page, page_size, keyword }
// type: partner_matchmaker | public_matchmaker | registered_member | visitor
// ═══════════════════════════════════════════════
router.get('/workbench-detail', requireAuth, (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;
    const { type, page = 1, page_size = 10, keyword = '' } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * pageSize;
    const searchPattern = keyword ? `%${keyword}%` : '';

    let countSql, listSql, countParams, listParams;

    switch (type) {
      case 'partner_matchmaker':
        countSql = `
          SELECT COUNT(*) as total FROM (
            SELECT DISTINCT ur.user_id
            FROM user_referrals ur
            JOIN users u ON u.id = ur.user_id
            WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'partner_matchmaker'
            ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          )
        `;
        listSql = `
          SELECT DISTINCT ur.user_id as id, u.nickname, u.avatar, u.role,
                 CASE WHEN u.status = 1 OR u.status = 'active' THEN 'active' ELSE 'inactive' END as status,
                 u.created_at,
                 ur.bind_time, ur.created_at as ref_created_at
          FROM user_referrals ur
          JOIN users u ON u.id = ur.user_id
          WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'partner_matchmaker'
          ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          ORDER BY ur.created_at DESC
          LIMIT ? OFFSET ?
        `;
        countParams = searchPattern ? [userId, searchPattern] : [userId];
        listParams = searchPattern ? [userId, searchPattern, pageSize, offset] : [userId, pageSize, offset];
        break;

      case 'public_matchmaker':
        countSql = `
          SELECT COUNT(*) as total FROM (
            SELECT DISTINCT ur.user_id
            FROM user_referrals ur
            JOIN users u ON u.id = ur.user_id
            WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'public_matchmaker'
            ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          )
        `;
        listSql = `
          SELECT DISTINCT ur.user_id as id, u.nickname, u.avatar, u.role,
                 CASE WHEN u.status = 1 OR u.status = 'active' THEN 'active' ELSE 'inactive' END as status,
                 u.created_at,
                 ur.bind_time, ur.created_at as ref_created_at
          FROM user_referrals ur
          JOIN users u ON u.id = ur.user_id
          WHERE ur.referrer_id = ? AND ur.is_locked = 1 AND u.role = 'public_matchmaker'
          ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          ORDER BY ur.created_at DESC
          LIMIT ? OFFSET ?
        `;
        countParams = searchPattern ? [userId, searchPattern] : [userId];
        listParams = searchPattern ? [userId, searchPattern, pageSize, offset] : [userId, pageSize, offset];
        break;

      case 'registered_member':
        countSql = `
          SELECT COUNT(*) as total FROM (
            SELECT DISTINCT ur.user_id
            FROM user_referrals ur
            JOIN users u ON u.id = ur.user_id
            LEFT JOIN orders o ON o.user_id = ur.user_id AND o.type = 'single_registration' AND o.status = 'paid'
            WHERE ur.referrer_id = ? AND ur.is_locked = 1
              AND u.role = 'user'
              AND o.id IS NOT NULL
            ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          )
        `;
        listSql = `
          SELECT DISTINCT ur.user_id as id, u.nickname, u.avatar, u.role, u.status,
                 o.paid_at as join_time, u.created_at
          FROM user_referrals ur
          JOIN users u ON u.id = ur.user_id
          LEFT JOIN orders o ON o.user_id = ur.user_id AND o.type = 'single_registration' AND o.status = 'paid'
          WHERE ur.referrer_id = ? AND ur.is_locked = 1
            AND u.role = 'user'
            AND o.id IS NOT NULL
          ${searchPattern ? 'AND (u.nickname LIKE ?)' : ''}
          ORDER BY o.paid_at DESC
          LIMIT ? OFFSET ?
        `;
        countParams = searchPattern ? [userId, searchPattern] : [userId];
        listParams = searchPattern ? [userId, searchPattern, pageSize, offset] : [userId, pageSize, offset];
        break;

      case 'visitor':
        ensureVisitorLogsTable(db);
        countSql = `
          SELECT COUNT(*) as total
          FROM visitor_logs
          WHERE referrer_id = ? AND reg_status = 'pending'
          ${searchPattern ? 'AND (visitor_nickname LIKE ?)' : ''}
        `;
        listSql = `
          SELECT id, visitor_openid, visitor_nickname, visitor_avatar, visit_time
          FROM visitor_logs
          WHERE referrer_id = ? AND reg_status = 'pending'
          ${searchPattern ? 'AND (visitor_nickname LIKE ?)' : ''}
          ORDER BY visit_time DESC
          LIMIT ? OFFSET ?
        `;
        countParams = searchPattern ? [userId, searchPattern] : [userId];
        listParams = searchPattern ? [userId, searchPattern, pageSize, offset] : [userId, pageSize, offset];
        break;

      default:
        return res.status(400).json({ code: -1, message: '无效的分类类型' });
    }

    const countRow = db.prepare(countSql).get(...countParams);
    const total = countRow?.total || 0;
    const list = db.prepare(listSql).all(...listParams);

    // 格式化输出
    const formattedList = list.map(item => {
      if (type === 'visitor') {
        return {
          id: item.id,
          visitor_nickname: item.visitor_nickname || '访客',
          visitor_avatar: item.visitor_avatar || '',
          visit_time: item.visit_time || '',
        };
      }
      return {
        id: item.id,
        name: item.nickname || '未设置',
        avatar: item.avatar || '',
        nickname: item.nickname || '',
        role: item.role || '',
        status: item.status === 1 ? 'active' : 'inactive',
        joinTime: type === 'registered_member' ? (item.join_time || '') : (item.bind_time || item.ref_created_at || item.created_at || ''),
        createdAt: item.created_at || '',
      };
    });

    res.json({
      code: 0,
      data: {
        list: formattedList,
        total,
        page: pageNum,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      },
    });

  } catch (err) {
    logger.error('[workbench] detail error:', err);
    res.status(500).json({ code: -1, message: '查询明细列表失败' });
  }
});

// ═══════════════════════════════════════════════
// 微信小程序码缓存
// ═══════════════════════════════════════════════
let WX_ACCESS_TOKEN = null;
let WX_AT_EXPIRE = 0;

async function getWxAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (now < WX_AT_EXPIRE && WX_ACCESS_TOKEN) {
    return WX_ACCESS_TOKEN;
  }
  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appid || !secret) {
    throw new Error('WX_APPID或WX_SECRET未配置');
  }
  try {
    const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid, secret },
    });
    WX_ACCESS_TOKEN = res.data.access_token;
    WX_AT_EXPIRE = now + 7000; // 提前200秒刷新
    return WX_ACCESS_TOKEN;
  } catch (error) {
    logger.error('[referral] 获取微信access_token失败:', error.message);
    throw new Error('获取access_token失败');
  }
}

// ═══════════════════════════════════════════════
// GET /v1/referral/miniapp-qrcode
// 生成小程序码（需登录，有推荐码）
// ═══════════════════════════════════════════════
router.get('/miniapp-qrcode', requireAuth, async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user.userId;

    // 查询用户的推荐码
    const codeRow = db.prepare(`
      SELECT code FROM referral_codes
      WHERE referrer_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId);

    if (!codeRow) {
      return res.json({ code: -1, message: '暂无推荐码，请先获取推荐码后再生成二维码' });
    }

    const code = codeRow.code;

    // 1️⃣ 生成普通二维码（明文携带推荐码，供 wx.scanCode 识别）
    let qrCodeBase64 = '';
    try {
      const qrBuffer = await QRCode.toBuffer(code, {
        type: 'png',
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      qrCodeBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
    } catch (qrErr) {
      logger.warn('[referral] 普通二维码生成失败，退化为仅返回小程序码:', qrErr.message);
    }

    // 2️⃣ 获取微信 access_token，生成小程序码
    const accessToken = await getWxAccessToken();

    const qrRes = await axios.post(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      {
        scene: code,
        page: 'pages/index/index',
        check_path: false,
        env_version: 'trial',
        width: 280,
      },
      { responseType: 'arraybuffer' }
    );

    const base64 = Buffer.from(qrRes.data).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    res.json({
      code: 0,
      data: {
        qrcodeBase64: dataUrl,       // 小程序码（太阳码）— 分享到好友/朋友圈
        qrCodeBase64: qrCodeBase64,  // 普通二维码 — 小程序内 wx.scanCode 扫码绑定
      },
    });

  } catch (err) {
    logger.error('[referral] miniapp-qrcode error:', err);
    res.status(500).json({ code: -1, message: '生成二维码失败: ' + (err.message || '未知错误') });
  }
});

module.exports = router;
