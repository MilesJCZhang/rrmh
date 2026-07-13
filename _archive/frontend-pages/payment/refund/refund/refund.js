// pages/payment/refund/refund - 申请退款
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '申请退款'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 申请退款',
      path: '/subpackages/user/pages/payment/refund/refund'
    };
  }
});
