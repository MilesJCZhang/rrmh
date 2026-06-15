// server.js - 人人媒好后端服务入口
require('dotenv').config();  // 加载环境变量
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./utils/logger');

const app = express();

// CORS 配置：根据环境变量限制允许的域名
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length > 0 && process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: function (origin, callback) {
      // 允许无 origin 的请求（如服务端调用、Postman）
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('[CORS] 拒绝来源:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
} else {
  // 开发环境允许所有来源
  app.use(cors());
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 数据库连接
const db = new Database(path.join(__dirname, 'renrenmei.db'));
logger.info('数据库连接成功');

// 将 db 挂载到 app 供路由使用
app.set('db', db);

// ===== 路由注册 =====
// 前端统一使用 /v1 前缀，后端路由挂载需保持一致

// 先加载认证中间件（供后续路由使用）
const { requireAuth, requireAdmin } = require('./auth-middleware');

// 1. 配置路由（必须放在认证路由之前）
app.use('/v1/config', require('./routes_config'));

// 1.1 评分路由（放在认证之前，部分端点无需登录）
app.use('/v1/score', require('./routes_score'));

// 1.2 匹配推荐路由（需登录，含分层过滤）
app.use('/v1/match', requireAuth, require('./routes_match'));

// 1.3 线上解锁路由（需登录）
app.use('/v1/unlock', requireAuth, require('./routes_unlock'));

// 1.4 沙龙路由（需登录，含3男3女分组）
app.use('/v1/salon', requireAuth, require('./routes_salon'));

// 1.5 高端验资匹配路由（需登录）
app.use('/v1/premium', requireAuth, require('./routes_premium'));

// 2. 认证路由
app.use('/v1/auth', require('./routes_auth'));

// 3. 用户路由
app.use('/v1/user', require('./routes_user') || createUserRoutes());

// 3.1 访客日志路由（无需登录，放在 requireAuth 路由之前）
app.use('/v1/referral', require('./routes_referral_visitor'));

// 4. 推荐码管理路由（管理端，需要管理员权限）
app.use('/v1/admin/referral-codes', requireAuth, requireAdmin, require('./routes_referral-codes'));

// 4.1 推荐码用户端路由（需登录）
app.use('/v1/referral-codes', requireAuth, require('./routes_referral-codes'));

// 5. 推荐关系路由（用户端，需登录，无需管理员权限）
app.use('/v1/referral', requireAuth, require('./routes_referral'));

// 5.1 会员建档路由
app.use('/v1/member', requireAuth, require('./routes_member'));

// 5.2 实名认证路由
app.use('/v1/verify', requireAuth, require('./routes_verify'));

// 5.3 推荐官工作台路由
app.use('/v1/matchmaker', requireAuth, require('./routes_matchmaker'));

// 5.4 统计概览路由
app.use('/v1/stats', require('./routes_stats'));

// 6. 支付路由
try {
  app.use('/v1/payment', require('./routes_payment'));
} catch (e) {
  console.log('[server] routes_payment 加载失败，跳过');
}

// 7. 服务站管理路由
try {
  app.use('/v1/stations', require('./routes_stations'));
  console.log('[server] routes_stations 加载成功');
} catch (e) {
  console.log('[server] routes_stations 加载失败，跳过');
}

// 8. 合伙人管理路由
try {
  app.use('/v1/partners', require('./routes_partners'));
  console.log('[server] routes_partners 加载成功');
} catch (e) {
  console.log('[server] routes_partners 加载失败，跳过');
}

// 9. 提现管理路由
try {
  app.use('/v1/withdrawals', require('./routes_withdrawals'));
  console.log('[server] routes_withdrawals 加载成功');
} catch (e) {
  console.log('[server] routes_withdrawals 加载失败，跳过');
}

// 10. 微信登录和手机号绑定路由
try {
  app.use('/v1/wx', require('./routes_wx_auth'));
  console.log('[server] routes_wx_auth 加载成功');
} catch (e) {
  console.log('[server] routes_wx_auth 加载失败，跳过');
}

// 11. 管理后台仪表盘统计路由
try {
  app.use('/v1/admin', require('./routes_admin'));
  console.log('[server] routes_admin 加载成功');
} catch (e) {
  console.log('[server] routes_admin 加载失败，跳过');
}

// 11.1 管理后台-评分规则管理路由
try {
  app.use('/v1/admin/score', require('./routes_admin_score'));
  console.log('[server] routes_admin_score 加载成功');
} catch (e) {
  console.log('[server] routes_admin_score 加载失败，跳过');
}

// 11.2 管理后台-订单/佣金/档案/验资/托管管理路由
try {
  app.use('/v1/admin', require('./routes_admin_orders'));
  console.log('[server] routes_admin_orders 加载成功');
} catch (e) {
  console.log('[server] routes_admin_orders 加载失败，跳过');
}

// 11.3 管理后台-系统配置路由
try {
  app.use('/v1/admin/config', require('./routes_admin_config'));
  console.log('[server] routes_admin_config 加载成功');
} catch (e) {
  console.log('[server] routes_admin_config 加载失败，跳过');
}

// 11.4 管理后台-财务路由
try {
  app.use('/v1/admin/finance', require('./routes_admin_finance'));
  console.log('[server] routes_admin_finance 加载成功');
} catch (e) {
  console.log('[server] routes_admin_finance 加载失败，跳过');
}

// 11.6 管理后台-沙龙活动管理路由
try {
  app.use('/v1/admin/activities', require('./routes_admin_activities'));
  console.log('[server] routes_admin_activities 加载成功');
} catch (e) {
  console.log('[server] routes_admin_activities 加载失败，跳过');
}

// 11.7 管理后台-沙龙配置管理路由
try {
  app.use('/v1/admin', require('./routes_admin_salon_config'));
  console.log('[server] routes_admin_salon_config 加载成功');
} catch (e) {
  console.log('[server] routes_admin_salon_config 加载失败，跳过');
}

// 11.8 管理后台-用户管理路由
try {
  app.use('/v1/admin', require('./routes_admin_users'));
  console.log('[server] routes_admin_users 加载成功');
} catch (e) {
  console.log('[server] routes_admin_users 加载失败，跳过');
}

// 12. 收入汇总路由（用户端）
try {
  app.use('/v1/income', require('./routes_income'));
  console.log('[server] routes_income 加载成功');
} catch (e) {
  console.log('[server] routes_income 加载失败，跳过');
}

// 13. 佣金路由
try {
  app.use('/v1/commission', require('./routes_commission'));
  console.log('[server] routes_commission 加载成功');
} catch (e) {
  console.log('[server] routes_commission 加载失败，跳过');
}

// 14. 角色申请路由（公益推荐官、联创推荐官等）
try {
  app.use('/v1/apply', require('./routes_apply'));
  console.log('[server] routes_apply 加载成功');
} catch (e) {
  console.log('[server] routes_apply 加载失败，跳过:', e.message);
}

// 兼容旧路径（不带 /v1 前缀的请求重定向到 /v1）
app.use('/auth', require('./routes_auth'));
app.use('/api/auth', require('./routes_auth'));
app.use('/api/user', require('./routes_user') || createUserRoutes());
app.use('/api/admin/referral-codes', requireAuth, requireAdmin, require('./routes_admin-referral'));
app.use('/api/referral-codes', requireAuth, require('./routes_referral-codes'));
try {
  app.use('/api/payment', require('./routes_payment'));
} catch (e) {}
try {
  app.use('/income', require('./routes_income'));
} catch (e) {}
try {
  app.use('/api/wx', require('./routes_wx_auth'));
} catch (e) {}
try {
  app.use('/api/referral', requireAuth, require('./routes_referral'));
} catch (e) {}
try {
  app.use('/api/stations', require('./routes_stations'));
} catch (e) {}
try {
  app.use('/api/admin/stations', requireAuth, requireAdmin, require('./routes_stations'));
} catch (e) {}
try {
  app.use('/api/partners', require('./routes_partners'));
} catch (e) {}
try {
  app.use('/api/admin/partners', requireAuth, requireAdmin, require('./routes_partners'));
} catch (e) {}
try {
  app.use('/api/withdrawals', require('./routes_withdrawals'));
} catch (e) {}
try {
  app.use('/api/admin/withdrawals', requireAuth, requireAdmin, require('./routes_withdrawals'));
} catch (e) {}
// 管理后台-订单/佣金/档案/验资/托管（挂载到 /api/admin 使其兼容 /api/admin/orders 等）
// 注意：需放在 /api/admin (routes_admin) 之前，避免路由被拦截
try {
  app.use('/api/admin', require('./routes_admin_orders'));
} catch (e) {}
try {
  app.use('/api/admin', require('./routes_admin'));
} catch (e) {}
// 管理后台-评分规则
try {
  app.use('/api/admin/score', require('./routes_admin_score'));
} catch (e) {}
// 管理后台-沙龙活动
try {
  app.use('/api/admin/activities', require('./routes_admin_activities'));
} catch (e) {}
// 管理后台-用户管理（挂载到 /api/admin，使 /api/admin/users 生效）
try {
  app.use('/api/admin', require('./routes_admin_users'));
} catch (e) {}
try {
  app.use('/api/commission', require('./routes_commission'));
} catch (e) {}

// 静态文件服务（PDF导出等）
app.use('/public', express.static(path.join(__dirname, 'public')));

// 管理后台静态文件服务
const adminBuildPath = path.join(__dirname, 'admin-panel', 'build');
app.use('/admin', express.static(adminBuildPath));
// SPA fallback: 所有 /admin 下的非API请求返回 index.html
app.use('/admin', (req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(adminBuildPath, 'index.html'));
  } else {
    next();
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在',
    path: req.path,
    method: req.method
  });
});

