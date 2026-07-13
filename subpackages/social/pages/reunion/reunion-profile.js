// pages/reunion/reunion-profile.js
const { wxPay, PRICING } = require('../../../../utils/auth');
const { request, uploadFile } = require('../../../../utils/request');
const recorderManager = wx.getRecorderManager();

Page({
  data: {
    step: 'profile', // profile / pay / waiting
    loading: false,
    paying: false,
    recording: false,
    voiceRecorded: false,
    voiceFilePath: '',
    inviteCode: '',
    form: {
      exName: '',
      divorceStatus: 'divorced',
      divorceReason: '',
      reflection: '',
      innerThought: '',
      future: '',
    },
  },

  onLoad() {
    recorderManager.onStop((res) => {
      this.setData({ recording: false, voiceRecorded: true, voiceFilePath: res.tempFilePath });
    });
    recorderManager.onError(() => {
      this.setData({ recording: false });
    });
  },

  onInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value });
  },

  onSelect(e) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.currentTarget.dataset.val });
  },

  onVoiceStart() {
    this.setData({ recording: true });
    recorderManager.start({ duration: 120000, format: 'aac' });
  },

  onVoiceEnd() {
    if (this.data.recording) recorderManager.stop();
  },

  onGoToPay() {
    const f = this.data.form;
    if (!f.divorceReason.trim()) {
      wx.showToast({ title: '请填写过往经历', icon: 'none' });
      return;
    }
    if (!f.innerThought.trim()) {
      wx.showToast({ title: '请填写内心真实想法', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    // 先提交画像数据
    request({
      url: '/reunion/create-avatar',
      method: 'POST',
      data: this.data.form,
    }).then(() => {
      this.setData({ step: 'pay', loading: false });
    }).catch((e) => {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  onBackToProfile() {
    this.setData({ step: 'profile' });
  },

  async onPay() {
    if (this.data.paying) return;
    this.setData({ paying: true });
    try {
      const result = await wxPay({
        type: 'reunion_service',
        amount: PRICING.REUNION * 100,
      });
      if (result.success) {
        // 获取邀请码
        const data = await request({
          url: '/reunion/after-pay',
          method: 'POST',
          data: { order_id: result.orderId },
        });
        this.setData({ step: 'waiting', inviteCode: data.inviteCode });
      } else if (result.reason === 'cancelled') {
        wx.showToast({ title: '支付已取消', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '支付失败', icon: 'none' });
    } finally {
      this.setData({ paying: false });
    }
  },

  onShareInvite() {
    const inviteCode = this.data.inviteCode;
    wx.navigateTo({
      url: `/subpackages/social/pages/reunion/reunion-chat?invite_code=${inviteCode}&mode=share`,
    });
  },

  onCopyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' }),
    });
  },
});
