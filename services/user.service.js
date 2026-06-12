// services/user.service.js - 用户与会员相关 API
// ============================================================

const { request, uploadFile } = require('../utils/request');
const API = require('./api');
const { DEV_MOCK_DATA } = require('../utils/config');

const _getApp = () => getApp() || {};

/**
 * 获取当前用户完整信息（登录后拉取）
 */
function getProfile() {
  if (DEV_MOCK_DATA) {
    const g = _getApp().globalData || {};
    return Promise.resolve(g.userInfo || {});
  }
  return request({ url: API.USER.PROFILE });
}

/**
 * 更新用户资料
 * @param {Object} params
 */
function updateProfile(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true });
  }
  return request({ url: API.USER.UPDATE_PROFILE, method: 'PUT', data: params });
}

/**
 * 上传头像
 * @param {string} filePath - 本地文件路径
 */
function uploadAvatar(filePath) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ url: filePath });
  }
  return uploadFile(filePath, 'avatar');
}

/**
 * 获取我名下的会员列表（推荐官用）
 * @param {Object} params - { page, pageSize }
 */
function getMyMembers(params = {}) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({
      total: 3,
      list: [
        { id: 1, name: '张三', age: 28, gender: 'male', joined_at: '2026-03-10', status: 'active' },
        { id: 2, name: '李四', age: 32, gender: 'female', joined_at: '2026-03-15', status: 'active' },
        { id: 3, name: '王五', age: 25, gender: 'male', joined_at: '2026-04-01', status: 'pending' },
      ],
    });
  }
  return request({ url: API.MEMBER.LIST, data: { page: 1, page_size: 20, ...params } });
}

/**
 * 获取推荐关系信息（推荐人是谁）
 */
function getReferralInfo() {
  const g = _getApp().globalData || {};
  if (DEV_MOCK_DATA) {
    return Promise.resolve(g.referrerInfo || null);
  }
  return request({ url: API.REFERRAL.INFO });
}

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getMyMembers,
  getReferralInfo,
};
