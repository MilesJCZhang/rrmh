/**
 * routes_auth.js - 认证相关路由（真实实现）
 * 微信登录、手机号绑定
 *
 * 数据库：使用 app.get('db') 共享连接，不再每次请求新建连接
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { calculateUserRoles } = require('./utils/roleUtils');

// 微信配置（从环境变量读取，未配置时拒绝启动）
const WX_APPID = process.env.WX_APPID;
const WX_SECRET = process.env.WX_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
if (!WX_APPID || !WX_SECRET || !JWT_SECRET) {
  console.error('[routes_auth] FATAL: WX_APPID, WX_SECRET, JWT_SECRET 环境变量必须设置');
  process.exit(1);
}

// 全局缓存 access_token
let ACCESS_TOKEN = null;
let AT_EXPIRE = 0;

// 确保 user_referrals 表存在
function ensureUserReferralsTable(db) {
  db.exec(`
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
  `);
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals(referrer_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_referrals_user ON user_referrals(user_id)');
  } catch (e) { /* ignore */ }
}

/**
 * 获取微信 access_token
 */
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (now < AT_EXPIRE) {
    return ACCESS_TOKEN;
  }

  try {
    const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: WX_APPID,
        secret: WX_SECRET,
      },
    });

    ACCESS_TOKEN = res.data.access_token;
    AT_EXPIRE = now + 7000; // 提前200秒刷新
    return ACCESS_TOKEN;
  } catch (error) {
    console.error('获取 access_token 失败:', error.message);
    throw new Error('获取 access_token 失败');
  }
}

/**
 * POST /v1/auth/wechat-login
 * 微信登录（真实实现）
 */
