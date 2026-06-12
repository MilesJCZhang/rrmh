// pages/customer-service/customer-service - 联系客服
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '联系客服'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 联系客服',
      path: '/pages/customer-service/customer-service'
    };
  }
});
