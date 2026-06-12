// services/referral.service.js - 推荐关系相关服务层
const { request } = require('../utils/request');
const API = require('./api');

// 统一处理 request.js 返回值（兼容返回 body 或 body.data 两种情况）
const _extract = (resp) => resp && resp.data !== undefined ? resp.data : resp;

/**
 * 获取我的推荐洞察数据
 * GET /v1/referral/my-insight
 * 返回与管理后台「数据洞察」相同的推荐统计数据
 */
function getMyInsight() {
  return request({
    url: API.REFERRAL.MY_INSIGHT,
    method: 'GET',
  }).then(_extract);
}

/**
 * 获取推荐关系信息
 * GET /v1/referral/info
 */
function getReferralInfo() {
  return request({
    url: API.REFERRAL.INFO,
    method: 'GET',
  });
}

/**
 * 获取我的推荐列表
 * GET /v1/referral/my-list
 */
function getMyReferralList(data) {
  return request({
    url: API.REFERRAL.MY_LIST,
    method: 'GET',
    data,
  });
}

/**
 * 绑定推荐关系
 * POST /v1/referral/bind
 */
function bindReferral(data) {
  return request({
    url: API.REFERRAL.BIND,
    method: 'POST',
    data,
  });
}

// ==================== 推荐官工作台数据看板（新增）====================

/**
 * 获取工作台统计数据（四大分类）
 * GET /v1/referral/workbench-stats
 * 返回：{ partner_matchmaker_count, public_matchmaker_count, registered_member_count, visitor_count }
 */
function getWorkbenchStats() {
  return request({
    url: API.REFERRAL.WORKBENCH_STATS,
    method: 'GET',
  }).then(_extract);
}

/**
 * 获取工作台明细列表（分页、搜索）
 * GET /v1/referral/workbench-detail
 * @param {Object} params - { type, page, page_size, keyword }
 *   type: 'partner_matchmaker' | 'public_matchmaker' | 'registered_member' | 'visitor'
 */
function getWorkbenchDetail(params) {
  return request({
    url: API.REFERRAL.WORKBENCH_DETAIL,
    method: 'GET',
    data: params,
  }).then(_extract);
}

/**
 * 记录访客到访
 * POST /v1/referral/visitor-log
 * @param {Object} data - { referrer_code, visitor_openid, visitor_nickname, visitor_avatar }
 */
function logVisitor(data) {
  return request({
    url: API.REFERRAL.VISITOR_LOG,
    method: 'POST',
    data,
  }).then(_extract);
}

/**
 * 更新访客注册状态
 * PUT /v1/referral/visitor-update
 * @param {Object} data - { visitor_openid, reg_status }
 */
function updateVisitorStatus(data) {
  return request({
    url: API.REFERRAL.VISITOR_UPDATE,
    method: 'PUT',
    data,
  }).then(_extract);
}

module.exports = {
  getMyInsight,
  getReferralInfo,
  getMyReferralList,
  bindReferral,
  // 新增工作台方法
  getWorkbenchStats,
  getWorkbenchDetail,
  logVisitor,
  updateVisitorStatus,
};
