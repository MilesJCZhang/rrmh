// pages/chat/chat.js
const { request } = require('../../../../utils/request');
const { checkTextSafety, serverCheckText } = require('../../../../utils/contentModeration');
const authService = require('../../../../services/auth.service');
const API = require('../../../../services/api');
const { API_BASE_URL } = require('../../../../utils/config');

Page({
  data: {
    myAvatarImg: '',
    myAvatarName: '我的画像',
    targetAvatarImg: '',
    targetAvatarName: 'TA的画像',
    messages: [],
    chatStatus: 'chatting', // chatting / done / pending
    chatStatusText: '画像聊天进行中…',
    report: null,
    scrollToMsg: '',
    mode: 'active', // active / preview / view / real
    loading: false,
    inputText: '',
  },

  onLoad(options) {
    const { target_id, chat_id, order_id, mode } = options;
    this.setData({ mode: mode || 'active', loading: true });
    this.targetId = target_id;
    this.chatId = chat_id;
    this.orderId = order_id;

    // mode=real: 真人聊天模式
    if (this.data.mode === 'real') {
      wx.setNavigationBarTitle({ title: '线上了解' });
    } else {
      wx.setNavigationBarTitle({ title: 'AI画像聊天' });
    }

    const userInfo = authService.getUserInfo() || {};
    this.setData({
      myAvatarImg: userInfo.avatar || '/assets/images/Logo.jpg',
      loading: false,
    });

    if (chat_id) {
      this.loadChatHistory(chat_id);
    } else if (target_id) {
      this.loadTargetInfo(target_id);
      if (mode === 'active') {
        this.startAvatarChat(target_id, order_id);
      }
    }

    // WebSocket 实时推送画像消息
    this._connectWS();
  },

  loadTargetInfo(targetId) {
    request({ url: API.USER.AVATAR_INFO.replace(':id', targetId) }).then((resp) => {
      const data = resp.data || resp;
      this.setData({
        targetAvatarImg: data.avatar,
        targetAvatarName: data.avatarName,
      });
    }).catch((err) => {
      // 404 静默处理：接口未实现时不弹Toast
      if (err && (err.code === 404 || err.statusCode === 404)) {
        console.log('[chat] avatar-info 404, skipping...');
        return;
      }
      console.error('[chat] loadTargetInfo failed:', err);
      wx.showToast({ title: '加载对方信息失败', icon: 'none' });
    });
  },

  loadChatHistory(chatId) {
    request({ url: API.CHAT.MESSAGES.replace(':chatId', chatId) }).then((resp) => {
      const data = resp.data || resp;
      this.setData({
        messages: data.messages || [],
        chatStatus: data.status || 'done',
        chatStatusText: this._getStatusText(data.status),
        report: data.report,
      });
      this._scrollToBottom();
    }).catch((err) => {
      // 404 静默处理：接口未实现时不弹Toast
      if (err && (err.code === 404 || err.statusCode === 404)) {
        console.log('[chat] messages 404, skipping...');
        return;
      }
      console.error('[chat] loadChatHistory failed:', err);
      wx.showToast({ title: '加载聊天记录失败', icon: 'none' });
    });
  },

  startAvatarChat(targetId, orderId) {
    request({
      url: API.CHAT.START,
      method: 'POST',
      data: { target_user_id: targetId, order_id: orderId },
    }).then((resp) => {
      const data = resp.data || resp;
      this.chatId = data.chatId;
      wx.showToast({ title: '画像开始聊天了！', icon: 'none' });
    }).catch((e) => {
      // 404 静默处理：功能未实现时提示用户
      if (e && (e.code === 404 || e.statusCode === 404)) {
        wx.showToast({ title: '功能开发中', icon: 'none' });
        return;
      }
      wx.showToast({ title: e.message || '启动聊天失败', icon: 'none' });
    });
  },

  _connectWS() {
    // WebSocket 实时接收画像聊天消息
    const token = authService.getToken();
    if (!token) return;

    this.ws = wx.connectSocket({
      url: `wss://${API_BASE_URL.replace('https://', '')}/ws/chat?token=${token}`,
      success: () => {},
    });

    wx.onSocketMessage((res) => {
      const data = JSON.parse(res.data);
      if (data.type === 'message') {
        const msgs = [...this.data.messages, data.message];
        this.setData({ messages: msgs });
        this._scrollToBottom();
      } else if (data.type === 'report') {
        this.setData({
          report: data.report,
          chatStatus: 'done',
          chatStatusText: '画像已完成聊天',
        });
      }
    });
  },

  _getStatusText(status) {
    const map = {
      chatting: '画像聊天进行中…',
      done: '画像已完成聊天',
      pending: '等待对方画像接受',
    };
    return map[status] || status;
  },

  _scrollToBottom() {
    const msgs = this.data.messages;
    if (msgs.length > 0) {
      this.setData({ scrollToMsg: `msg-${msgs[msgs.length - 1].id}` });
    }
  },

  onApplySalon() {
    wx.navigateTo({ url: '/subpackages/activity/pages/salon-list/salon-list' });
  },

  onApplyMeet() {
    wx.showModal({
      title: '申请推荐官邀约见面',
      content: '您的推荐推荐官将联系双方，安排合适时间地点见面',
      editable: true,
      placeholderText: '备注（选填，可填写您的期望时间地点等）',
      confirmText: '确认申请',
      success: async (res) => {
        if (res.confirm) {
          const remark = (res.content || '').trim();

          // 客户端敏感词预检（remark 可选）
          if (remark) {
            const localCheck = checkTextSafety(remark);
            if (!localCheck.safe) {
              wx.showToast({ title: '备注包含不适当内容，请修改', icon: 'none' });
              return;
            }

            // 服务端微信内容安全检测（场景2：评论/约见）
            const serverResult = await serverCheckText(remark, 2);
            if (!serverResult.safe) {
              wx.showToast({ title: '备注包含不适当内容，请修改后重试', icon: 'none' });
              return;
            }
          }

          request({
            url: API.MEET.APPLY,
            method: 'POST',
            data: { chat_id: this.chatId, remark },
          }).then((resp) => {
            const data = resp.data || resp;
            wx.showToast({ title: '申请成功，等待推荐官联系', icon: 'success' });
          }).catch((err) => {
            // 404 静默处理：功能未实现时提示用户
            if (err && (err.code === 404 || err.statusCode === 404)) {
              wx.showToast({ title: '功能开发中', icon: 'none' });
              return;
            }
            console.error('[chat] onApplyMeet failed:', err);
            wx.showToast({ title: '申请失败，请重试', icon: 'none' });
          });
        }
      },
    });
  },

  onChangeTarget() {
    wx.navigateBack();
  },

  // ---- 真人聊天模式输入 ----
  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSendMsg() {
    const text = (this.data.inputText || '').trim();
    if (!text) return;

    const userInfo = authService.getUserInfo() || {};
    const newMsg = {
      id: `local_${Date.now()}`,
      from: 'me',
      senderName: userInfo.nickname || '我',
      avatar: userInfo.avatar || '',
      content: text,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    const messages = [...this.data.messages, newMsg];
    this.setData({ messages, inputText: '' });
    this._scrollToBottom();

    // 通过WebSocket发送消息
    if (this.ws && this.ws.readyState === 1) {
      wx.sendSocketMessage({
        data: JSON.stringify({
          type: 'message',
          target_user_id: this.targetId,
          content: text,
          mode: 'real',
        }),
      });
    }
  },

  onUnload() {
    if (this.ws) {
      wx.closeSocket();
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
   * 消息列表头像加载失败（循环中使用）
   * WXML 中需加 binderror="onMsgAvatarError" data-index="{{index}}"
   */
  onMsgAvatarError(e) {
    const idx = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
    if (idx !== undefined && this.data.messages && this.data.messages[idx]) {
      this.setData({
        [`messages[${idx}].avatar`]: '/assets/images/default-avatar.png',
      });
    }
  },
});
