// pages/user/orders/detail.js
const { request } = require('../../../utils/request');
const { getOrderDetail, checkPaymentStatus, createPayment, PAYMENT_TYPE_LABELS } = require('../../../utils/payment');
const API = require('../../../services/api');

const TYPE_LABELS = {
  single_registration: '会员建档费',
  partner_upgrade: '联创推荐官升级费',
  city_franchisee_join: '城市合伙人加盟费',
  professional_upgrade: '专业推荐官升级培训费',
  salon_ticket_promo: '沙龙报名费（优惠价）',
  salon_ticket_regular: '沙龙报名费',
  deposit: '押金',
  membership: '会员费',
};

const STATUS_MAP = { '0': '未支付', '1': '已支付', '2': '失败', '3': '已退款' };
const STATUS_CLASS_MAP = { '0': 'unpaid', '1': 'paid', '2': 'failed', '3': 'refunded' };
const STATUS_ICON_MAP = { '0': '⏳', '1': '✅', '2': '❌', '3': '↩️' };

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
    // 格式化后的字段（避免 WXS）
    statusText: '',
    statusClass: '',
    statusIcon: '',
    typeLabel: '',
    amountDisplay: '',
    dateText: '',
    payTimeText: '',
    payTypeText: '',
    transactionId: '',
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadOrderDetail();
    }
  },

  onShow() {
    if (this.data.orderId) {
      this.loadOrderDetail();
    }
  },

  // 格式化订单数据
  _formatOrder(order) {
    if (!order) return null;
    const status = String(order.status);

    // amount 是字符串（Prisma Decimal），需要转数字
    const amountNum = parseFloat(order.amount) || 0;
    const totalFeeNum = parseFloat(order.totalFee) || 0;
    const amountYuan = amountNum > 0 ? amountNum : totalFeeNum / 100;

    // 日期格式化
    const formatDate = (d) => {
      if (!d) return '';
      return String(d).substring(0, 16).replace('T', ' ');
    };

    // 支付方式
    const payTypeMap = { wechat: '微信支付', alipay: '支付宝', bank: '银行卡' };
    const payTypeKey = order.payType || order.pay_type || '';
    const payTypeText = payTypeMap[payTypeKey] || payTypeKey || '';

    return Object.assign({}, order, {
      statusText: STATUS_MAP[status] || '未知',
      statusClass: STATUS_CLASS_MAP[status] || '',
      statusIcon: STATUS_ICON_MAP[status] || '',
      typeLabel: TYPE_LABELS[order.type] || order.type || '未知类型',
      amountYuan: amountYuan,
      amountDisplay: '¥' + amountYuan.toFixed(2),
      dateText: formatDate(order.createdAt || order.created_at),
      payTimeText: formatDate(order.payTime || order.pay_time),
      payTypeText: payTypeText,
      transactionId: order.transactionId || order.transaction_id || '',
    });
  },

  // 加载订单详情
  async loadOrderDetail() {
    this.setData({ loading: true });

    try {
      const order = await getOrderDetail(this.data.orderId);
      const formatted = this._formatOrder(order);
      this.setData({ order: formatted, loading: false });
    } catch (err) {
      console.error('[order-detail] 加载失败:', err);
      // 尝试直接请求
      try {
        const res = await request({
          url: API.PAYMENT.ORDER.replace(':id', this.data.orderId),
          method: 'GET',
        });
        const order = res.data || res;
        const formatted = this._formatOrder(order);
        this.setData({ order: formatted, loading: false });
      } catch (err2) {
        wx.showToast({ title: '加载订单失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }
  },

  // 重试支付
  async onRetryPay() {
    const { order } = this.data;
    if (!order) return;

    const paymentType = order.type || 'partner_upgrade';
    const amount = order.amountYuan || 399;

    wx.showModal({
      title: '重新支付',
      content: `确认支付 ${order.amountDisplay || '¥' + amount.toFixed(2)} 吗？`,
      confirmText: '确认支付',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await createPayment({
            type: paymentType,
            amount: amount,
            extra: { order_id: order.id || order.orderNo },
          });

          if (result.success) {
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => {
              this.loadOrderDetail();
            }, 2000);
          }
        } catch (err) {
          console.error('[order-detail] 重试支付失败:', err);
          wx.showToast({ title: err.message || '支付失败', icon: 'none' });
        }
      }
    });
  },

  // 申请退款
  onRefund() {
    const { order } = this.data;
    if (!order) return;

    wx.showModal({
      title: '申请退款',
      content: '确认申请退款吗？退款将在1-3个工作日内到账。',
      confirmText: '确认退款',
      confirmColor: '#C8102E',
      success: (res) => {
        if (!res.confirm) return;

        request({
          url: API.PAYMENT.REFUND.replace(':id', order.id || order.orderNo),
          method: 'POST',
          data: { reason: '用户申请退款' },
        }).then(() => {
          wx.showToast({ title: '退款申请已提交', icon: 'success' });
          setTimeout(() => {
            this.loadOrderDetail();
          }, 1500);
        }).catch((err) => {
          wx.showToast({ title: err.message || '退款失败', icon: 'none' });
        });
      }
    });
  },

  // 联系客服
  onContactService() {
    wx.navigateTo({ url: '/pages/customer-service/customer-service' });
  },

  // 返回列表
  onGoBack() {
    wx.navigateBack();
  },
});