// 统一错误处理中间件
app.use((err, req, res, next) => {
  console.error('[server] 错误:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });

  // JSON解析错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: '无效的JSON格式',
      code: 'INVALID_JSON'
    });
  }

  // 参数验证错误（express-validator）
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: err.array(),
      code: 'VALIDATION_ERROR'
    });
  }

  // JWT认证错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '认证令牌无效',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '认证令牌已过期',
      code: 'TOKEN_EXPIRED'
    });
  }

  // 数据库错误
  if (err.code === 'SQLITE_ERROR') {
    console.error('[server] 数据库错误:', err.message);
    return res.status(500).json({
      success: false,
      message: '数据库操作失败',
      code: 'DATABASE_ERROR'
    });
  }

  // 默认服务器错误
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details || null
    })
  });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n人人媒好后端的服务已启动`);
  console.log(`- 本地访问: http://localhost:${PORT}`);
  console.log(`- 局域网访问: http://${getLocalIP()}:${PORT}`);
  console.log(`- 健康检查: http://localhost:${PORT}/health`);
  console.log(`- 环境: ${process.env.NODE_ENV || 'development'}\n`);
});

// 获取本地IP
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (let devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '0.0.0.0';
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[server] 收到SIGINT信号，准备关闭服务器...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[server] 收到SIGTERM信号，准备关闭服务器...');
  db.close();
  process.exit(0);
});

