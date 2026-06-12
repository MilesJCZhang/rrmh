// pages/match/match.js - AI推荐页（评分分层 + 解锁）
const { wxPay, checkProfile, PRICING } = require('../../utils/auth');
const { request } = require('../../utils/request');
const authService = require('../../services/auth.service');
const API = require('../../services/api');
const { FEATURES } = require('../../utils/config');
const { getTierInfo } = require('../../utils/scoreHelper');

Page({
  data: {
    activeTab: 'recommend',
    hasProfile: false,
    hasAvatar: false,
    isMatchmaker: false,
    isPaid: false,
    // 评分相关
    profileScore: 0,
    scoreTier: 'unrated',
    tierInfo: null,
    tierAccessInfo: null,
    // 推荐列表
    matchList: [],
    memberAvatarList: [],
    myGroup: null,
    groupFreeRemain: 0,
    groupChats: [],
    chatHistory: [],
    joiningGroup: false,
    // 支付/解锁
    showPayModal: false,
    payTarget: null,
    paying: false,
    // 加载状态
    loading: false,
    refreshing: false,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    distanceOptions: [
      { val: 'nearby', label: '📍 附近' },
      { val: 'same_city', label: '🏙️ 同城' },
      { val: 'same_province', label: '🗺️ 同省' },
      { val: 'nationwide', label: '🌍 全国' },
    ],
    filter: {
      distance: 'same_city',
    },
  },

  onLoad(options) {
    const hasProfile = authService.hasProfile();
    const hasAvatar = authService.hasAvatar();
    const isMatchmaker = authService.isMatchmaker();
    const isPaid = authService.isPaid();
    const app = getApp();
    const profileScore = app?.globalData?.profileScore || 0;
    const scoreTier = app?.globalData?.scoreTier || 'unrated';

    this.setData({
      hasProfile, hasAvatar, isMatchmaker, isPaid,
      profileScore, scoreTier,
      tierInfo: getTierInfo(scoreTier),
    });

    if (options && options.paid === 'pending') {
      this._pollPaymentConfirmation();
    }

    if (isMatchmaker) {
      this.setData({ activeTab: 'recommend' });
    }
    this.loadData();

    // 加载tier权限信息
    this._loadTierAccess();
  },

  onShow() {
    const hasProfile = authService.hasProfile();
    const hasAvatar = authService.hasAvatar();
    const isMatchmaker = authService.isMatchmaker();
    const isPaid = authService.isPaid();
    const oldMk = this.data.isMatchmaker;
    const app = getApp();
    const profileScore = app?.globalData?.profileScore || 0;
    const scoreTier = app?.globalData?.scoreTier || 'unrated';

    this.setData({
      hasProfile, hasAvatar, isMatchmaker, isPaid,
      profileScore, scoreTier,
      tierInfo: getTierInfo(scoreTier),
    });

    if (oldMk !== isMatchmaker) {
      this.setData({ page: 1, hasMore: true });
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true, page: 1, hasMore: true });
    this.loadMatchList().finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.loadMore();
    }
  },

  // 加载tier权限
  _loadTierAccess() {
    request({ url: API.MATCH.TIER_ACCESS }).then((resp) => {
      const data = resp?.data || resp;
      this.setData({ tierAccessInfo: data });
    }).catch(() => {});
  },

  loadData() {
    this.loadMatchList();
    if (this.data.isMatchmaker) {
      this.loadMemberAvatarList();
    } else if (FEATURES.CHAT_ENABLED) {
      this.loadGroupInfo();
    }
    if (FEATURES.CHAT_ENABLED) {
      this.loadChatHistory();
    }
  },

  loadMatchList() {
    wx.showLoading({ title: '加载中...' });
    const token = authService.getToken();
    const hasProfile = authService.hasProfile();
    if (!token || (!hasProfile && !this.data.isMatchmaker)) {
      wx.hideLoading();
      return;
    }

    this.setData({ page: 1, hasMore: true });
    const url = this.data.isMatchmaker ? API.MATCHMAKER.MY_MEMBERS : API.MATCH.RECOMMEND;
    const data = this.data.isMatchmaker
      ? { distance: this.data.filter.distance, limit: 20, page: 1, pageSize: this.data.pageSize }
      : { distance: this.data.filter.distance, limit: this.data.pageSize, page: 1, pageSize: this.data.pageSize };

    request({ url, data })
      .then((resp) => {
        const responseData = (resp && resp.data !== undefined) ? resp.data : resp;
        const list = responseData.list || [];
        const viewerTier = responseData.viewerTier || this.data.scoreTier;

        const ROLE_TEXT_MAP = {
          public_matchmaker: '公益推荐官', partner_matchmaker: '联创推荐官',
          professional_recommender: '专业推荐官', city_franchisee: '城市合伙人',
          community_station: '社区服务站', single: '会员', member: '会员',
          user: '用户', admin: '管理员',
        };

        const listWithLoading = list.map(item => ({
          ...item,
          avatar: item.avatar || '/assets/images/default-avatar.png',
          age: item.age || null,
          city: item.city || null,
          intro: item.intro || '暂无简介',
          tags: Array.isArray(item.tags) ? item.tags : [],
          roleText: ROLE_TEXT_MAP[item.role] || item.role,
          avatarLoading: true,
          avatarError: false,
          // 评分相关
          profileScore: item.profile_score || item.profileScore || 0,
          scoreTier: item.score_tier || item.scoreTier || 'unrated',
          isUnlocked: item.isUnlocked || false,
          canOnlineUnlock: item.canOnlineUnlock || false,
          onlinePrice: item.onlinePrice || 0,
        }));

        this.setData({
          matchList: listWithLoading,
          hasMore: list.length >= this.data.pageSize,
          scoreTier: viewerTier,
        });

        if (!list || list.length === 0) {
          wx.showToast({ title: '暂无推荐，试试调整筛选条件', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.showToast({ title: '加载失败，请下拉重试', icon: 'none', duration: 2000 });
        console.error('[match] loadMatchList failed:', err);
      })
      .finally(() => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
      });
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });
    const nextPage = this.data.page + 1;
    const url = this.data.isMatchmaker ? API.MATCHMAKER.MY_MEMBERS : API.MATCH.RECOMMEND;
    const data = this.data.isMatchmaker
      ? { distance: this.data.filter.distance, limit: 20, page: nextPage, pageSize: this.data.pageSize }
      : { distance: this.data.filter.distance, limit: this.data.pageSize, page: nextPage, pageSize: this.data.pageSize };

    request({ url, data })
      .then((resp) => {
        const responseData = (resp && resp.data !== undefined) ? resp.data : resp;
        const newList = responseData.list || [];

        const ROLE_TEXT_MAP = {
          public_matchmaker: '公益推荐官', partner_matchmaker: '联创推荐官',
          professional_recommender: '专业推荐官', city_franchisee: '城市合伙人',
          community_station: '社区服务站', single: '会员', member: '会员',
          user: '用户', admin: '管理员',
        };

        const newListWithLoading = newList.map(item => ({
          ...item,
          avatar: item.avatar || '/assets/images/default-avatar.png',
          age: item.age || null,
          city: item.city || null,
          intro: item.intro || '暂无简介',
          tags: Array.isArray(item.tags) ? item.tags : [],
          roleText: ROLE_TEXT_MAP[item.role] || item.role,
          avatarLoading: true,
          avatarError: false,
          profileScore: item.profile_score || item.profileScore || 0,
          scoreTier: item.score_tier || item.scoreTier || 'unrated',
          isUnlocked: item.isUnlocked || false,
          canOnlineUnlock: item.canOnlineUnlock || false,
          onlinePrice: item.onlinePrice || 0,
        }));

        const allList = [...this.data.matchList, ...newListWithLoading];
        this.setData({
          matchList: allList,
          page: nextPage,
          hasMore: newList.length >= this.data.pageSize,
          loadingMore: false,
        });
      })
      .catch((err) => {
        console.error('[match] loadMore failed:', err);
        this.setData({ loadingMore: false });
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      });
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`matchList[${index}].avatar`]: '/assets/images/default-avatar.png',
      [`matchList[${index}].avatarLoading`]: false,
      [`matchList[${index}].avatarError`]: false,
    });
  },

  onImageLoad(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`matchList[${index}].avatarLoading`]: false });
  },

  loadGroupInfo() {
    const token = authService.getToken();
    if (!token) return;
    request({ url: API.GROUP.MINE }).then((resp) => {
      const data = resp && resp.data !== undefined ? resp.data : resp;
      this.setData({
        myGroup: data,
        groupFreeRemain: data?.freeRemain || 0,
        groupChats: data?.recentChats || [],
      });
    }).catch((err) => {
      if (err.code === 404) {
        this.setData({ myGroup: null, groupFreeRemain: 0, groupChats: [] });
      } else {
        console.error('[match] loadGroupInfo failed:', err);
      }
    });
  },

  loadMemberAvatarList() {
    const mockList = [
      { id: 'm001', name: '小雨', avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTImjR2F2w2ibgG2k3iaYpBDOOf4qR5Q0Vh7Jn2G3rBic6JaT9mK0nkNzQ/0', age: 28, city: '威海', avatarStatus: 'active', matchCount: 12, chatCount: 5, interestCount: 3, recentActivity: '今天与「阳光先生」画像聊了15分钟，互感兴趣' },
      { id: 'm002', name: '阿梅', avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTImjR2F2w2ibgG2k3iaYpBDOOf4qR5Q0Vh7Jn2G3rBic6JaT9mK0nkNzQ/0', age: 35, city: '青岛', avatarStatus: 'active', matchCount: 8, chatCount: 3, interestCount: 1, recentActivity: '昨天新推荐2位，正在画像聊中' },
      { id: 'm003', name: '张姐', avatar: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTImjR2F2w2ibgG2k3iaYpBDOOf4qR5Q0Vh7Jn2G3rBic6JaT9mK0nkNzQ/0', age: 42, city: '烟台', avatarStatus: 'chatting', matchCount: 15, chatCount: 9, interestCount: 4, recentActivity: '正在与「沉稳哥」一对一深度画像聊' },
    ];
    this.setData({ memberAvatarList: mockList });
  },

  loadChatHistory() {
    const token = authService.getToken();
    if (!token) return;
    request({ url: API.CHAT.HISTORY }).then((resp) => {
      const data = resp && resp.data !== undefined ? resp.data : resp;
      this.setData({ chatHistory: data || [] });
    }).catch((err) => {
      if (err.code === 404) {
        this.setData({ chatHistory: [] });
      } else {
        console.error('[match] loadChatHistory failed:', err);
      }
    });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'history' && FEATURES.CHAT_ENABLED) this.loadChatHistory();
    if (tab === 'group') {
      if (this.data.isMatchmaker) this.loadMemberAvatarList();
      else if (FEATURES.CHAT_ENABLED) this.loadGroupInfo();
    }
  },

  onFilterChange(e) {
    const { key, val } = e.currentTarget.dataset;
    this.setData({ [`filter.${key}`]: val });
    this.loadMatchList();
  },

  // 点击推荐卡片
  onMatchTap(e) {
    const item = e.currentTarget.dataset.item;
    if (this.data.isMatchmaker) {
      wx.navigateTo({ url: `/pages/member-detail/member-detail?id=${item.id}` });
    } else {
      // 已解锁：进入真人聊天；未解锁：进入预览
      const mode = item.isUnlocked ? 'real' : 'preview';
      wx.navigateTo({
        url: `/subpackages/social/pages/chat/chat?target_id=${item.id}&mode=${mode}`,
      });
    }
  },

  // 线上解锁按钮
  onOnlineUnlock(e) {
    if (!checkProfile()) return;
    const id = e.currentTarget.dataset.id;
    const target = this.data.matchList.find(m => m.id === id);
    if (!target) return;

    // 检查viewer的tier
    if (this.data.scoreTier === 'bronze' || this.data.scoreTier === 'unrated') {
      wx.showModal({
        title: '评分不足',
        content: '您的资料评分需达到60分以上才可线上了解对方，请先完善资料',
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/register/register' });
        },
      });
      return;
    }

    this.setData({ showPayModal: true, payTarget: target });
  },

  // 线下了解按钮
  onOfflineMeet(e) {
    wx.navigateTo({ url: '/subpackages/activity/pages/salon-list/salon-list' });
  },

  onClosePayModal() {
    this.setData({ showPayModal: false, payTarget: null });
  },

  // 确认支付解锁
  async onConfirmPay() {
    if (this.data.paying) return;
    wx.vibrateShort({ type: 'medium' });
    this.setData({ paying: true });

    try {
      const target = this.data.payTarget;
      // 调用后端解锁接口
      const resp = await request({
        url: API.UNLOCK.ONLINE,
        method: 'POST',
        data: { target_user_id: target.id },
      });

      const data = resp?.data || resp;

      if (data.already_unlocked) {
        // 已经解锁过
        this.setData({ showPayModal: false });
        wx.navigateTo({
          url: `/subpackages/social/pages/chat/chat?target_id=${target.id}&mode=real`,
        });
        return;
      }

      if (data.status === 'paid' || data.out_trade_no) {
        // 模拟支付或订单创建成功
        this.setData({ showPayModal: false });

        // 更新列表中该用户的解锁状态
        const idx = this.data.matchList.findIndex(m => m.id === target.id);
        if (idx >= 0) {
          this.setData({
            [`matchList[${idx}].isUnlocked`]: true,
            [`matchList[${idx}].unlockType`]: 'online',
          });
        }

        wx.showToast({ title: '解锁成功！', icon: 'success' });
        setTimeout(() => {
          wx.navigateTo({
            url: `/subpackages/social/pages/chat/chat?target_id=${target.id}&mode=real&order_id=${data.order_id || ''}`,
          });
        }, 500);
      }
    } catch (e) {
      wx.showToast({ title: e.message || '解锁失败', icon: 'none' });
    } finally {
      this.setData({ paying: false });
    }
  },

  // 开始AI画像聊天
  onStartChat(e) {
    if (this.data.isMatchmaker) {
      const item = e.currentTarget.dataset;
      wx.navigateTo({ url: `/pages/member-detail/member-detail?id=${item.id}` });
      return;
    }
    if (!checkProfile()) return;
    const hasAvatar = authService.hasAvatar();
    if (!hasAvatar) {
      wx.showModal({
        title: '需要先生成AI画像',
        content: '画像聊天需要您的AI画像参与，请先完成语音录入生成画像',
        confirmText: '去生成',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/avatar/avatar' });
        },
      });
      return;
    }
    const id = e.currentTarget.dataset.id;
    const target = this.data.matchList.find(m => m.id === id);
    if (target) {
      this.setData({ showPayModal: true, payTarget: target });
    }
  },

  // 加入推荐群
  async onJoinGroup() {
    if (!checkProfile()) return;
    const hasAvatar = authService.hasAvatar();
    if (!hasAvatar) {
      wx.showModal({
        title: '需要AI画像才能进群',
        content: '进入推荐群需要您的AI画像，请先完成语音录入',
        confirmText: '去生成画像',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/avatar/avatar' });
        },
      });
      return;
    }

    this.setData({ joiningGroup: true });
    try {
      const resp = await request({ url: API.GROUP.JOIN, method: 'POST' });
      const data = resp && resp.data !== undefined ? resp.data : resp;
      this.setData({ myGroup: data });
      wx.showToast({ title: '画像已进群！', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '加入失败', icon: 'none' });
    } finally {
      this.setData({ joiningGroup: false });
    }
  },

  // 群月费续费
  async onRenewGroup() {
    try {
      const result = await wxPay({
        type: 'group_monthly',
        amount: PRICING.GROUP_MONTHLY * 100,
      });
      if (result.success) {
        wx.showToast({ title: '续费成功！', icon: 'success' });
        this.loadGroupInfo();
      }
    } catch (e) {
      wx.showToast({ title: '续费失败', icon: 'none' });
    }
  },

  onHistoryTap(e) {
    wx.navigateTo({ url: `/subpackages/social/pages/chat/chat?chat_id=${e.currentTarget.dataset.id}&mode=view` });
  },

  onResetFilter() {
    this.setData({ filter: { distance: 'same_city' }, page: 1, hasMore: true });
    this.loadMatchList();
  },

  onGoProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onGoRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  // 高端验资入口
  onGoPremium() {
    wx.navigateTo({ url: '/subpackages/premium/pages/verify/verify' });
  },

  // 沙龙入口
  onGoSalon() {
    wx.navigateTo({ url: '/subpackages/activity/pages/salon-list/salon-list' });
  },

  // 继续完善资料
  onImproveScore() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  _pollPaymentConfirmation() {
    const maxAttempts = 5;
    let attempts = 0;
    const poll = () => {
      attempts++;
      const lastOrderId = wx.getStorageSync('last_order_id');
      if (!lastOrderId) return;
      const { checkPaymentStatus } = require('../../utils/payment');
      checkPaymentStatus(lastOrderId).then((statusData) => {
        if (statusData && statusData.paid) {
          const authService = require('../../services/auth.service');
          authService.setIsPaid(true);
          this.setData({ isPaid: true });
          wx.showToast({ title: '支付已确认', icon: 'success' });
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        }
      }).catch(() => {
        if (attempts < maxAttempts) setTimeout(poll, 2000);
      });
    };
    poll();
  },

  onAvatarError(e) {
    const field = (e?.currentTarget?.dataset?.field) || '';
    if (field && field.indexOf('.') === -1) {
      this.setData({ [field]: '/assets/images/default-avatar.png' });
    }
  },

  onListAvatarError(e) {
    const idx = e?.currentTarget?.dataset?.index;
    if (idx !== undefined && this.data.list?.[idx]) {
      this.setData({ [`list[${idx}].avatar`]: '/assets/images/default-avatar.png' });
    }
  },
});
