// pages/recommender/open/open.js - 专业推荐官升级页面
const authService = require('../../../services/auth.service');
const commissionRules = require('../../../utils/commissionRules');

Page({
  data: {
    // 当前用户信息
    currentRoleName: '',
    currentRole: '',
    
    // 支付方式
    paymentMethods: [
      { id: 'wechat', name: '在线支付', icon: '/images/icon/pay.png' },
      { id: 'alipay', name: '支付宝', icon: '/images/icon/alipay.png' },
      { id: 'balance', name: '余额支付', icon: '/images/icon/balance.png' }
    ],
    selectedPaymentId: 'wechat',
    
    // 常见问题
    faqs: [
      {
        id: 1,
        question: '升级推荐官后，我现有的身份会变化吗？',
        answer: '不会。专业推荐官是在您现有身份基础上升级的附加身份，不会影响您原有的身份和权益，只会增加全业务推广权限和专属的城市合伙人推荐权。',
        expanded: false
      },
      {
        id: 2,
        question: '3999元是每年都要交吗？',
        answer: '不是。3999元是终身升级培训费，一次性缴纳后终身享受专业推荐官所有权益，无需每年续费。',
        expanded: false
      },
      {
        id: 3,
        question: '哪些身份可以升级为专业推荐官？',
        answer: '公益推荐官、联创推荐官、社区服务站、城市合伙人均可升级。普通用户需先成为这些身份之一才能升级。',
        expanded: false
      },
      {
        id: 4,
        question: '推荐城市合伙人有什么特殊权益？',
        answer: '专业推荐官独享城市合伙人推荐权。推荐成功后，第1个无收益（沉淀平台），第2个起全额10000元/人，并且永久享受该城市合伙人区域沉淀资金的3%分红。',
        expanded: false
      },
      {
        id: 5,
        question: '首推无收益规则具体是什么？',
        answer: '付费业务（联创推荐官399元、城市合伙人10000元）第1个推荐均不拿提成，第2个起全额拿对应费用。会员建档199元无此限制，推荐任意数量均享受99元/人。',
        expanded: false
      }
    ],
    
    // 页面状态
    loading: false,
    paying: false
  },

  onLoad: function(options) {
    this.loadUserInfo();
    
    // 检查用户是否已经是专业推荐官
    const userInfo = authService.getUserInfo();
    if (userInfo && userInfo.role === commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER) {
      wx.showModal({
        title: '温馨提示',
        content: '您已经是专业推荐官了，无需重复升级。',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    
    // 检查当前身份是否可以升级
    const currentRole = userInfo ? userInfo.role : 'user';
    const canUpgrade = commissionRules.canUpgradeToProfessionalRecommender(currentRole);
    
    if (!canUpgrade) {
      wx.showModal({
        title: '无法升级',
        content: '当前身份无法升级为专业推荐官。需要是公益推荐官、联创推荐官、社区服务站、线上合伙人或城市合伙人才能升级。',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 加载用户信息
  loadUserInfo: function() {
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      const currentRole = userInfo.role || 'user';
      const currentRoleName = userInfo.role ? (userInfo.role === 'public_matchmaker' ? '公益推荐官' : 
                         userInfo.role === 'partner_matchmaker' ? '联创推荐官' :
                         userInfo.role === 'community_station' ? '社区服务站' :
                         userInfo.role === 'city_franchisee' ? '城市合伙人' : '普通用户') : '普通用户';
      
      this.setData({
        currentRole,
        currentRoleName
      });
    }
  },

  // 选择支付方式
  selectPaymentMethod: function(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      selectedPaymentId: id
    });
  },

  // 切换常见问题展开状态
  toggleFaq: function(e) {
    const index = e.currentTarget.dataset.index;
    const faqs = this.data.faqs;
    faqs[index].expanded = !faqs[index].expanded;
    this.setData({ faqs });
  },

  // 支付开通
  onPayment: function() {
    const that = this;
    
    // 检查登录状态
    if (!authService.isLogin()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再开通推荐官',
        success: (res) => {
          if (res.confirm) {
            const { requireLogin } = require('../../../utils/auth');
            requireLogin('请先登录', false);
          }
        }
      });
      return;
    }
    
    // 确认支付
    wx.showModal({
      title: '确认升级',
      content: `确定支付3999元从【${this.data.currentRoleName}】升级为【专业推荐官】吗？升级后终身享受全业务收益权限和城市合伙人专属推荐权。`,
      success: (res) => {
        if (res.confirm) {
          that.startPayment();
        }
      }
    });
  },

  // 开始支付流程
  startPayment: function() {
    const that = this;
    const paymentMethod = this.data.selectedPaymentId;
    
    that.setData({ paying: true });
    
    // 模拟支付流程
    wx.showLoading({
      title: '支付处理中...',
      mask: true
    });
    
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟支付成功
      that.handlePaymentSuccess();
    }, 2000);
  },

  // 支付成功处理
  handlePaymentSuccess: function() {
    const that = this;
    
    // 更新用户角色为专业推荐官
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      userInfo.role = commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER;
      userInfo.isProfessionalRecommender = true;
      userInfo.upgradedToRecommenderAt = new Date().toISOString();
      
      // 使用 authService 统一更新状态
      authService.setUserInfo(userInfo);
      authService.setUserRole(commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER);
    }
    
    // 显示成功提示
    wx.showModal({
      title: '升级成功',
      content: '恭喜您已成功升级为专业推荐官！已为您生成专属推广物料，立即享受全业务收益权限。',
      showCancel: false,
      success: () => {
        // 跳转到推荐官中心
        wx.redirectTo({
          url: '/subpackages/matchmaker/pages/recommender/recommender'
        });
      }
    });
  },

  // 返回上一页
  onBack: function() {
    wx.navigateBack();
  },

  // 分享页面
  onShareAppMessage: function() {
    return {
      title: '专业推荐官升级 - 全业务收益权限',
      path: '/subpackages/matchmaker/pages/recommender/open/open',
      imageUrl: '/images/share.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '升级专业推荐官，享终身全业务收益',
      query: '',
      imageUrl: '/images/share.jpg'
    };
  }
});