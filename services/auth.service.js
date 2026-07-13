// services/auth.service.js - 统一认证与状态管理服务
// ============================================================
// 所有页面必须通过此服务访问用户状态，禁止直接读取globalData或Storage
// ============================================================

const { DEV_MODE, DEV_MOCK_DATA } = require('../utils/config');
const { ROLE_HIERARCHY, MATCHMAKER_ROLES, ROLE_NAMES } = require('../constants/roles');

/**
 * 获取App实例（安全方式）
 */
function _getApp() {
  return getApp() || {};
}

/**
 * 获取globalData（安全方式）
 */
function _getGlobalData() {
  const app = _getApp();
  return app.globalData || {};
}

// ============================================================
// 状态读取方法（统一入口）
// ============================================================

/**
 * 获取用户角色
 * 优先级：Storage > globalData > 默认值'user'
 * @returns {string} 用户角色
 */
function getUserRole() {
  let storedRole = wx.getStorageSync('user_role');
  let gRole = _getGlobalData().userRole;
  
  // 标准化：去掉 user/ 前缀
  if (storedRole && storedRole.startsWith('user/')) {
    storedRole = storedRole.replace('user/', '');
  }
  if (gRole && gRole.startsWith('user/')) {
    gRole = gRole.replace('user/', '');
  }
  
  // 调试日志
  if (DEV_MODE) {
    console.log('[auth.service.getUserRole] stored=', storedRole, '| global=', gRole);
  }
  
  return (storedRole !== '' && storedRole) ? storedRole : (gRole || 'user');
}

/**
 * 获取Token
 * @returns {string|null}
 */
function getToken() {
  const storedToken = wx.getStorageSync('token');
  const gToken = _getGlobalData().token;
  
  return storedToken || gToken || null;
}

/**
 * 获取OpenID
 * @returns {string|null}
 */
function getOpenId() {
  const storedOpenId = wx.getStorageSync('openid');
  const gOpenId = _getGlobalData().openid;
  
  return storedOpenId || gOpenId || null;
}

/**
 * 检查是否已登录
 * @returns {boolean}
 */
function isLogin() {
  const token = getToken();
  const gIsLogin = _getGlobalData().isLogin;
  
  return !!(token || gIsLogin);
}

/**
 * 检查是否访客
 * 语义：仅未登录视为访客；已登录但未建档不等于访客
 * @returns {boolean}
 */
function isGuest() {
  return !isLogin();
}

/**
 * 检查是否有头像
 * @returns {boolean}
 */
function hasAvatar() {
  const stored = wx.getStorageSync('has_avatar');
  const gValue = _getGlobalData().hasAvatar;
  
  return !!(stored || gValue);
}

/**
 * 检查是否有个人资料
 * @returns {boolean}
 */
function hasProfile() {
  const stored = wx.getStorageSync('has_profile');
  const gValue = _getGlobalData().hasProfile;
  
  return !!(stored || gValue);
}

/**
 * 检查是否实名认证
 * @returns {boolean}
 */
function isVerified() {
  const stored = wx.getStorageSync('is_verified');
  const gValue = _getGlobalData().isVerified;
  
  return !!(stored || gValue);
}

/**
 * 获取认证等级
 * @returns {number} 0=未认证, 1=基础认证, 2=深度认证
 */
function getVerificationLevel() {
  const stored = wx.getStorageSync('verification_level');
  const gValue = _getGlobalData().verificationLevel;
  
  return stored || gValue || 0;
}

/**
 * 检查是否推荐官（任一推荐官角色）
 * 优先检查 userInfo.roleList（动态计算所得），兜底检查 userRole
 * @returns {boolean}
 */
function isMatchmaker() {
  // 1. 优先从 userInfo.roleList 检查（roleList 由 calculateUserRoles 动态计算）
  const userInfo = getUserInfo();
  if (userInfo && Array.isArray(userInfo.roleList) && userInfo.roleList.length > 0) {
    return userInfo.roleList.some(r => [
      'public_matchmaker',
      'partner_matchmaker',
      'city_franchisee',
      'professional_recommender',
      'community_station'
    ].includes(r));
  }

  // 2. 兜底：从 userRole（单角色）检查
  const role = getUserRole();
  return [
    'public_matchmaker',
    'partner_matchmaker',
    'city_franchisee',
    'professional_recommender',
    'community_station'
  ].includes(role);
}

