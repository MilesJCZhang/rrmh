// pages/user/membership/membership - 会员中心
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '会员中心'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 会员中心',
      path: '/subpackages/user/pages/user/membership/membership'
    };
  }
});
