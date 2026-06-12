// pages/group/group.js
const { wxPay, PRICING } = require('../../../../utils/auth');
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');

Page({
  data: {
    groupInfo: {},
    members: [],
    chatStream: [],
    freeRemain: 30,
    type: 'normal',
  },

  onLoad(options) {
    this.setData({ type: options.type || 'normal' });
    this.loadGroupDetail();
  },

  loadGroupDetail() {
    request({ url: `${API.GROUP.DETAIL}?type=${this.data.type}` }).then((data) => {
      this.setData({
        groupInfo: data.group || {},
        members: data.members || [],
        chatStream: data.chatStream || [],
        freeRemain: data.freeRemain || 0,
      });
    }).catch(() => {});
  },

  async onRenew() {
    try {
      const result = await wxPay({ type: 'group_monthly', amount: PRICING.GROUP_MONTHLY * 100 });
      if (result.success) {
        wx.showToast({ title: '续费成功！', icon: 'success' });
        this.loadGroupDetail();
      }
    } catch (e) {
      wx.showToast({ title: '续费失败', icon: 'none' });
    }
  },

  /**
   * 头像加载失败兜底（通用）
   * WXML 中需加 binderror="onAvatarError" data-field="字段名"
   */
  onAvatarError(e) {
    const field = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field) || '';
    if (field && field.indexOf('.') === -1) {
      this.setData({ [field]: '/assets/images/default-avatar.png' });
    }
  },

  /**
   * 列表头像加载失败（循环中使用）
   * WXML 中需加 binderror="onListAvatarError" data-index="{{index}}"
   */
  onListAvatarError(e) {
    const idx = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
    if (idx !== undefined && this.data.members && this.data.members[idx]) {
      this.setData({
        [`members[${idx}].avatar`]: '/assets/images/default-avatar.png',
      });
    }
  },

  /**
   * 聊天流头像加载失败（chatStream 循环）
   */
  onChatStreamAvatarError(e) {
    const idx = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
    if (idx !== undefined && this.data.chatStream && this.data.chatStream[idx]) {
      this.setData({
        [`chatStream[${idx}].avatar`]: '/assets/images/default-avatar.png',
      });
    }
  },
});
