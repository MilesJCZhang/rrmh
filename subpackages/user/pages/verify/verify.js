// pages/verify/verify.js - 实名认证页面
const { ensureLogin } = require('../../../../utils/auth');
const {
  VERIFICATION_STATUS,
  VERIFICATION_LEVELS,
  getVerificationStatus,
  submitBasicVerification,
  checkVerificationResult,
  maskIdNumber,
  maskName,
} = require('../../../../utils/verification');
const authService = require('../../../../services/auth.service');
const { loadDraft, saveDraft, clearDraft } = require('../../../../utils/formDraft');

Page({
  data: {
    // 认证状态
    status: 'none',      // none | pending | approved | rejected
    level: 0,
    isVerified: false,

    // 表单
    realName: '',
    idNumber: '',

    // 脱敏展示
    maskedName: '',
    maskedIdNumber: '',

    // 拒绝原因
    rejectReason: '',

    // 提交状态
    submitting: false,
    agreed: false,
    sensitiveAgreed: false,  // PIPL第28条：敏感信息需单独同意

    // 轮询状态
    pollingTimer: null,
    pollingInterval: 30000, // 30秒轮询一次
  },

  onLoad() {
    ensureLogin().catch(() => {});
  },

  onShow() {
    this._loadStatus();
    // 加载草稿（未认证或已拒绝时恢复填写内容）
    const draft = loadDraft(this);
    if (draft && (!this.data.isVerified || this.data.status === 'rejected')) {
      this.setData({
        realName: draft.realName || '',
        idNumber: draft.idNumber || '',
      });
      console.log('[verify] 已恢复草稿');
    }
    // 如果状态是 pending，启动轮询
    const local = getVerificationStatus();
    if (local.status === 'pending') {
      this._startPolling();
    }
  },

  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
  },

  _loadStatus() {
    const local = getVerificationStatus();
    const userInfo = authService.getUserInfo() || {};
    this.setData({
      status: local.status || 'none',
      level: local.level,
      isVerified: local.isVerified,
      maskedName: local.isVerified ? maskName(userInfo.real_name || '') : '',
      maskedIdNumber: local.isVerified ? maskIdNumber(userInfo.id_number || '') : '',
      rejectReason: local.status === 'rejected' ? (wx.getStorageSync('verification_reject_reason') || '') : '',
    });

    // 从服务器查询最新状态
    if (local.status === 'pending') {
      checkVerificationResult().then((result) => {
        this.setData({
          status: result.status,
          level: result.level,
          isVerified: result.isVerified,
          rejectReason: result.rejectReason || '',
        });
        // 如果状态不再是 pending，停止轮询并提示
        if (result.status !== 'pending') {
          this._stopPolling();
          if (result.status === 'approved') {
            wx.showToast({ title: '实名认证已通过', icon: 'success' });
          } else if (result.status === 'rejected') {
            wx.showModal({
              title: '认证未通过',
              content: result.rejectReason || '请检查信息后重新提交',
              showCancel: false,
            });
          }
        }
      }).catch(() => {});
    }
  },

  // 启动轮询
  _startPolling() {
    if (this.data.pollingTimer) return; // 已经在轮询中
    console.log('[verify] 开始轮询审核状态，间隔:', this.data.pollingInterval, 'ms');
    this._pollFailCount = 0; // 连续失败计数器
    const timer = setInterval(() => {
      // 检查页面是否还存在
      if (!this || !this.data) {
        clearInterval(timer);
        return;
      }
      
      console.log('[verify] 轮询审核状态...');
      checkVerificationResult().then((result) => {
        // 异步操作后再次检查页面是否还存在
        if (!this || !this.data) return;
        
        this._pollFailCount = 0; // 成功则重置计数器
        this.setData({
          status: result.status,
          level: result.level,
          isVerified: result.isVerified,
        });
        // 如果状态不再是 pending，停止轮询并提示用户
        if (result.status !== 'pending') {
          this._stopPolling();
          if (result.status === 'approved') {
            wx.showToast({ title: '实名认证已通过', icon: 'success' });
          } else if (result.status === 'rejected') {
            wx.showModal({
              title: '认证未通过',
              content: result.rejectReason || '请检查信息后重新提交',
              showCancel: false,
            });
          }
        }
      }).catch((err) => {
        // 异步操作后检查页面是否还存在
        if (!this || !this.data) return;
        
        this._pollFailCount = (this._pollFailCount || 0) + 1;
        console.error('[verify] 轮询失败（第', this._pollFailCount, '次）:', err);
        // 连续失败 5 次，停止轮询，避免无限请求
        if (this._pollFailCount >= 5) {
          console.warn('[verify] 轮询连续失败 5 次，已自动停止');
          this._stopPolling();
          wx.showToast({ title: '审核状态查询失败，请稍后重试', icon: 'none' });
        }
      });
    }, this.data.pollingInterval);
    this.setData({ pollingTimer: timer });
  },

  // 停止轮询
  _stopPolling() {
    if (this.data.pollingTimer) {
      console.log('[verify] 停止轮询');
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  onNameInput(e) {
    this.setData({ realName: e.detail.value });
    // 实时保存草稿
    if (this.data.status !== 'approved' && this.data.status !== 'pending') {
      saveDraft(this, { realName: e.detail.value, idNumber: this.data.idNumber });
    }
  },

  onIdNumberInput(e) {
    const val = e.detail.value.toUpperCase();
    this.setData({ idNumber: val });
    // 实时保存草稿
    if (this.data.status !== 'approved' && this.data.status !== 'pending') {
      saveDraft(this, { realName: this.data.realName, idNumber: val });
    }
  },

  onAgreeChange(e) {
    this.setData({ agreed: e.detail.value });
  },

  onSensitiveAgreeChange(e) {
    this.setData({ sensitiveAgreed: e.detail.value });
  },

  onViewAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type });
  },

  onViewSensitiveNotice() {
    wx.showModal({
      title: '敏感个人信息处理说明',
      content: '我们将收集您的身份证号码、面部特征信息（用于深度认证）、银行账户信息（用于提现）。这些信息属于敏感个人信息，我们将单独征得您的同意，经加密存储，不会用于其他用途。身份证号码将经由公安部认可的身份认证接口核验。您可以随时撤回同意。',
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  async onSubmit() {
    const { realName, idNumber, agreed, sensitiveAgreed, submitting } = this.data;

    if (submitting) return;

    if (!agreed) {
      wx.showToast({ title: '请先同意隐私政策和平台协议', icon: 'none' });
      return;
    }

    if (!sensitiveAgreed) {
      wx.showToast({ title: '请先同意敏感个人信息处理授权', icon: 'none' });
      return;
    }

    try {
      this.setData({ submitting: true });
      const result = await submitBasicVerification({ realName, idNumber });

      if (result.success) {
        this.setData({
          status: 'pending',
          level: VERIFICATION_LEVELS.BASIC,
        });
        clearDraft(this); // 提交成功，清除草稿
        // 启动轮询，等待审核结果
        this._startPolling();
      }
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onReApply() {
    this.setData({
      status: 'none',
      realName: '',
      idNumber: '',
    });
    clearDraft(this); // 重新申请时清除草稿
  },

  onBack() {
    wx.navigateBack();
  },
});
