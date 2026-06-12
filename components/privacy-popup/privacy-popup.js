// components/privacy-popup/privacy-popup.js
// 微信隐私协议弹窗组件（基础库 2.32.3+ 必须实现）
Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    // 用户同意隐私协议
    onAgree() {
      const app = getApp();
      if (app.globalData.privacyResolveCallback) {
        app.globalData.privacyResolveCallback({ buttonId: 'agree-btn', event: 'agree' });
        app.globalData.privacyResolveCallback = null;
      }
      app.globalData.showPrivacyPopup = false;
      this.triggerEvent('close');
    },

    // 用户拒绝隐私协议（游客模式进入）
    onReject() {
      const app = getApp();
      if (app.globalData.privacyResolveCallback) {
        app.globalData.privacyResolveCallback({ buttonId: 'reject-btn', event: 'disagree' });
        app.globalData.privacyResolveCallback = null;
      }
      app.globalData.showPrivacyPopup = false;
      this.triggerEvent('close');
      // 拒绝非必要信息收集，以游客模式进入，限制部分核心功能
      wx.showToast({
        title: '已以游客模式进入，部分功能受限',
        icon: 'none',
        duration: 2500,
      });
      // 设置游客模式标记（仅拒绝非必要信息，基础服务仍可用）
      wx.setStorageSync('privacy_guest_mode', true);
    },

    // 查看隐私政策
    onViewPrivacy() {
      wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
    },
  },
});
