// services/apply.service.js - 角色申请/升级相关 API
// ============================================================
// 公益推荐官、联创推荐官、专业推荐官、城市合伙人、社区服务站 的申请提交
// ============================================================

const { request } = require('../utils/request');
const API = require('./api');
const { DEV_MOCK_DATA } = require('../utils/config');

/**
 * 提交公益推荐官申请
 * @param {Object} params - { real_name, gender, phone, wechat, region, referrer_id }
 */
function applyPublicMatchmaker(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, role: 'public_matchmaker' });
  }
  return request({ url: API.APPLY.PUBLIC_MATCHMAKER, method: 'POST', data: params });
}

/**
 * 提交联创推荐官申请（含支付，后端负责支付发起）
 * @param {Object} params - { real_name, phone, wechat, referrer_id }
 */
function applyPartnerMatchmaker(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, role: 'partner_matchmaker', payment_required: true });
  }
  return request({ url: API.APPLY.PARTNER_MATCHMAKER, method: 'POST', data: params });
}

/**
 * 提交专业推荐官申请（含支付）
 * @param {Object} params - { reason, experience }
 */
function applyProfessionalRecommender(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, role: 'professional_recommender', payment_required: true });
  }
  return request({ url: API.APPLY.PROFESSIONAL, method: 'POST', data: params });
}

/**
 * 提交城市合伙人申请（含支付）
 * @param {Object} params - { company_name, contact_name, phone, wechat, city, region, experience, business_plan }
 */
function applyCityFranchisee(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, role: 'city_franchisee', payment_required: true });
  }
  return request({ url: API.APPLY.CITY_FRANCHISEE, method: 'POST', data: params });
}

/**
 * 提交社区服务站申请（免费·审核制）
 * @param {Object} params - { contact_name, phone, wechat, community, address, reason }
 */
function applyCommunityStation(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, role: 'community_station', status: 'pending' });
  }
  return request({ url: API.APPLY.COMMUNITY_STATION, method: 'POST', data: params });
}

/**
 * 查询申请审核状态
 */
function getApplyStatus() {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ status: 'pending', role: 'community_station', submitted_at: Date.now() });
  }
  return request({ url: API.APPLY.STATUS });
}

module.exports = {
  applyPublicMatchmaker,
  applyPartnerMatchmaker,
  applyProfessionalRecommender,
  applyCityFranchisee,
  applyCommunityStation,
  getApplyStatus,
};