// 示例路由创建函数（如果路由文件不存在，创建默认路由）
function createAuthRoutes() {
  const router = require('express').Router();
  
  // 微信登录
  router.post('/wechat-login', (req, res) => {
    const { code, referrer_id } = req.body;
    // 示例逻辑
    res.json({
      success: true,
      token: 'mock_token_' + Date.now(),
      openid: 'mock_openid',
      isNewUser: true
    });
  });
  
  // 验证token
  router.get('/me', (req, res) => {
    res.json({ id: 1, nickname: '测试用户', role: 'user' });
  });
  
  return router;
}

function createUserRoutes() {
  const router = require('express').Router();
  const db = app.get('db');
  const { requireAuth } = require('./auth-middleware') || {};

  // 更新用户档案（兼容旧版：若无 requireAuth 则跳过鉴权）
  const authMiddleware = requireAuth || ((req, res, next) => {
    // 从 query 或 header 取 userId（兼容无 token 场景）
    req.user = { userId: req.query._uid || req.headers['x-user-id'] || 1 };
    next();
  });

  router.put('/profile/update', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ code: -1, message: '没有需要更新的字段' });
    }

    // 允许更新的字段白名单
    const ALLOWED = [
      'nickname', 'avatar', 'gender', 'age', 'city', 'phone',
      'wechatAccount', 'wechat_account', 'education', 'maritalStatus', 'marital_status',
      'intro', 'occupation', 'income',
      'hasProperty', 'has_property', 'hasCar', 'has_car',
      'healthTags', 'health_tags', 'sleepHabit', 'sleep_habit',
      'sportHabit', 'sport_habit', 'dietTags', 'diet_tags',
      'smoking', 'drinking',
      'expectAgeMin', 'expect_age_min', 'expectAgeMax', 'expect_age_max',
      'expectEducation', 'expect_education', 'expectIncome', 'expect_income',
      'marriageExpect', 'marriage_expect',
      'face_auth_status', 'face_auth_image',
      'id_card_front_image', 'id_card_back_image',
      'property_images', 'vehicle_images',
      'bank_deposit_proof', 'insurance_proof', 'finance_proof',
    ];

    const updates = [];
    const values = [];
    for (const f of ALLOWED) {
      if (data[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(data[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ code: -1, message: '没有需要更新的字段' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    try {
      db.prepare(sql).run(...values);
      const updated = db.prepare('SELECT id, profile_score, score_tier FROM users WHERE id = ?').get(userId);
      res.json({
        code: 0,
        message: '更新成功',
        data: {
          profileScore: updated?.profile_score || 0,
          scoreTier: updated?.score_tier || 'unrated',
        },
      });
    } catch (err) {
      console.error('[user/profile/update] SQL error:', err);
      res.status(500).json({ code: -1, message: '更新失败', error: err.message });
    }
  });

  // GET /v1/user/profile - 获取用户资料
  router.get('/profile', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });
      res.json({ code: 0, data: user });
    } catch (err) {
      res.status(500).json({ code: -1, message: '获取失败' });
    }
  });

  return router;
}

module.exports = app;
