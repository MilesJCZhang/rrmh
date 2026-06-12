// pages/user/profile/profile - 个人资料
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '个人资料'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 个人资料',
      path: '/subpackages/user/pages/user/profile/profile'
    };
  }
});
