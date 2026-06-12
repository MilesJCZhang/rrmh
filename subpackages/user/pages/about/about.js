// pages/about/about.js - 关于人人媒好
const config = require('../../../../utils/config.js');
Page({
  data: {
    version: config.VERSION,

    // 法律信息
    legalInfo: {
      icpNo: '鲁ICP备2026016754号',
      businessLicense: '92371000MA3JJYML8T',
      companyName: '威海火炬高技术产业开发区人人媒好婚介中心',
      companyType: '个体工商户',
      address: '山东省威海市火炬高技术产业开发区怡园街道山海郡78号601',
      supportEmail: 'support@rrmhdate.cn',
      unsubscribePolicy: '本平台服务一经使用不支持退款，详情见服务协议',
      minorStatement: '本平台仅向18周岁及以上用户提供服务',
    },
  },

  onViewAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + (type === 'privacy' ? 'privacy' : 'platform') });
  },
});
