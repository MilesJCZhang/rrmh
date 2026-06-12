// pages/payment/fail/fail - 支付失败
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '支付失败'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 支付失败',
      path: '/subpackages/user/pages/payment/fail/fail'
    };
  }
});
