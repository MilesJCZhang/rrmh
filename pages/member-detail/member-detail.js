const { request } = require('../../utils/request');
const API = require('../../services/api');

Page({
  data: {
    loading: true,
    errMsg: '',
    member: null,
  },

  onLoad(options) {
    const id = options && options.id;
    if (!id) {
      this.setData({ loading: false, errMsg: '缺少会员ID' });
      return;
    }
    this.loadDetail(id);
  },

  async loadDetail(id) {
    this.setData({ loading: true, errMsg: '' });
    try {
      const res = await request({
        url: `${API.MEMBER.DETAIL}?user_id=${id}`,
        method: 'GET',
      });
      const body = res && res.data ? res.data : res;
      const member = body && (body.data || body);
      if (member && member.id) {
        this.setData({ member, loading: false });
      } else {
        this.setData({ loading: false, errMsg: (body && body.message) || '会员不存在' });
      }
    } catch (e) {
      this.setData({ loading: false, errMsg: (e && e.message) || '网络错误' });
    }
  },

  onPullDownRefresh() {
    const id = this.data.member && this.data.member.id;
    if (id) {
      this.loadDetail(id).then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  },
});