/**
 * 检查是否已付费（建档费/升级费等）
 * @returns {boolean}
 */
function isPaid() {
  const stored = wx.getStorageSync('is_paid');
  const gValue = _getGlobalData().isPaid;
  
  return !!(stored || gValue);
}

/**
 * 设置付费状态
 * @param {boolean} isPaid
 */
function setIsPaid(isPaid) {
  wx.setStorageSync('is_paid', isPaid);
  _getGlobalData().isPaid = isPaid;
}

/**
 * 获取用户信息
 * @returns {Object|null}
 */
function getUserInfo() {
  const stored = wx.getStorageSync('user_info');
  const gValue = _getGlobalData().userInfo;
  
  return stored || gValue || null;
}

/**
 * 获取推荐人ID
 * @returns {string|null}
 */
function getReferrerId() {
  const stored = wx.getStorageSync('referrer_id');
  const gValue = _getGlobalData().referrerId;
  
  // 兜底：从 userInfo.referrerId 读取（syncUserData 写入但未调 setReferrerId 时）
  if (!stored && !gValue) {
    const userInfo = getUserInfo();
    if (userInfo && userInfo.referrerId) {
      // 回填到 Storage 和 globalData，下次直接命中
      setReferrerId(userInfo.referrerId);
      return userInfo.referrerId;
    }
  }
  
  return stored || gValue || null;
}

/**
 * 获取推荐人信息
 * @returns {Object|null}
 */
function getReferrerInfo() {
  const stored = wx.getStorageSync('referrer_info');
  const gValue = _getGlobalData().referrerInfo;
  
  return stored || gValue || null;
}

// ============================================================
// 状态写入方法（统一入口）
// ============================================================

/**
 * 设置用户角色（同时写入Storage和globalData）
 * @param {string} role - 用户角色
 */
function setUserRole(role) {
  // 标准化 role：去掉后端返回的 user/ 前缀
  const normalizedRole = role && role.startsWith('user/') ? role.replace('user/', '') : (role || 'user');
  if (DEV_MODE) {
    console.log('[auth.service.setUserRole] raw=', role, '| normalized=', normalizedRole);
  }
  
  wx.setStorageSync('user_role', normalizedRole);
  _getGlobalData().userRole = normalizedRole;
}

/**
 * 设置Token
 * @param {string} token
 * @note isGuest 状态由 isGuest() 动态计算，不在此处硬编码
 */
function setToken(token) {
  wx.setStorageSync('token', token);
  const g = _getGlobalData();
  g.token = token;
  g.isLogin = true;
  // 注意：不在此处设置 isGuest，应由 isGuest() 根据 hasProfile() 动态判断
}

/**
 * 设置用户信息
 * @param {Object} userInfo
 */
function setUserInfo(userInfo) {
  wx.setStorageSync('user_info', userInfo);
  _getGlobalData().userInfo = userInfo;
  // 同步更新角色缓存，确保 getUserRole() 能读到最新值
  if (userInfo && userInfo.role) {
    const normalizedRole = userInfo.role.startsWith('user/') ? userInfo.role.replace('user/', '') : userInfo.role;
    wx.setStorageSync('user_role', normalizedRole);
    _getGlobalData().userRole = normalizedRole;
  }
}

/**
 * 设置头像状态
 * @param {boolean} hasAvatar
 */
function setHasAvatar(hasAvatar) {
  wx.setStorageSync('has_avatar', hasAvatar);
  _getGlobalData().hasAvatar = hasAvatar;
}

/**
 * 设置资料状态
 * @param {boolean} hasProfile
 */
function setHasProfile(hasProfile) {
  wx.setStorageSync('has_profile', hasProfile);
  _getGlobalData().hasProfile = hasProfile;
}

/**
 * 设置认证状态
 * @param {boolean} isVerified
 */
function setIsVerified(isVerified) {
  wx.setStorageSync('is_verified', isVerified);
  _getGlobalData().isVerified = isVerified;
}