router.post('/wechat-login', async (req, res) => {
  const db = req.app.get('db');

  try {
    const { code, referrer_id, referral_code } = req.body;

    if (!code) {
      return res.json({
        code: -1,
        message: '缺少微信登录code'
      });
    }

    // 1. 调用微信 code2Session 获取 openid
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: WX_APPID,
        secret: WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code',
      },
    });

    if (wxRes.data.errcode) {
      return res.json({
        code: -1,
        message: '微信登录失败：' + wxRes.data.errmsg,
      });
    }

    const { openid, session_key } = wxRes.data;

    // 2. 查询用户是否已存在
    let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);

    if (!user) {
      // 3. 新用户，插入记录（自动绑定推荐人）
      const referrerIdNum = referrer_id ? parseInt(referrer_id) : null;

      const info = db.prepare(`
        INSERT INTO users (openid, parent_id, created_at)
        VALUES (?, ?, datetime('now'))
      `).run(openid, referrerIdNum);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

      // 新用户也写入 user_referrals 表（修复统计丢失问题）
      if (referrerIdNum) {
        ensureUserReferralsTable(db);
        try {
          db.prepare(`
            INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
            VALUES (?, ?, ?, datetime('now'), 1)
          `).run(user.id, referrerIdNum, referral_code || null);
          console.log(`[wechat-login] 新用户写入 user_referrals: user ${user.id} → referrer ${referrerIdNum}`);
        } catch (e) {
          console.error('[wechat-login] 写入 user_referrals 失败:', e.message);
        }
      }
    } else {
      // 已有用户：若 parent_id 为 null 且本次带来了 referrer_id，补填（永久锁定，只允许从 null → 有值）
      if (user.parent_id === null && referrer_id) {
        const referrerIdNum = parseInt(referrer_id);
        db.prepare(`UPDATE users SET parent_id = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(referrerIdNum, user.id);
        console.log(`[wechat-login] 补填 parent_id: user ${user.id} → ${referrerIdNum}`);
        user.parent_id = referrerIdNum;

        // 同时写入 user_referrals 表（修复统计丢失问题）
        ensureUserReferralsTable(db);
        try {
          const existing = db.prepare('SELECT id FROM user_referrals WHERE user_id = ?').get(user.id);
          if (!existing) {
            db.prepare(`
              INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
              VALUES (?, ?, ?, datetime('now'), 1)
            `).run(user.id, referrerIdNum, referral_code || null);
            console.log(`[wechat-login] 写入 user_referrals: user ${user.id} → referrer ${referrerIdNum}`);
          }
        } catch (e) {
          console.error('[wechat-login] 写入 user_referrals 失败:', e.message);
        }
      }
    }

    // 4. 计算用户的角色列表
    const roleList = calculateUserRoles(db, user);

    // 5. 生成 JWT Token
    const token = jwt.sign(
      { uid: user.id, openid: user.openid },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. 返回结果
    res.json({
      code: 0,
      data: {
        token,
        openid,
        userId: user.id,
        phone: user.phone || null,
        isNewUser: !user,
        role: user.role || 'user',
        roleList: roleList,
      },
      message: '登录成功'
    });

  } catch (error) {
    console.error('[Auth] 微信登录失败:', error);
    res.json({
      code: -1,
      message: '登录失败，请重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /v1/auth/bind-phone
 * 绑定手机号
 */
router.post('/bind-phone', async (req, res) => {
  const db = req.app.get('db');

  try {
    // 1. 验证 JWT Token
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.json({
        code: -1,
        message: '未登录'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.json({
        code: -1,
        message: 'Token 无效或已过期'
      });
    }

    const userId = payload.uid;
    const { code } = req.body;

    if (!code) {
      return res.json({
        code: -1,
        message: '缺少 code 参数'
      });
    }

    // 2. 获取 access_token
    const accessToken = await getAccessToken();

    // 3. 调用微信 API 获取手机号
    const phoneRes = await axios.post(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      { code },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (phoneRes.data.errcode !== 0) {
      return res.json({
        code: -1,
        message: '获取手机号失败：' + phoneRes.data.errmsg,
      });
    }

    const phoneNumber = phoneRes.data.phone_info.phoneNumber;

    // 4. 更新用户手机号
    db.prepare('UPDATE users SET phone = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(phoneNumber, userId);

    // 5. 返回成功
    res.json({
      code: 0,
      data: {
        phone: phoneNumber,
      },
      message: '手机号绑定成功'
    });

  } catch (error) {
    console.error('[Auth] 绑定手机号失败:', error);
    res.json({
      code: -1,
      message: '绑定失败，请重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /v1/auth/logout
 * 退出登录
 */
router.post('/logout', (req, res) => {
  // 在实际应用中，应该将 token 加入黑名单或删除客户端的 token
  res.json({
    code: 0,
    message: '退出成功'
  });
});

/**
 * GET /v1/auth/userinfo
 * 获取用户信息
 */
router.get('/userinfo', (req, res) => {
  const db = req.app.get('db');

  try {
    // 验证 Token
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.json({
        code: -1,
        message: '未登录'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.json({
        code: -1,
        message: 'Token 无效或已过期'
      });
    }

    // 查询用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);

    if (!user) {
      return res.json({
        code: -1,
        message: '用户不存在'
      });
    }

    // 计算用户的角色列表
    const roleList = calculateUserRoles(db, user);

    res.json({
      code: 0,
      data: {
        id: user.id,
        openid: user.openid,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        parentId: user.parent_id,
        createdAt: user.created_at,
        role: user.role || 'user',
        roleList: roleList,
      },
    });

  } catch (error) {
    console.error('[Auth] 获取用户信息失败:', error);
    res.json({
      code: -1,
      message: '获取失败'
    });
  }
});

/**
 * POST /v1/auth/refresh
 * 刷新 Access Token
 */
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ code: -1, message: '缺少 refresh_token' });
  }
  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET);
    // 生成新 access token（不刷新 refresh token，避免无限刷新）
    const newToken = jwt.sign(
      { uid: payload.uid, openid: payload.openid },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ code: 0, data: { token: newToken } });
  } catch (e) {
    res.status(401).json({ code: -1, message: 'refresh_token 无效或已过期' });
  }
});

/**
 * POST /v1/auth/login
 * 管理员账号密码登录（管理后台使用）
 */
router.post('/login', (req, res) => {
  const db = req.app.get('db');

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: -1, message: '请输入用户名和密码' });
    }

    // 查询管理员用户
    const user = db.prepare('SELECT id, username, password, nickname, role FROM users WHERE username = ?').get(username.trim());

    if (!user) {
      return res.json({ code: -1, message: '用户名或密码错误' });
    }

    // 验证密码（SHA256 哈希）
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password !== inputHash) {
      return res.json({ code: -1, message: '用户名或密码错误' });
    }

    // 检查是否为管理员
    if (user.role !== 'admin') {
      return res.json({ code: -1, message: '无管理员权限' });
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { userId: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      code: 0,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          role: user.role,
        },
      },
      message: '登录成功',
    });

  } catch (error) {
    console.error('[auth] 管理员登录失败:', error);
    res.json({ code: -1, message: '登录失败，请重试' });
  }
});

module.exports = router;
