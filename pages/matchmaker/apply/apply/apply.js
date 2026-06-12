// pages/matchmaker/apply/apply - 申请推荐官
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '申请推荐官'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 申请推荐官',
      path: '/subpackages/matchmaker/pages/matchmaker/apply/apply'
    };
  }
});
