// pages/franchisee/online/apply.js - 线上合伙人申请页面
const authService = require('../../../../../services/auth.service');
const { USER_ROLES, getFeesSync, getPlatformFundShareSync } = require('../../../../../utils/commissionRules');

Page({
  data: {
    // 表单数据
    formData: {
      name: '',
      phone: '',
      wechat: '',
      city: '',
      reason: ''
    },
    
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
        question: '线上合伙人和城市合伙人有什么区别？',
        answer: '主要区别：线上合伙人不能开办线下沙龙，但可将会员导流到其他沙龙；城市合伙人可以自主举办线下沙龙，获得沙龙组织收益。两者费用、平台抽成和推广收益规则一致。',
        expanded: false
      },
      {
        id: 2,
        question: '平台统一抽取30%是什么意思？',
        answer: '指的是您自己推荐的所有会员产生的全部业绩，平台统一抽取30%作为技术服务和管理费，剩余70%计入您的账户。',
        expanded: false
      },
      {
        id: 3,
        question: '为什么线上合伙人只能拿99元沙龙红包？',
        answer: '因为线上合伙人不能举办线下沙龙，只能将会员导流到其他合伙人的沙龙。沙龙的组织成本、场地费用等由举办方承担，所以您只拿99元红包作为导流奖励。',
        expanded: false
      },
      {
        id: 4,
        question: '合伙周期是多久？到期后怎么办？',
        answer: '合伙周期为1年，到期前可申请续费。续费费用根据当时政策确定，续费后可继续享受合伙人权益。',
        expanded: false
      },
      {
        id: 5,
        question: '成为线上合伙人后可以升级为推荐官吗？',
        answer: '可以。线上合伙人具备升级为专业推荐官的资格，支付3990元升级费后即可享受全业务收益权限。',
        expanded: false
      }
    ],
    
    // 页面状态
    loading: false,
    paying: false
  },

  onLoad: function(options) {
    // 检查用户是否已经是合伙人
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      const isOnlineFranchisee = userInfo.role === USER_ROLES.ONLINE_FRANCHISEE;
      const isCityFranchisee = userInfo.role === USER_ROLES.CITY_FRANCHISEE;
      
      if (isOnlineFranchisee || isCityFranchisee) {
        wx.showModal({
          title: '温馨提示',
          content: '您已经是合伙人了，无需重复申请。',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    }
  },

  // 表单输入处理
  onFormInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
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

  // 表单提交
  onSubmitForm: function(e) {
    const that = this;
    const formData = e.detail.value;
    
    // 验证表单
    if (!this.validateForm(formData)) {
      return;
    }
    
    // 检查登录状态
    if (!authService.isLogin()) {
      const { requireLogin } = require('../../../../../utils/auth');
      requireLogin('请先登录后再申请加盟', false);
      return;
    }
    
    // 确认支付
    wx.showModal({
      title: '确认加盟申请',
      content: '确定支付¥10000申请成为城市合伙人吗？加盟周期1年，平台统一抽取30%。',
      success: (res) => {
        if (res.confirm) {
          that.startPayment();
        }
      }
    });
  },

  // 验证表单
  validateForm: function(formData) {
    if (!formData.name || formData.name.trim() === '') {
      wx.showToast({
        title: '请输入申请人姓名',
        icon: 'none'
      });
      return false;
    }
    
    if (!formData.phone || formData.phone.length !== 11) {
      wx.showToast({
        title: '请输入正确的手机号码',
        icon: 'none'
      });
      return false;
    }
    
    if (!formData.city || formData.city.trim() === '') {
      wx.showToast({
        title: '请输入所在城市',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 开始支付流程
  startPayment: function() {
    const that = this;
    
    that.setData({ paying: true, loading: true });
    
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
    const formData = this.data.formData;
    
    // 更新用户角色为线上合伙人
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      userInfo.role = USER_ROLES.ONLINE_FRANCHISEE;
      userInfo.isOnlineFranchisee = true;
      userInfo.joinedAt = new Date().toISOString();
      userInfo.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1年后
      
      // 保存申请信息
      // 使用动态配置
      const fees = getFeesSync();
      const platformFundShare = getPlatformFundShareSync();

      userInfo.franchiseeInfo = {
        name: formData.name,
        phone: formData.phone,
        wechat: formData.wechat,
        city: formData.city,
        reason: formData.reason,
        type: 'online',
        fee: fees.CITY_FRANCHISEE_JOIN,
        platformFeeRate: 1 - platformFundShare.CITY_FRANCHISEE_RATE, // 平台抽成 = 1 - 合伙人分成比例
      };
      
      // 使用 authService 统一更新状态
      authService.setUserInfo(userInfo);
      authService.setUserRole(USER_ROLES.ONLINE_FRANCHISEE);
    }
    
    // 显示成功提示
    wx.showModal({
      title: '加盟成功',
      content: '恭喜您已成为线上合伙人！已为您开通推广权限，享受平台70%收益分成。',
      showCancel: false,
      success: () => {
        // 跳转到个人中心
        wx.redirectTo({
          url: '/subpackages/user/pages/user/user/user'
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
    const fees = getFeesSync();
    return {
      title: `城市合伙人申请 - ¥${fees.CITY_FRANCHISEE_JOIN}加盟，享受区域沉淀资金70%权益`,
      path: '/subpackages/partner/pages/franchisee/online/apply',
      imageUrl: '/images/share.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    const fees = getFeesSync();
    const platformFundShare = getPlatformFundShareSync();
    const platformFeeRate = ((1 - platformFundShare.CITY_FRANCHISEE_RATE) * 100).toFixed(0);
    return {
      title: `城市合伙人申请，加盟费¥${fees.CITY_FRANCHISEE_JOIN}元，平台抽成${platformFeeRate}%`,
      query: '',
      imageUrl: '/images/share.jpg'
    };
  }
});