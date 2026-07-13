// pages/reunion/reunion.js
const { ensureLogin } = require('../../../../utils/auth');
const { request } = require('../../../../utils/request');

Page({
  data: {
    processes: [
      { step: 1, title: '进入再出发社区', desc: '无需注册，选择服务方式即可开始' },
      { step: 2, title: '建立专属AI陪伴', desc: '录入成长经历、真实想法和期待' },
      { step: 3, title: '两个AI陪伴深度对话', desc: 'AI陪伴整理并传递真实想法，消除误会' },
      { step: 4, title: '增进理解，建议线下见面', desc: '双方理解加深后，推荐本体见面' },
    ],
  },

  onLoad() {
    ensureLogin().catch(() => {});
  },

  onEnterFreeGroup() {
    wx.navigateTo({ url: '/subpackages/social/pages/group/group?type=reunion' });
  },

  onEnterPremium() {
    wx.navigateTo({ url: '/subpackages/social/pages/reunion/reunion-profile' });
  },
});
