const authService = require('../../../../../services/auth.service');
const { request, uploadFile } = require('../../../../../utils/request');
const commissionRules = require('../../../../../utils/commissionRules');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,
    hasNickname: false,
    hasAvatar: false,
    needsWechatAuth: false,
    userRoleName: '',
    canUpgradeRecommender: false,
    hasUserInfoAuth: false,
    
    // 收益概览（仅推荐官可见）
    recommenderIncome: {
      today: 0,
      month: 0,
      total: 0,
      withdrawable: 0
    },
    
    // 功能菜单
    menuItems: [
      {
        id: 'profile',
        icon: '/images/icon/edit.png',
        title: '个人资料',
        desc: '完善个人信息',
        path: '/subpackages/user/pages/user/profile/profile',
        show: true
      },
      {
        id: 'orders',
        icon: '/images/icon/calendar.png',
        title: '我的订单',
        desc: '活动报名记录',
        path: '/subpackages/user/pages/user/orders/orders',
        show: true
      },
      {
        id: 'membership',
        icon: '/images/icon/vip.png',
        title: '会员中心',
        desc: '会员权益查看',
        path: '/subpackages/user/pages/user/membership/membership',
        show: true
      },
      {
        id: 'recommender',
        icon: '/images/icon/star.png',
        title: '推荐官中心',
        desc: '全业务推广收益',
        path: '/subpackages/matchmaker/pages/recommender/recommender',
        show: false
      },
      {
        id: 'recommender_open',
        icon: '/images/icon/heart.png',
        title: '升级推荐官',
        desc: '开通全业务收益权限',
        path: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional',
        show: false
      },
      {
        id: 'matchmaker_apply',
        icon: '/images/icon/matchmaker.png',
        title: '成为推荐官',
        desc: '开启推荐官服务',
        path: '/subpackages/matchmaker/pages/matchmaker/apply/apply',
        show: false
      },
      {
        id: 'cooperation',
        icon: '/images/icon/cooperation.png',
        title: '合作加盟',
        desc: '多种合作模式',
        path: '/subpackages/partner/pages/cooperation/intro/intro',
        show: true
      },
      {
        id: 'customer_service',
        icon: '/images/icon/contact.png',
        title: '联系客服',
        desc: '在线咨询帮助',
        path: '/pages/customer-service/customer-service',
        show: true
      },
      {
        id: 'setting',
        icon: '/images/icon/setting.png',
        title: '设置',
        desc: '系统设置',
        path: '',
        show: true
      }
    ],
    
    // 快捷操作
    quickActions: [
      {
        id: 'activity',
        icon: '/images/icon/activity.png',
        title: '活动报名',
        path: '/subpackages/social/pages/activity/list/list'
      },
      {
        id: 'matchmaker',
        icon: '/images/icon/matchmaker.png',
        title: '推荐官服务',
        path: '/subpackages/matchmaker/pages/matchmaker/list/list'
      },
      {
        id: 'cooperation',
        icon: '/images/icon/cooperation.png',
        title: '合作加盟',
        path: '/subpackages/partner/pages/cooperation/intro/intro'
      }
    ]
  },

  onLoad: function(options) {
    this.loadUserInfo();
  },

  onShow: function() {
    this.loadUserInfo();
    // 同步授权状态
    this.setData({ hasUserInfoAuth: !!wx.getStorageSync('has_userinfo_auth') });
  },

  // 加载用户信息
  loadUserInfo: function() {
    const isLogin = authService.isLogin();
    const userInfo = authService.getUserInfo();

    // 判断昵称是否有效（排除默认值和空值）
    const rawNickname = userInfo && userInfo.nickname;
    const hasNickname = !!rawNickname && rawNickname !== '未设置昵称' && rawNickname.trim() !== '';

    // 判断头像是否有效（排除空值和默认头像）
    const rawAvatar = userInfo && userInfo.avatar;
    const isDefaultAvatar = !rawAvatar || rawAvatar.trim() === '' ||
      rawAvatar.includes('default-avatar') ||
      rawAvatar.includes('default_avatar') ||
      rawAvatar.includes('rrmhdate.cn') === false && rawAvatar.startsWith('http') === false && rawAvatar.startsWith('/') === false;
    const hasAvatar = !!rawAvatar && !isDefaultAvatar;

    // 已登录但未完成微信授权（昵称或头像缺失）
    const needsWechatAuth = isLogin && (!hasNickname || !hasAvatar);

    // 标准化 role（后端返回带 user/ 前缀，前端统一去掉）
    let normalizedRole = userInfo ? userInfo.role : 'user';
    if (normalizedRole && normalizedRole.startsWith('user/')) {
      normalizedRole = normalizedRole.replace('user/', '');
    }
    if (userInfo) {
      userInfo.role = normalizedRole;
    }

    // 获取身份名称映射
    const ROLE_NAME_MAP = {
      'user': '普通用户',
      'public_matchmaker': '公益推荐官',
      'partner_matchmaker': '联创推荐官',
      'professional_recommender': '专业推荐官',
      'city_franchisee': '城市合伙人',
      'community_station': '社区服务站',
    };
    const userRoleName = ROLE_NAME_MAP[normalizedRole] || '普通用户';

    // 更新菜单显示状态
    this.updateMenuItems(userInfo, isLogin);

    this.setData({
      userInfo,
      isLogin,
      hasNickname,
      hasAvatar,
      needsWechatAuth,
      userRoleName
    });
  },

  // 更新菜单项显示状态
  updateMenuItems: function(userInfo, isLogin) {
    const menuItems = this.data.menuItems;
    const userRole = userInfo ? userInfo.role : 'user';
    
    const canUpgradeRecommender = isLogin && 
      userRole !== commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER &&
      commissionRules.canUpgradeToProfessionalRecommender(userRole);
    
    // 判断是否为推荐官身份（所有带推荐官/合伙人/服务站身份）
    const isRecommender = userRole !== 'user' && userRole !== '';

    // 更新各个菜单项的显示状态
    menuItems.forEach(item => {
      switch(item.id) {
        case 'recommender':
          // 所有推荐官身份都显示推荐官中心
          item.show = isRecommender;
          break;
        case 'recommender_open':
          item.show = canUpgradeRecommender;
          break;
        case 'matchmaker_apply':
          // 只有普通用户显示"成为推荐官"
          item.show = isLogin && userRole === 'user';
          break;
        default:
          break;
      }
    });
    
    this.setData({ 
      menuItems,
      canUpgradeRecommender
    });
  },

  // 跳转到收益明细
  navigateToIncome: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/income/income'
    });
  },

  // 跳转到推荐官升级页面
  navigateToRecommenderOpen: function() {
    wx.navigateTo({
      url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional'
    });
  },

  // 跳转到个人资料页
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/profile/profile'
    });
  },

  // 用户登录
  onLogin: function() {
    const { requireLogin } = require('../../../../../utils/auth');
    requireLogin('请先登录', false);
  },

  // 用户退出登录
  onLogout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          authService.clearUserState();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  },

  // 处理菜单项点击
  onMenuItemTap: function(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.menuItems[index];
    
    if (!item.path) {
      if (item.id === 'setting') {
        this.handleSetting();
      }
      return;
    }
    
    // 检查是否需要登录
    if (item.requireLogin && !this.data.isLogin) {
      app.showToast('请先登录');
      app.navigateToLogin();
      return;
    }
    
    wx.navigateTo({
      url: item.path
    });
  },

  // 处理快捷操作点击
  onQuickActionTap: function(e) {
    const index = e.currentTarget.dataset.index;
    const action = this.data.quickActions[index];
    
    if (action.path) {
      wx.navigateTo({
        url: action.path
      });
    }
  },

  // 微信选择头像回调
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    wx.showLoading({ title: '上传头像中...' });

      uploadFile(avatarUrl, 'avatar').then(res => {
      const url = (res.data && res.data.url) || res.url || res;
      // 同步本地 + 后端
      const info = this.data.userInfo || {};
      info.avatar = url;
      this.setData({ userInfo: info, hasAvatar: true, needsWechatAuth: !this.data.hasNickname });
      wx.setStorageSync('user_info', info);
      authService.setHasAvatar(true);
      wx.hideLoading();
      wx.showToast({ title: '头像更新成功', icon: 'success' });
      // 如果还没设置有效昵称，提示用户
      if (!this.data.hasNickname) {
        wx.showModal({
          title: '完善资料',
          content: '头像已更新，请填写微信昵称完成授权',
          showCancel: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('[onChooseAvatar] 上传失败', err);
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    });
  },

  // 微信昵称输入回调
  onNicknameInput(e) {
    const nickname = e.detail.value;
    if (!nickname || nickname === (this.data.userInfo && this.data.userInfo.nickname)) return;

    request({
      url: '/v1/user/profile/update',
      method: 'PUT',
      data: { nickname }
    }).then(() => {
      const info = this.data.userInfo || {};
      info.nickname = nickname;
      this.setData({ userInfo: info });
      wx.setStorageSync('user_info', info);
      authService.setHasProfile(true);
      wx.showToast({ title: '昵称更新成功', icon: 'success' });
    }).catch(err => {
      console.error('[onNicknameInput] 更新失败', err);
      wx.showToast({ title: '昵称更新失败', icon: 'none' });
    });
  },

  // 处理设置
  handleSetting: function() {
    wx.showActionSheet({
      itemList: ['清除缓存', '关于我们', '隐私政策', '平台入驻协议'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.clearCache();
            break;
          case 1:
            wx.navigateTo({ url: '/subpackages/user/pages/about/about' });
            break;
          case 2:
            wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
            break;
          case 3:
            wx.navigateTo({ url: '/pages/agreement/agreement?type=platform' });
            break;
        }
      }
    });
  },

  // 清除缓存
  clearCache: function() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({
            title: '缓存已清除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 分享页面
  onShareAppMessage: function() {
    return {
      title: '人人好媒 - 专业社交服务平台',
      path: '/pages/index/index',
      imageUrl: '/images/share.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '人人好媒 - 专业社交服务平台',
      query: '',
      imageUrl: '/images/share.jpg'
    };
  }
});
