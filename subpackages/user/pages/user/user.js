// pages/user/user.js - 个人中心
const authService = require('../../../../services/auth.service');
const API = require('../../../../services/api');
const commissionRules = require('../../../../utils/commissionRules');
const { API_BASE_URL } = require('../../../../utils/config');

Page({
  data: {
    // 用户信息
    avatarUrl: '',
    nickName: '',
    userId: '',
    phone: '',  // 手机号
    userLevel: '',
    points: 0,
    isVip: false,
    isRecommender: false,
    isProfessionalRecommender: false, // 专业推荐官标识
    isCommunityStation: false,        // 社区服务站标识
    isCityFranchisee: false,           // 城市合伙人标识

    // 当前身份信息
    currentRole: '',
    currentRoleLabel: '',
    identityList: [],  // 所有可用身份列表

    // 推荐官收益
    todayIncome: 0,
    monthIncome: 0,
    totalIncome: 0,
    withdrawable: 0
  },

  onLoad: function(options) {
    this.loadUserData();
  },

  onShow: function() {
    this.loadUserData();
  },

  // 加载用户数据
  loadUserData: function() {
    const isLogin = authService.isLogin();
    const userInfo = authService.getUserInfo();
    
    if (!isLogin || !userInfo) {
      // 未登录，触发静默登录
      const { requireLogin } = require('../../../../utils/auth');
      requireLogin('请先登录', false);
      return;
    }

    const role = userInfo.role || authService.getUserRole();
    const isProfessionalRecommender = role === commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER
      || role === 'professional_recommender';
    const isCommunityStation = role === commissionRules.USER_ROLES.COMMUNITY_STATION
      || role === 'community_station';
    const isCityFranchisee = role === commissionRules.USER_ROLES.CITY_FRANCHISEE
      || role === 'city_franchisee';
    const isMatchmaker = isProfessionalRecommender || isCommunityStation || isCityFranchisee;

    const mockData = {
      avatarUrl: userInfo.avatar || '',
      nickName: userInfo.name || '用户',
      userId: userInfo.id || '001',
      phone: userInfo.phone || '',  // 加载手机号
      userLevel: this.getUserLevel(userInfo),
      points: 1500,
      isVip: userInfo.role === 'vip',
      isRecommender: isMatchmaker,
      isProfessionalRecommender,
      isCommunityStation,
      isCityFranchisee,
      currentRole: role,
      currentRoleLabel: this._getRoleLabel(role),

      // 推荐官收益数据（真实数据从后端接口获取）
      todayIncome: 0,
      monthIncome: 0,
      totalIncome: 0,
      withdrawable: 0
    };

    this.setData(mockData);
    this._buildIdentityList(userInfo);
  },

  // 获取角色标签
  _getRoleLabel: function(role) {
    const map = {
      user: '普通用户',
      public_matchmaker: '公益推荐官',
      partner_matchmaker: '联创推荐官',
      community_station: '社区服务站',
      professional_recommender: '专业推荐官',
      city_franchisee: '城市合伙人',
    };
    return map[role] || '普通用户';
  },

  // 构建身份列表
  _buildIdentityList: function(userInfo) {
    const currentRole = userInfo.role;
    const roles = userInfo.roles || [];

    const roleConfig = {
      public_matchmaker: { icon: '🌿', label: '公益推荐官', color: '#8BC34A', path: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench' },
      partner_matchmaker: { icon: '👑', label: '联创推荐官', color: '#FF9800', path: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench' },
      community_station: { icon: '🏘️', label: '社区服务站', color: '#2E7D32', path: '/subpackages/partner/pages/community-station/workbench/workbench' },
      professional_recommender: { icon: '💎', label: '专业推荐官', color: '#9C27B0', path: '/subpackages/matchmaker/pages/recommender/recommender' },
      city_franchisee: { icon: '🏙️', label: '城市合伙人', color: '#1565C0', path: '/subpackages/partner/pages/franchisee/dashboard/dashboard' },
    };

    const identityList = [];

    // 当前身份
    if (currentRole && roleConfig[currentRole]) {
      identityList.push({ role: currentRole, ...roleConfig[currentRole], isCurrent: true });
    }

    // 其他身份
    roles.forEach(r => {
      if (r !== currentRole && roleConfig[r]) {
        identityList.push({ role: r, ...roleConfig[r], isCurrent: false });
      }
    });

    this.setData({ identityList });
  },

  // 切换身份
  onSwitchIdentity: function(e) {
    const index = e.currentTarget.dataset.index;
    const identity = this.data.identityList[index];
    if (!identity || identity.isCurrent) return;

    wx.showModal({
      title: '切换身份',
      content: `确定切换到【${identity.label}】？`,
      success: res => {
        if (res.confirm) {
          // 使用 authService 统一更新状态
          authService.setUserRole(identity.role);
          wx.redirectTo({ url: identity.path });
        }
      },
    });
  },

  // 进入社区服务站工作台
  navigateToCommunityStation: function() {
    if (!this.data.isCommunityStation) {
      wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=community' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/partner/pages/community-station/workbench/workbench' });
  },

  // 进入城市合伙人工作台
  navigateToFranchisee: function() {
    if (!this.data.isCityFranchisee) {
      wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=city' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/partner/pages/franchisee/dashboard/dashboard' });
  },

  // 导航函数
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/profile/profile'
    });
  },

  navigateToOrders: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/orders/orders'
    });
  },

  navigateToMembership: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/membership/membership'
    });
  },

  navigateToSettings: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/settings/settings'
    });
  },

  navigateToCustomerService: function() {
    wx.makePhoneCall({
      phoneNumber: '400-123-4567'
    });
  },

  navigateToFeedback: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/feedback/feedback'
    });
  },

  // 推荐官相关导航
  navigateToRecommenderOpen: function() {
    wx.navigateTo({
      url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional'
    });
  },

  navigateToRecommender: function() {
    if (!this.data.isRecommender) {
      this.navigateToRecommenderOpen();
      return;
    }
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/recommender'
    });
  },

  navigateToRecommenderIncome: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/income/income'
    });
  },

  // 获取手机号（绑定手机号）
  onGetPhone: function(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '授权失败', icon: 'none' });
      return;
    }

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '绑定中...' });

    wx.request({
      url: `${API_BASE_URL}${API.AUTH.BIND_PHONE}`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + token
      },
      data: {
        code: e.detail.code
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showToast({ title: '手机号绑定成功' });
          this.setData({ phone: res.data.data.phone });
        } else {
          wx.showToast({ title: res.data.message || '绑定失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  // 分享应用
  shareApp: function() {
    wx.shareAppMessage({
      title: '人人好媒 - 专业社交服务平台',
      path: '/pages/index/index',
      imageUrl: '/assets/images/Logo.jpg'
    });
  },

  // 页面分享
  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 专业社交服务平台',
      path: '/pages/index/index',
      imageUrl: '/assets/images/Logo.jpg'
    };
  },

  // 头像加载失败兜底
  onAvatarError() {
    this.setData({ avatarUrl: '/assets/images/default-avatar.png' });
  },
});