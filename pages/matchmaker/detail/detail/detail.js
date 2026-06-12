// pages/matchmaker/detail/detail - 推荐官详情
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '推荐官详情'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 推荐官详情',
      path: '/subpackages/matchmaker/pages/matchmaker/detail/detail'
    };
  }
});
