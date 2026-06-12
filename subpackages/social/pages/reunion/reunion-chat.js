// pages/reunion/reunion-chat.js
const { request } = require('../../../../utils/request');
const authService = require('../../../../services/auth.service');
const API = require('../../../../services/api');

Page({
  data: {
    mode: 'share',
    inviteCode: '',
    myAvatarImg: '',
    targetAvatarImg: '',
    statusText: 'AI陪伴沟通中…',
    messages: [],
    result: null,
    scrollToMsg: '',
  },

  onLoad(options) {
    const { invite_code, mode, chat_id } = options;
    this.setData({
      mode: mode || 'share',
      inviteCode: invite_code || '',
    });

    if (mode !== 'share') {
      const userInfo = authService.getUserInfo() || {};
      this.setData({ myAvatarImg: userInfo.avatar || '/assets/images/Logo.jpg' });
      if (chat_id) this.loadMessages(chat_id);
    }
  },

  loadMessages(chatId) {
    request({ url: API.REUNION.CHAT_MESSAGES.replace(':chatId', chatId) }).then((data) => {
      this.setData({
        messages: data.messages || [],
        targetAvatarImg: data.targetAvatar || '',
        statusText: data.statusText || '',
        result: data.result,
      });
    }).catch(() => {});
  },

  onArrangeMeet() {
    wx.showToast({ title: '推荐官将联系您安排见面', icon: 'success' });
    request({ url: API.REUNION.ARRANGE_MEET, method: 'POST' }).catch(() => {});
  },
});
