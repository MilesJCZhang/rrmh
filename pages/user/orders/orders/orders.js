// pages/user/orders/orders - 我的订单
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '我的订单'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 我的订单',
      path: '/subpackages/user/pages/user/orders/orders'
    };
  }
});
