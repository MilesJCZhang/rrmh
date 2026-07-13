// pages/cooperation/partners/partners - 合作伙伴
const app = getApp();

Page({
  data: {
    loading: false,
    pageTitle: '合作伙伴'
  },

  onLoad: function(options) {
  },

  onShow: function() {
  },

  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 合作伙伴',
      path: '/subpackages/partner/pages/cooperation/partners/partners'
    };
  }
});
