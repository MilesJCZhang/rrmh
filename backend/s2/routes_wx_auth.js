/**
 * 微信登录和手机号绑定路由
 * 替代Flask版本的 wx_login 和 bind_phone 接口
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// 微信配置（从环境变量读取，未配置时拒绝启动）
const WX_APPID = process.env.WX_APPID;
const WX_SECRET = process.env.WX_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
if (!WX_APPID || !WX_SECRET || !JWT_SECRET) {
  console.error('[routes_wx_auth] FATAL: WX_APPID, WX_SECRET, JWT_SECRET 环境变量必须设置');
  process.exit(1);
}

// 数据库使用 app.get('db') 共享连接

// 全局缓存 access_token
let ACCESS_TOKEN = null;
let AT_EXPIRE = 0;

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
 * 微信登录接口
 * POST /api/wx/login
 * Body: { code, scene: { inviter } }
 */
router.post('/login', async (req, res) => {
  const db = req.app.get('db');

  try {
    const { code, scene = {} } = req.body;
    const inviterId = scene.inviter || null;

    if (!code) {
      return res.status(400).json({ code: -1, message: '缺少 code 参数' });
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
      return res.status(400).json({
        code: -1,
        message: '微信登录失败',
        error: wxRes.data.errmsg,
      });
    }

    const { openid, session_key } = wxRes.data;

    // 2. 查询用户是否已存在
    let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);

    if (!user) {
      // 3. 新用户，插入记录（自动绑定上下级）
      const inviterIdNum = inviterId ? parseInt(inviterId) : null;
      
      const info = db.prepare(`
        INSERT INTO users (openid, parent_id, created_at)
        VALUES (?, ?, datetime('now'))
      `).run(openid, inviterIdNum);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      // 已有用户：若 parent_id 为 null 且本次带来了 inviterId，补填（永久锁定，只允许从 null → 有值）
      if (user.parent_id === null && inviterId) {
        const inviterIdNum = parseInt(inviterId);
        db.prepare(`UPDATE users SET parent_id = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(inviterIdNum, user.id);
        console.log(`[wx/login] 补填 parent_id: user ${user.id} → ${inviterIdNum}`);
        user.parent_id = inviterIdNum;
      }
    }

    // 4. 生成 JWT Token
    const token = jwt.sign(
      { uid: user.id, openid: user.openid },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. 返回结果
    res.json({
      code: 0,
      data: {
        token,
        openid,
        userId: user.id,
        phone: user.phone || null,
        isNewUser: !user,
      },
    });

  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({
      code: -1,
      message: '登录失败，请重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * 绑定手机号接口
 * POST /api/wx/bind-phone
 * Header: Authorization: Bearer <token>
 * Body: { code }
 */
router.post('/bind-phone', async (req, res) => {
  const db = req.app.get('db');

  try {
    // 1. 验证 JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ code: -1, message: '未登录' });
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ code: -1, message: 'Token 无效或已过期' });
    }

    const userId = payload.uid;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ code: -1, message: '缺少 code 参数' });
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
      return res.status(400).json({
        code: -1,
        message: '获取手机号失败',
        error: phoneRes.data.errmsg,
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
      message: '手机号绑定成功',
    });

  } catch (error) {
    console.error('绑定手机号错误:', error);
    res.status(500).json({
      code: -1,
      message: '绑定失败，请重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * 获取用户信息
 * GET /api/wx/userinfo
 * Header: Authorization: Bearer <token>
 */
router.get('/userinfo', (req, res) => {
  const db = req.app.get('db');

  try {
    // 验证 Token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ code: -1, message: '未登录' });
    }

    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ code: -1, message: 'Token 无效或已过期' });
    }

    // 查询用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);

    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

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
      },
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ code: -1, message: '获取失败' });
  }
});

module.exports = router;
