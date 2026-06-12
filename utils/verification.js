// utils/verification.js - 实名认证系统
// 第一阶段：基础认证（姓名+身份证号）
// 第二阶段预留：深度认证（人脸识别）

const { request } = require('./request');
const API = require('../services/api');

// 延迟获取App实例
const _getApp = () => getApp() || {};

// 认证等级
const VERIFICATION_LEVELS = {
  NONE: 0,      // 未认证
  BASIC: 1,     // 基础认证（姓名+身份证号）
  DEEP: 2,      // 深度认证（人脸识别，第二阶段）
};

// 认证状态
const VERIFICATION_STATUS = {
  NONE: 'none',           // 未认证
  PENDING: 'pending',     // 审核中
  APPROVED: 'approved',   // 已通过
  REJECTED: 'rejected',   // 已拒绝
};

/**
 * 检查认证状态
 */
const getVerificationStatus = () => {
  return {
    level: _getApp().globalData?.verificationLevel || 0,
    status: _getApp().globalData?.verificationStatus || VERIFICATION_STATUS.NONE,
    isVerified: _getApp().globalData?.isVerified || false,
  };
};

/**
 * 提交基础认证（姓名+身份证号）
 */
const submitBasicVerification = (params) => {
  const { realName, idNumber } = params;

  return new Promise((resolve, reject) => {
    if (!realName || realName.length < 2) {
      reject({ success: false, message: '请输入真实姓名' });
      return;
    }
    if (!idNumber || !_validateIdNumber(idNumber)) {
      reject({ success: false, message: '请输入正确的身份证号' });
      return;
    }

    wx.showLoading({ title: '提交认证...' });

    request({
      url: API.VERIFY.SUBMIT,
      method: 'POST',
      data: { realName, idNumber },
    }).then((resp) => {
      const data = resp.data || resp;
      wx.hideLoading();
      _getApp().globalData.isVerified = true;
      _getApp().globalData.verificationLevel = VERIFICATION_LEVELS.BASIC;
      _getApp().globalData.verificationStatus = VERIFICATION_STATUS.PENDING;
      wx.setStorageSync('is_verified', true);
      wx.setStorageSync('verification_level', VERIFICATION_LEVELS.BASIC);
      wx.setStorageSync('verification_status', VERIFICATION_STATUS.PENDING);

      wx.showToast({ title: '认证提交成功', icon: 'success' });
      resolve({ success: true, status: 'pending' });
    }).catch((err) => {
      wx.hideLoading();
      reject({ success: false, message: err.message || '认证提交失败' });
    });
  });
};

/**
 * 查询认证结果
 */
const checkVerificationResult = () => {
  return request({ url: API.VERIFY.STATUS }).then((data) => {
    // 后端已返回映射后的状态（verified -> approved）
    const level = data.level || 0;
    const status = data.status || VERIFICATION_STATUS.NONE;
    const isVerified = status === VERIFICATION_STATUS.APPROVED;
    const rejectReason = data.rejectReason || '';

    _getApp().globalData.isVerified = isVerified;
    _getApp().globalData.verificationLevel = level;
    _getApp().globalData.verificationStatus = status;
    wx.setStorageSync('is_verified', isVerified);
    wx.setStorageSync('verification_level', level);
    wx.setStorageSync('verification_status', status);
    if (rejectReason) {
      wx.setStorageSync('verification_reject_reason', rejectReason);
    }

    return { level, status, isVerified, rejectReason };
  });
};

/**
 * 身份证号校验
 */
const _validateIdNumber = (idNumber) => {
  const reg = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  return reg.test(idNumber);
};

/**
 * 脱敏处理身份证号
 */
const maskIdNumber = (idNumber) => {
  if (!idNumber || idNumber.length < 10) return idNumber;
  return idNumber.slice(0, 6) + '****' + idNumber.slice(-4);
};

/**
 * 脱敏处理姓名
 */
const maskName = (name) => {
  if (!name) return '';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(name.length - 1);
};

module.exports = {
  VERIFICATION_LEVELS,
  VERIFICATION_STATUS,
  getVerificationStatus,
  submitBasicVerification,
  checkVerificationResult,
  maskIdNumber,
  maskName,
};
