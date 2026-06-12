// 支付成功页面
const paymentUtil = require('../../../../../utils/payment.js');

Page({
  data: {
    // 订单信息
    orderId: '',
    orderInfo: null,
    
    // 支付信息
    paymentAmount: 0,
    paymentType: '',
    paymentTime: '',
    
    // 下一步操作
    nextActions: [],
    
    // 加载状态
    loading: true
  },

  onLoad(options) {
    const { orderId, amount } = options;
    
    this.setData({
      orderId: orderId || '',
      paymentAmount: parseInt(amount) || 0
    });
    
    this.loadOrderInfo();
    this.setupNextActions();
  },

  // 加载订单信息
  loadOrderInfo() {
    if (this.data.orderId) {
      const orderInfo = paymentUtil.getOrderDetail(this.data.orderId);
      
      if (orderInfo) {
        this.setData({
          orderInfo,
          paymentAmount: orderInfo.amount,
          paymentType: orderInfo.paymentType,
          paymentTime: orderInfo.paymentTime || new Date().toLocaleString(),
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } else {
      this.setData({ loading: false });
    }
  },

  // 设置下一步操作
  setupNextActions() {
    const { paymentType } = this.data;
    
    let actions = [];
    
    switch (paymentType) {
      case 'ACTIVITY_FEE':
        actions = [
          { title: '查看活动详情', icon: '📅', action: 'viewActivity' },
          { title: '分享给朋友', icon: '📱', action: 'share' },
          { title: '返回首页', icon: '🏠', action: 'goHome' }
        ];
        break;
        
      case 'MATCHMAKER_SERVICE':
        actions = [
          { title: '联系推荐官', icon: '💬', action: 'contactMatchmaker' },
          { title: '预约咨询', icon: '📅', action: 'makeAppointment' },
          { title: '查看服务进度', icon: '📊', action: 'viewProgress' }
        ];
        break;
        
      case 'MEMBERSHIP_FEE':
        actions = [
          { title: '查看会员特权', icon: '👑', action: 'viewBenefits' },
          { title: '完善个人资料', icon: '📝', action: 'completeProfile' },
          { title: '浏览活动', icon: '🔍', action: 'browseActivities' }
        ];
        break;
        
      case 'COOPERATION_FEE':
        actions = [
          { title: '查看合作资料', icon: '📚', action: 'viewMaterials' },
          { title: '联系客服', icon: '👨‍💼', action: 'contactSupport' },
          { title: '加入合作群', icon: '👥', action: 'joinGroup' }
        ];
        break;
        
      default:
        actions = [
          { title: '返回首页', icon: '🏠', action: 'goHome' },
          { title: '查看订单', icon: '📋', action: 'viewOrders' },
          { title: '联系客服', icon: '💁', action: 'contactService' }
        ];
    }
    
    this.setData({ nextActions: actions });
  },

  // 处理下一步操作
  handleNextAction(e) {
    const action = e.currentTarget.dataset.action;
    
    switch (action) {
      case 'viewActivity':
        this.viewActivity();
        break;
      case 'share':
        this.shareOrder();
        break;
      case 'goHome':
        this.goHome();
        break;
      case 'contactMatchmaker':
        this.contactMatchmaker();
        break;
      case 'makeAppointment':
        this.makeAppointment();
        break;
      case 'viewProgress':
        this.viewProgress();
        break;
      case 'viewBenefits':
        this.viewBenefits();
        break;
      case 'completeProfile':
        this.completeProfile();
        break;
      case 'browseActivities':
        this.browseActivities();
        break;
      case 'viewMaterials':
        this.viewMaterials();
        break;
      case 'contactSupport':
        this.contactSupport();
        break;
      case 'joinGroup':
        this.joinGroup();
        break;
      case 'viewOrders':
        this.viewOrders();
        break;
      case 'contactService':
        this.contactService();
        break;
    }
  },

  // 查看活动详情
  viewActivity() {
    const { orderInfo } = this.data;
    if (orderInfo && orderInfo.productId) {
      wx.navigateTo({
        url: `/subpackages/social/pages/activity/detail/detail?id=${orderInfo.productId}`
      });
    }
  },

  // 分享订单
  shareOrder() {
    const { orderInfo } = this.data;
    
    wx.showActionSheet({
      itemList: ['分享给微信好友', '分享到朋友圈', '复制订单信息'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享给好友
          wx.shareAppMessage({
            title: '我已成功报名活动',
            path: `/subpackages/social/pages/activity/detail/detail?id=${orderInfo.productId}`
          });
        } else if (res.tapIndex === 1) {
          // 分享到朋友圈
          wx.showToast({
            title: '朋友圈分享开发中',
            icon: 'none'
          });
        } else {
          // 复制订单信息
          const orderText = `订单号：${this.data.orderId}
支付金额：${paymentUtil.formatAmount(this.data.paymentAmount)}元
支付时间：${this.data.paymentTime}
订单状态：支付成功`;
          
          wx.setClipboardData({
            data: orderText,
            success: () => {
              wx.showToast({
                title: '订单信息已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 联系推荐官
  contactMatchmaker() {
    const { orderInfo } = this.data;
    if (orderInfo && orderInfo.matchmakerId) {
      wx.navigateTo({
        url: `/subpackages/matchmaker/pages/matchmaker/detail/detail?id=${orderInfo.matchmakerId}`
      });
    }
  },

  // 预约咨询
  makeAppointment() {
    const { orderInfo } = this.data;
    if (orderInfo && orderInfo.matchmakerId) {
      wx.navigateTo({
        url: `/pages/matchmaker/appointment/appointment?id=${orderInfo.matchmakerId}`
      });
    }
  },

  // 查看服务进度
  viewProgress() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/orders/orders?type=matchmaker'
    });
  },

  // 查看会员特权
  viewBenefits() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/membership/membership'
    });
  },

  // 完善个人资料
  completeProfile() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/profile/profile'
    });
  },

  // 浏览活动
  browseActivities() {
    wx.switchTab({
      url: '/subpackages/social/pages/activity/list/list'
    });
  },

  // 查看合作资料
  viewMaterials() {
    wx.navigateTo({
      url: '/subpackages/partner/pages/cooperation/intro/intro'
    });
  },

  // 联系客服
  contactSupport() {
    wx.navigateTo({
      url: '/pages/customer-service/customer-service'
    });
  },

  // 加入合作群（由WXML侧 open-type=contact 按钮触发，此函数保留备用）
  joinGroup() {
    wx.showToast({ title: '请点击"联系客服"按钮', icon: 'none' });
  },

  // 查看订单
  viewOrders() {
    wx.navigateTo({
      url: '/subpackages/user/pages/user/orders/orders'
    });
  },

  // 联系客服
  contactService() {
    wx.navigateTo({
      url: '/pages/customer-service/customer-service'
    });
  },

  // 继续支付（如果有其他待支付订单）
  continuePayment() {
    wx.navigateBack();
  },

  // 查看发票
  viewInvoice() {
    const { orderId } = this.data;
    
    wx.showModal({
      title: '电子发票',
      content: '电子发票将在24小时内发送到您的注册邮箱，如需纸质发票请联系客服。',
      confirmText: '查看发票',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/user/invoice/invoice?orderId=${orderId}`
          });
        }
      }
    });
  },

  // 格式化金额显示
  formatAmount(amount) {
    return paymentUtil.formatAmount(amount);
  },

  // 获取支付类型名称
  getPaymentTypeName() {
    return paymentUtil.getPaymentTypeName(this.data.paymentType);
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '支付成功 - 人人好媒',
      path: '/pages/index/index'
    };
  }
});