/**
 * JWT认证中间件
 * 提供Token生成、验证、权限控制功能
 */

const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

// JWT密钥（从环境变量读取，未配置时启动会报错而非使用弱密钥）
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('[auth-middleware] FATAL: JWT_SECRET 环境变量未设置，拒绝使用弱密钥');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成JWT Token
 * @param {number} userId - 用户ID
 * @param {string} role - 用户角色（user/admin）
 * @param {object} additionalData - 额外数据
 * @returns {string} JWT Token
 */
const generateToken = (userId, role = 'user', additionalData = {}) => {
  const payload = {
    userId,
    role,
    ...additionalData
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * 验证JWT Token
 * @param {string} token - JWT Token
 * @returns {object|null} 解码后的数据或null
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * 认证中间件 - 验证用户是否登录
 * 开发模式下可以通过设置 NODE_ENV=development 跳过验证
 */
const requireAuth = (req, res, next) => {
  // 开发模式跳过认证（方便开发调试）
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    const userId = req.headers['user-id'] || req.body.user_id || req.query.user_id || 1;
    const role = req.headers['user-role'] || 'user';
    req.user = { userId: parseInt(userId), role };
    logger.debug(`[auth] 开发模式：跳过认证，使用用户ID=${userId}, role=${role}`);
    return next();
  }
  
  // 生产模式：验证Token
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
      code: 'NO_TOKEN'
    });
  }
  
  // 提取Token（支持 "Bearer <token>" 格式）
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '认证令牌格式错误',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }
  
  // 验证Token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: '认证令牌无效或已过期',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // 兼容 uid 和 userId 两种字段名
  if (!decoded.userId && !decoded.uid) {
    return res.status(401).json({
      success: false,
      message: '认证令牌无效',
      code: 'INVALID_TOKEN'
    });
  }
  // 统一使用 userId
  if (!decoded.userId) decoded.userId = decoded.uid;

  // 将用户信息挂载到req对象
  req.user = decoded;

  logger.debug(`[auth] 用户认证成功：userId=${decoded.userId}, role=${decoded.role}`);
  next();
};

/**
 * 管理员权限中间件 - 验证用户是否为管理员
 * 必须在 requireAuth 之后使用
 */
const requireAdmin = (req, res, next) => {
  // 先确保用户已认证
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '未认证',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  // 检查角色
  if (req.user.role !== 'admin') {
    logger.warn(`[auth] 权限不足：userId=${req.user.userId}, role=${req.user.role}`);
    return res.status(403).json({
      success: false,
      message: '需要管理员权限',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  logger.debug(`[auth] 管理员权限验证通过：userId=${req.user.userId}`);
  next();
};

/**
 * 可选认证中间件 - 用于某些接口可以登录也可以不登录
 */
const optionalAuth = (req, res, next) => {
  // 开发模式跳过
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    const userId = req.headers['user-id'] || req.body.user_id || req.query.user_id;
    if (userId) {
      req.user = { userId: parseInt(userId), role: req.headers['user-role'] || 'user' };
    }
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // 没有Token也可以继续
    return next();
  }
  
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  
  next();
};

/**
 * 从请求中获取当前用户ID
 * @param {object} req - Express请求对象
 * @returns {number|null} 用户ID
 */
const getCurrentUserId = (req) => {
  return req.user ? req.user.userId : null;
};

/**
 * 检查当前用户是否为管理员
 * @param {object} req - Express请求对象
 * @returns {boolean}
 */
const isAdmin = (req) => {
  return req.user && req.user.role === 'admin';
};

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  optionalAuth,
  getCurrentUserId,
  isAdmin
};
