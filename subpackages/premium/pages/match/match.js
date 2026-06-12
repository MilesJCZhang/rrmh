// subpackages/premium/pages/match/match.js
// 高端AI匹配结果页
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');

Page({
  data: {
    loading: true,
    matchRecord: null,
    aiMatch: null,
    confirmed: false,
    confirming: false,
  },

  onLoad() {
    this.loadMatchStatus();
  },

  async loadMatchStatus() {
    try {
      const resp = await request({ url: API.PREMIUM.MATCH_STATUS });
      const records = resp?.data || resp || [];

      if (records.length > 0) {
        const latest = records[0];
        this.setData({ matchRecord: latest, loading: false });

        // 如果状态是ai_matching，自动开始匹配
        if (latest.status === 'ai_matching') {
          this.startMatch();
        }
      } else {
        // 没有匹配记录，自动开始
        this.startMatch();
      }
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '请先完成验资', icon: 'none' });
    }
  },

  async startMatch() {
    this.setData({ loading: true });
    try {
      const resp = await request({ url: API.PREMIUM.MATCH_START, method: 'POST' });
      const data = resp?.data || resp;
      this.setData({
        matchRecord: { id: data.match_id, status: data.status },
        aiMatch: data.ai_match,
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '匹配启动失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 确认匹配
  async onConfirmMatch() {
    if (!this.data.aiMatch) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认匹配对象',
        content: `确认选择${this.data.aiMatch.nickname}作为匹配对象？确认后可进入基金托管环节。`,
        confirmText: '确认选择',
        confirmColor: '#A07820',
        success: res => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ confirming: true });
    try {
      await request({
        url: API.PREMIUM.MATCH_CONFIRM,
        method: 'POST',
        data: { confirmed_user_id: this.data.aiMatch.user_id },
      });
      this.setData({ confirmed: true, confirming: false });
      wx.showToast({ title: '匹配确认成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '确认失败', icon: 'none' });
      this.setData({ confirming: false });
    }
  },

  // 重新匹配
  onRetryMatch() {
    this.startMatch();
  },

  // 去基金托管
  onGoCustody() {
    wx.navigateTo({ url: `/subpackages/premium/pages/custody/custody?match_record_id=${this.data.matchRecord?.id || ''}` });
  },
});
