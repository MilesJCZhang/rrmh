// pages/user/orders/orders.js
const { request } = require('../../../../../utils/request');
const { getOrderList, getOrderDetail, checkPaymentStatus, createPayment, PAYMENT_TYPE_LABELS } = require('../../../../../utils/payment');
const API = require('../../../../../services/api');

// 前端展示用的类型标签（与后端 PAYMENT_TYPES 对应）
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

Page({
  data: {
    orders: [],
    loading: false,
    page: 1,
    limit: 20,
    hasMore: true,
    statusFilter: '',   // 空=全部，0=未支付，1=已支付，2=失败，3=已退款
    statusOptions: [
      { label: '全部', value: '' },
      { label: '未支付', value: '0' },
      { label: '已支付', value: '1' },
      { label: '失败', value: '2' },
      { label: '已退款', value: '3' },
    ],
  },

  onShow() {
    // 只有数据变化时才 setData，避免 "Expected updated data but get first rendering data"
    const needsReset = this.data.page !== 1 || this.data.orders.length > 0;
    if (needsReset) {
      this.setData({ page: 1, hasMore: true, orders: [] });
    }
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, orders: [] });
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders();
    }
  },

  // 切换状态筛选
  onStatusFilter(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ statusFilter: value, page: 1, hasMore: true, orders: [] });
    this.loadOrders();
  },

  // 预格式化订单数据（避免 WXS 兼容性问题）
  _formatOrder(order) {
    const status = String(order.status);
    const statusMap = { '0': '未支付', '1': '已支付', '2': '失败', '3': '已退款' };
    const statusClassMap = { '0': 'status-unpaid', '1': 'status-paid', '2': 'status-failed', '3': 'status-refunded' };

    // amount 是字符串（Prisma Decimal），需要转数字
    const amountNum = parseFloat(order.amount) || 0;
    // totalFee 是分（整数），转元
    const totalFeeNum = parseFloat(order.totalFee) || 0;
    // 优先用 amount，其次 totalFee/100
    const amountYuan = amountNum > 0 ? amountNum : totalFeeNum / 100;

    // 格式化日期
    let dateText = '';
    const rawDate = order.createdAt || order.created_at || '';
    if (rawDate) {
      dateText = String(rawDate).substring(0, 16).replace('T', ' ');
    }

    return Object.assign({}, order, {
      statusText: statusMap[status] || '未知',
      statusClass: statusClassMap[status] || '',
      amountYuan: amountYuan,
      amountDisplay: '¥' + amountYuan.toFixed(2),
      typeLabel: TYPE_LABELS[order.type] || order.type || '未知类型',
      dateText: dateText,
    });
  },

  // 加载订单列表
  async loadOrders() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const params = {
        page: this.data.page,
        limit: this.data.limit,
      };
      if (this.data.statusFilter !== '') {
        params.status = this.data.statusFilter;
      }

      const res = await getOrderList(params);
      const newOrders = (res.list || res.data || []).map(o => this._formatOrder(o));
      const orders = this.data.page === 1 ? newOrders : [...this.data.orders, ...newOrders];

      this.setData({
        orders,
        hasMore: newOrders.length >= this.data.limit,
        loading: false,
      });
    } catch (err) {
      console.error('[orders] 加载订单失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 查看订单详情
  onOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/user/orders/detail?id=${orderId}` });
  },

  // 重试支付
  async onRetryPay(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId || o.orderId === orderId || o.orderNo === orderId);
    if (!order) return;

    const paymentType = order.type || order.paymentType || 'partner_upgrade';
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
            extra: { order_id: orderId },
          });

          if (result.success) {
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => {
              this.setData({ page: 1, hasMore: true, orders: [] });
              this.loadOrders();
            }, 2000);
          }
        } catch (err) {
          console.error('[orders] 重试支付失败:', err);
          wx.showToast({ title: err.message || '支付失败', icon: 'none' });
        }
      }
    });
  },

  // 申请退款
  onRefund(e) {
    const orderNo = e.currentTarget.dataset.orderNo;
    wx.showModal({
      title: '申请退款',
      content: '确认申请退款吗？退款将在1-3个工作日内到账。',
      confirmText: '确认退款',
      confirmColor: '#C8102E',
      success: (res) => {
        if (!res.confirm) return;
        request({
          url: API.PAYMENT.REFUND.replace(':id', orderNo),
          method: 'POST',
          data: { reason: '用户申请退款' },
        }).then(() => {
          wx.showToast({ title: '退款申请已提交', icon: 'success' });
          setTimeout(() => {
            this.setData({ page: 1, hasMore: true, orders: [] });
            this.loadOrders();
          }, 1500);
        }).catch((err) => {
          wx.showToast({ title: err.message || '退款失败', icon: 'none' });
        });
      }
    });
  },
});
