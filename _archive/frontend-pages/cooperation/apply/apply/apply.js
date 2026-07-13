// pages/cooperation/apply/apply - 合作申请
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '合作申请'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 合作申请',
      path: '/subpackages/partner/pages/cooperation/apply/apply'
    };
  }
});
