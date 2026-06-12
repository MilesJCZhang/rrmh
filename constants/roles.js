/**
 * constants/roles.js - 角色体系统一定义
 *
 * 所有角色等级、名称、配置均在此文件维护，
 * 前后端其他文件必须引用本文件，禁止重复定义。
 */

// 角色层级（数值越大权限越高）
const ROLE_HIERARCHY = {
  'admin': 100,
  'city_franchisee': 80,
  'professional_recommender': 60,
  'community_station': 50,
  'partner_matchmaker': 40,
  'public_matchmaker': 30,
  'user': 10,
};

// 角色中文名称
const ROLE_NAMES = {
  'admin': '管理员',
  'city_franchisee': '城市合伙人',
  'professional_recommender': '专业推荐官',
  'community_station': '社区服务站',
  'partner_matchmaker': '联创推荐官',
  'public_matchmaker': '公益推荐官',
  'user': '普通用户',
};

// 推荐码前缀
const ROLE_CODE_PREFIX = {
  'public_welfare': 'GYRG',
  'creator': 'LCRG',
  'professional': 'ZYRG',
  'community_station': 'SQZD',
  'city_partner': 'CSHH',
};

// 推荐官角色列表（所有有权获得推荐佣金的角色）
const MATCHMAKER_ROLES = [
  'public_matchmaker',
  'partner_matchmaker',
  'professional_recommender',
  'community_station',
  'city_franchisee',
];

// 可获得推荐建档佣金的角色
const REFERRER_ELIGIBLE_ROLES = [
  'public_matchmaker',
  'partner_matchmaker',
  'community_station',
  'professional_recommender',
  'city_franchisee',
];

// 可推荐城市合伙人的角色
const CITY_REFERRER_ELIGIBLE_ROLES = ['professional_recommender'];

/**
 * 判断角色A是否拥有高于或等于角色B的权限
 */
function hasRoleAtLeast(userRole, targetRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[targetRole] || 0);
}

/**
 * 判断是否为推荐官角色
 */
function isMatchmakerRole(role) {
  return MATCHMAKER_ROLES.includes(role);
}

module.exports = {
  ROLE_HIERARCHY,
  ROLE_NAMES,
  ROLE_CODE_PREFIX,
  MATCHMAKER_ROLES,
  REFERRER_ELIGIBLE_ROLES,
  CITY_REFERRER_ELIGIBLE_ROLES,
  hasRoleAtLeast,
  isMatchmakerRole,
};