/**
 * 设置认证等级
 * @param {number} level
 */
function setVerificationLevel(level) {
  wx.setStorageSync('verification_level', level);
  _getGlobalData().verificationLevel = level;
}

/**
 * 设置推荐人ID
 * @param {string} referrerId
 */
function setReferrerId(referrerId) {
  wx.setStorageSync('referrer_id', referrerId);
  _getGlobalData().referrerId = referrerId;
}

/**
 * 设置推荐人信息
 * @param {Object} referrerInfo
 */
function setReferrerInfo(referrerInfo) {
  wx.setStorageSync('referrer_info', referrerInfo);
  _getGlobalData().referrerInfo = referrerInfo;
}

// ============================================================
// 批量同步方法（用于登录成功/用户信息更新）
// ============================================================

/**
 * 同步用户数据到Storage和globalData
 * @param {Object} user - 用户数据对象
 * @param {Object} options - 配置项
 */
function syncUserData(user, options = {}) {
  const {
    syncRole = true,
    syncProfile = true,
    syncAvatar = true,
    syncVerified = true,
    syncToken = false,
    token = null
  } = options;
  
  if (DEV_MODE) {
    console.log('[auth.service.syncUserData] user=', user, '| options=', options);
  }
  
  // 兼容 snake_cae（数据库）和 camelCase（Prisma/API 返回）
  const getField = (obj, snakeName, camelName) => {
    if (obj[camelName] !== undefined) return obj[camelName];
    return obj[snakeName];
  };
  
  if (syncRole && user.role !== undefined) {
    setUserRole(user.role);
  }

  // 同步 roleList（由后端 calculateUserRoles 动态计算）
  if (user.roleList !== undefined && Array.isArray(user.roleList)) {
    const userInfo = getUserInfo() || {};
    userInfo.roleList = user.roleList;
    wx.setStorageSync('user_info', userInfo);
    _getGlobalData().userInfo = userInfo;
  }
  
  if (syncProfile) {
    const hp = getField(user, 'has_profile', 'hasProfile');
    if (hp !== undefined) setHasProfile(!!hp);
  }
  
  if (syncAvatar) {
    const ha = getField(user, 'has_avatar', 'hasAvatar');
    if (ha !== undefined) setHasAvatar(!!ha);
  }
  
  if (syncVerified) {
    const iv = getField(user, 'is_verified', 'isVerified');
    if (iv !== undefined) setIsVerified(!!iv);
  }
  
  const vl = getField(user, 'verification_level', 'verificationLevel');
  if (vl !== undefined) setVerificationLevel(vl);
  
  // 同步 userInfo（昵称、头像等）
  // 服务器返回 camelCase: nickname, avatar, role, id, recommendedBy 等
  const hasNickname = user.nickname !== undefined;
  const hasAvatarUrl = user.avatar !== undefined;
  // 后端返回 recommendedBy（Prisma字段），也可能返回 referrerId（兼容）
  const referrerIdValue = user.recommendedBy !== undefined ? user.recommendedBy : user.referrerId;
  const hasReferrerId = referrerIdValue !== undefined;
  // 同步 referrerId：同时写入 referrer_id Storage 和 globalData
  // 注意：后端返回 recommendedBy（Prisma字段），前端统一用 referrerId
  if (hasReferrerId) {
    setReferrerId(referrerIdValue);
    // 同时同步推荐人姓名（如果后端返回了 referrerName）
    if (user.referrerName !== undefined) {
      const refInfo = getReferrerInfo() || {};
      refInfo.name = user.referrerName;
      setReferrerInfo(refInfo);
    }
  }

  if (hasNickname || hasAvatarUrl || hasReferrerId) {
    const info = getUserInfo() || {};
    if (user.nickname !== undefined) info.nickname = user.nickname;
    if (user.avatar !== undefined) info.avatar = user.avatar;
    if (user.id !== undefined) info.id = user.id;
    if (user.role !== undefined) info.role = user.role;
    if (user.gender !== undefined) info.gender = user.gender;
    if (hasReferrerId) info.referrerId = referrerIdValue;
    if (user.roleList !== undefined) {
      info.roleList = user.roleList;
      info.roles = user.roleList; // 兼容旧版 user centers 使用的 roles 字段
    }
    setUserInfo(info);
  }
  
  if (syncToken && token) {
    setToken(token);
  }
  
  // ===== 同步访客状态 =====
  const g = _getGlobalData();
  if (g.isLogin) {
    g.isGuest = false; // 已登录就不是访客
  } else {
    g.isGuest = true;
  }
}

