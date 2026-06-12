// utils/phaseInterfaces.js - 第二、三阶段功能接口定义（保留）
// 这些接口在第一阶段仅做类型定义和占位，不做具体实现
// 所有接口返回 { code: 1001, message: '功能开发中，敬请期待' }

const { request } = require('./request');
const API = require('../services/api');

/**
 * 第二阶段接口
 * - 合伙人体系（线上合伙人、城市合伙人、社区服务站）
 * - 专业推荐官
 * - 沙龙活动管理
 * - 智能推荐算法
 * - 线下活动报名
 */
const Phase2API = {
  // ===== 合伙人体系 =====

  /**
   * 申请联创推荐官（公益用户 / 城市合伙人 升级）
   * POST /apply/partner-matchmaker
   * @param {Object} params - 联创申请参数（无需 referrer_id）
   */
  upgradeToPartner: (params) => {
    return request({ url: API.APPLY.PARTNER_MATCHMAKER, method: 'POST', data: params });
  },

  /**
   * 申请城市合伙人
   * POST /apply/city-franchisee
   */
  applyCityFranchisee: (params) => {
    return request({ url: API.APPLY.CITY_FRANCHISEE, method: 'POST', data: params });
  },

  /**
   * 申请社区服务站（审核制，无需缴费）
   * POST /apply/community-station
   * @param {Object} params - 包含 referrer_id（联创推荐官ID）
   */
  applyCommunityPartner: (params) => {
    return request({ url: API.APPLY.COMMUNITY_STATION, method: 'POST', data: params });
  },

  // ===== 专业推荐官 =====

  /**
   * 升级为专业推荐官
   * POST /apply/professional-recommender
   */
  upgradeToProfessional: (params) => {
    return request({ url: API.APPLY.PROFESSIONAL, method: 'POST', data: params });
  },

  // ===== 沙龙活动管理 =====

  /**
   * 创建沙龙活动（城市合伙人/社区服务站）
   * POST /salons/create
   */
  createSalon: (params) => {
    return request({ url: API.SALON.CREATE, method: 'POST', data: params });
  },

  /**
   * 报名参加沙龙
   * POST /salons/{id}/join
   */
  joinSalon: (salonId, params) => {
    return request({ url: `/v1/salon/${salonId}/join`, method: 'POST', data: params });
  },

  /**
   * 沙龙签到
   * POST /salons/{id}/checkin
   */
  checkinSalon: (salonId) => {
    return request({ url: `/v1/salon/${salonId}/checkin`, method: 'POST' });
  },

  // ===== 智能推荐 =====

  /**
   * 获取智能推荐推荐列表
   * GET /match/smart
   */
  getSmartMatches: (params) => {
    return request({ url: API.MATCH.RECOMMEND, data: params });
  },

  /**
   * 双方互赞后解锁聊天
   * POST /match/unlock-chat
   */
  unlockChat: (targetUserId) => {
    return request({ url: '/match/unlock-chat', method: 'POST', data: { target_user_id: targetUserId } });
  },
};

/**
 * 第三阶段接口
 * - 深度认证（人脸识别）
 * - 高级AI推荐
 * - 社交功能增强
 * - 数据分析面板
 * - 情感顾问服务
 */
const Phase3API = {
  // ===== 深度认证 =====

  /**
   * 发起人脸识别认证
   * POST /v1/verify/deep/start
   */
  startDeepVerification: () => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 提交人脸识别结果
   * POST /v1/verify/deep/submit
   */
  submitDeepVerification: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  // ===== 高级AI推荐 =====

  /**
   * AI多维度推荐（性格、兴趣、价值观等）
   * GET /v1/match/ai-deep
   */
  getAIDeepMatches: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 兼容性分析报告
   * GET /v1/match/compatibility/{userId}
   */
  getCompatibilityReport: (userId) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  // ===== 社交功能 =====

  /**
   * 发送动态/朋友圈
   * POST /v1/social/post
   */
  createPost: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 获取动态列表
   * GET /v1/social/feed
   */
  getSocialFeed: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 发送礼物
   * POST /v1/gift/send
   */
  sendGift: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  // ===== 数据分析面板 =====

  /**
   * 获取个人数据报告
   * GET /v1/analytics/profile
   */
  getAnalyticsProfile: () => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 获取推荐效果分析
   * GET /v1/analytics/match-stats
   */
  getMatchAnalytics: () => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  // ===== 情感顾问 =====

  /**
   * 预约情感顾问
   * POST /v1/consultant/book
   */
  bookConsultant: (params) => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },

  /**
   * 获取情感顾问列表
   * GET /v1/consultant/list
   */
  getConsultantList: () => {
    return Promise.resolve({ code: 1001, message: '功能开发中，敬请期待' });
  },
};

module.exports = {
  Phase2API,
  Phase3API,
};
