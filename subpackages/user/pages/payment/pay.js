// 支付页面
const paymentUtil = require('../../../../utils/payment.js');
const authService = require('../../../../services/auth.service');

Page({
  data: {
    // 订单信息
    orderId: '',
    orderInfo: null,
    
    // 支付信息
    paymentAmount: 0, // 分
    paymentType: '',
    paymentDescription: '',
    
    // 用户信息
    userInfo: null,
    
    // 支付状态
    loading: true,
    paying: false,
    
    // 支付方式
    paymentMethods: [
      { id: 'wechat', name: '微信支付', icon: '💰', selected: true },
      { id: 'balance', name: '余额支付', icon: '💳', selected: false, disabled: true }
    ],
    
    // 优惠信息
    coupons: [],
    selectedCoupon: null,
    discountAmount: 0
  },

  onLoad(options) {
    const { orderId, type, amount, description } = options;
    
    this.setData({
      orderId: orderId || '',
      paymentAmount: parseInt(amount) || 0,
      paymentType: type || '',
      paymentDescription: description || ''
    });
    
    this.loadUserInfo();
    
    if (orderId) {
      this.loadOrderDetail(orderId);
    } else {
      this.setData({ loading: false });
    }
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = authService.getUserInfo();
    this.setData({ userInfo });
  },

  // 加载订单详情
  loadOrderDetail(orderId) {
    const orderInfo = paymentUtil.getOrderDetail(orderId);
    
    if (orderInfo) {
      this.setData({
        orderInfo,
        paymentAmount: orderInfo.amount,
        paymentType: orderInfo.paymentType,
        paymentDescription: orderInfo.description
      });
    }
    
    this.setData({ loading: false });
  },

  // 选择支付方式
  selectPaymentMethod(e) {
    const methodId = e.currentTarget.dataset.id;
    
    const paymentMethods = this.data.paymentMethods.map(method => ({
      ...method,
      selected: method.id === methodId
    }));
    
    this.setData({ paymentMethods });
  },

  // 选择优惠券
  selectCoupon(e) {
    const couponId = e.currentTarget.dataset.id;
    const selectedCoupon = this.data.coupons.find(coupon => coupon.id === couponId);
    
    if (selectedCoupon) {
      const discountAmount = this.calculateDiscount(selectedCoupon);
      
      this.setData({
        selectedCoupon,
        discountAmount
      });
    }
  },

  // 计算优惠金额
  calculateDiscount(coupon) {
    if (!coupon) return 0;
    
    let discount = 0;
    const amount = this.data.paymentAmount;
    
    if (coupon.type === 'fixed') {
      discount = coupon.value * 100; // 转换为分
    } else if (coupon.type === 'percentage') {
      discount = Math.floor(amount * coupon.value / 100);
    }
    
    // 确保折扣不超过订单金额
    return Math.min(discount, amount);
  },

  // 获取实际支付金额
  getActualAmount() {
    const amount = this.data.paymentAmount;
    const discount = this.data.discountAmount;
    
    return Math.max(amount - discount, 0);
  },

  // 发起支付
  handlePayment() {
    if (!this.data.userInfo) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能进行支付',
        success: (res) => {
          if (res.confirm) {
            const { requireLogin } = require('../../../../utils/auth');
            requireLogin('请先登录后再支付', false);
          }
        }
      });
      return;
    }
    
    const selectedMethod = this.data.paymentMethods.find(m => m.selected);
    
    if (!selectedMethod) {
      wx.showToast({
        title: '请选择支付方式',
        icon: 'none'
      });
      return;
    }
    
    const actualAmount = this.getActualAmount();
    
    if (actualAmount <= 0) {
      wx.showToast({
        title: '支付金额无效',
        icon: 'none'
      });
      return;
    }
    
    // 设置支付中状态
    this.setData({ paying: true });
    
    // 根据支付方式处理
    if (selectedMethod.id === 'wechat') {
      this.handleWechatPayment(actualAmount);
    } else if (selectedMethod.id === 'balance') {
      this.handleBalancePayment(actualAmount);
    }
  },

  // 处理微信支付
  handleWechatPayment(amount) {
    const { orderId, paymentType, paymentDescription } = this.data;
    
    // 准备支付信息
    const paymentInfo = {
      orderId: orderId || `ORDER_${Date.now()}`,
      amount: amount,
      description: paymentDescription || paymentUtil.getPaymentTypeName(paymentType),
      tradeType: 'JSAPI'
    };
    
    // 如果没有订单ID，先创建订单
    if (!orderId) {
      paymentUtil.createOrder({
        userId: this.data.userInfo.id,
        amount: amount,
        paymentType: paymentType,
        description: paymentInfo.description,
        productId: this.getProductIdFromType(paymentType)
      })
      .then(result => {
        if (result.success) {
          paymentInfo.orderId = result.orderId;
          this.setData({ orderId: result.orderId });
          this.executeWechatPayment(paymentInfo);
        }
      })
      .catch(err => {
        console.error('创建订单失败', err);
        this.setData({ paying: false });
        wx.showToast({
          title: '创建订单失败',
          icon: 'error'
        });
      });
    } else {
      this.executeWechatPayment(paymentInfo);
    }
  },

  // 执行微信支付
  executeWechatPayment(paymentInfo) {
    paymentUtil.requestWxPayment(
      paymentInfo,
      // 成功回调
      (res) => {
        this.setData({ paying: false });
      },
      // 失败回调
      (err) => {
        console.error('支付失败回调', err);
        this.setData({ paying: false });
      }
    );
  },

  // 处理余额支付
  handleBalancePayment(amount) {
    const { orderId, paymentType } = this.data;
    const userInfo = this.data.userInfo || {};
    const userBalance = userInfo.balance || 0;
    
    if (userBalance < amount) {
      this.setData({ paying: false });
      wx.showModal({
        title: '余额不足',
        content: `当前余额¥${paymentUtil.formatAmount(userBalance)}，还需¥${paymentUtil.formatAmount(amount - userBalance)}`,
        confirmText: '去充值',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/subpackages/user/pages/user/recharge/recharge'
            });
          }
        }
      });
      return;
    }
    
    // 模拟余额支付
    wx.showLoading({ title: '余额支付中...' });
    
    setTimeout(() => {
      wx.hideLoading();
      this.setData({ paying: false });
      
      // 更新订单状态
      const orders = authService.getUserInfo().orders || [];
      const orderIndex = orders.findIndex(order => order.orderId === orderId);
      
      if (orderIndex !== -1) {
        orders[orderIndex].status = 'paid';
        orders[orderIndex].paymentMethod = 'balance';
        orders[orderIndex].paymentTime = new Date().toISOString();
        // 更新用户信息
        const updatedUserInfo = authService.getUserInfo();
        updatedUserInfo.orders = orders;
        updatedUserInfo.balance = userBalance - amount;
        authService.setUserInfo(updatedUserInfo);
      }
      
      // 跳转到成功页面
      wx.navigateTo({
        url: `/subpackages/user/pages/payment/success/success?orderId=${orderId}&amount=${amount}`
      });
    }, 1500);
  },

  // 根据支付类型获取产品ID
  getProductIdFromType(type) {
    const productMap = {
      'ACTIVITY_FEE': 'activity',
      'MATCHMAKER_SERVICE': 'matchmaker_service',
      'MEMBERSHIP_FEE': 'membership',
      'COOPERATION_FEE': 'cooperation',
      'DEPOSIT': 'deposit'
    };
    
    return productMap[type] || 'other';
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 取消支付
  cancelPayment() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消支付吗？',
      success: (res) => {
        if (res.confirm) {
          if (this.data.orderId) {
            paymentUtil.cancelOrder(this.data.orderId)
              .then(() => {
                this.goBack();
              });
          } else {
            this.goBack();
          }
        }
      }
    });
  },

  // 格式化金额显示
  formatAmountForDisplay(amount) {
    return `¥${paymentUtil.formatAmount(amount)}`;
  },

  // 获取支付类型显示名称
  getPaymentTypeDisplay() {
    return paymentUtil.getPaymentTypeName(this.data.paymentType);
  },

  // 页面卸载时清理
  onUnload() {
    if (this.data.paying) {
      this.setData({ paying: false });
    }
  }
});