/**
 * 清除所有用户状态（退出登录）
 */
function clearUserState() {
  if (DEV_MODE) {
    console.log('[auth.service.clearUserState] 清除用户状态');
  }
  
  // 清除globalData
  const g = _getGlobalData();
  g.token = null;
  g.userInfo = null;
  g.isLogin = false;
  g.isGuest = true;
  g.hasProfile = false;
  g.hasAvatar = false;
  g.userRole = 'user';
  g.isVerified = false;
  g.verificationLevel = 0;
  
  // 清除Storage（保留推荐关系）
  wx.removeStorageSync('token');
  wx.removeStorageSync('refresh_token');
  wx.removeStorageSync('user_info');
  wx.removeStorageSync('has_profile');
  wx.removeStorageSync('has_avatar');
  wx.removeStorageSync('openid');
  wx.removeStorageSync('user_role');
  wx.removeStorageSync('is_verified');
  wx.removeStorageSync('verification_level');
}

// ============================================================
// 权限检查方法
// ============================================================

/**
 * 检查用户是否拥有指定权限
 * @param {string} permission - 权限标识
 * @returns {boolean}
 */
function checkPermission(permission) {
  const userRole = getUserRole();
  
  const roleHierarchy = ROLE_HIERARCHY;
  
  const userLevel = roleHierarchy[userRole] || 0;
  
  // 管理员拥有所有权限
  if (userRole === 'admin') return true;
  
  // 管理员专属权限
  const adminPermissions = ['admin:all', 'admin:users', 'admin:content', 'admin:finance'];
  if (adminPermissions.includes(permission)) return false;
  
  // 根据角色等级判断
  if (permission.startsWith('recommender:')) {
    return userLevel >= roleHierarchy['public_matchmaker'];
  }
  
  if (permission.startsWith('user:')) {
    return true; // 所有登录用户都有基础权限
  }
  
  return false;
}

/**
 * 检查用户是否可以访问某个页面
 * @param {string} pageRole - 页面所需角色
 * @returns {boolean}
 */
function canAccessPage(pageRole) {
  const userRole = getUserRole();
  
  // 如果页面不需要特定角色
  if (!pageRole || pageRole === 'all') return true;
  
  // 精确推荐
  if (userRole === pageRole) return true;
  
  // 角色层级检查（高级角色可以访问低级角色页面）
  const roleHierarchy = ROLE_HIERARCHY;
  
  const userLevel = roleHierarchy[userRole] || 0;
  const pageLevel = roleHierarchy[pageRole] || 0;
  
  return userLevel >= pageLevel;
}

// ============================================================
// Mock数据（开发模式）
// ============================================================

const _MOCK_USER = {
  role: 'user',
  has_profile: true,
  has_avatar: true,
  is_verified: false,
  verification_level: 0,
  info: {
    nickName: '开发测试用户',
    avatarUrl: '/assets/images/default-avatar.png',
  }
};

/**
 * 获取Mock用户数据（开发模式）
 */
function getMockUser() {
  return _MOCK_USER;
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 读取方法
  getUserRole,
  getToken,
  getOpenId,
  isLogin,
  isGuest,
  hasAvatar,
  hasProfile,
  isVerified,
  getVerificationLevel,
  isMatchmaker,
  isPaid,
  getUserInfo,
  getReferrerId,
  getReferrerInfo,
  
  // 写入方法
  setUserRole,
  setToken,
  setUserInfo,
  setHasAvatar,
  setHasProfile,
  setIsVerified,
  setIsPaid,
  setVerificationLevel,
  setReferrerId,
  setReferrerInfo,
  
  // 批量同步
  syncUserData,
  clearUserState,
  
  // 权限检查
  checkPermission,
  canAccessPage,
  
  // Mock
  getMockUser,
};
