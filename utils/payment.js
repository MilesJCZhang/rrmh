// utils/payment.js - 统一支付系统
// 支持所有费用类型 + 退费功能 + 订单管理
// 按分润规则表 v3 更新（2026-04-25）

const { request } = require('./request');
const { DEV_MODE } = require('../utils/config');   // ← 新增：读取开发模式
const API = require('../services/api');

// 延迟获取App实例
const _getApp = () => getApp() || {};

// ========== 支付类型定义 ==========
const PAYMENT_TYPES = {
  SINGLE_REGISTRATION: 'single_registration',         // 会员建档费（199元/人）
  PARTNER_MATCHMAKER_UPGRADE: 'partner_matchmaker',      // 联创推荐官升级费（399元）
  CITY_FRANCHISEE_JOIN: 'city_franchisee_join',       // 城市合伙人加盟费（10000元，一次性）
  PROFESSIONAL_UPGRADE: 'professional_upgrade',       // 专业推荐官升级培训费（3999元）
  SALON_TICKET_PROMO: 'salon_ticket_promo',           // 沙龙报名费-优惠价（299元/人，上线第一年）
  SALON_TICKET_REGULAR: 'salon_ticket_regular',       // 沙龙报名费-原价（399元/人，第二年起）
};

// 支付类型中文描述
const PAYMENT_TYPE_LABELS = {
  [PAYMENT_TYPES.SINGLE_REGISTRATION]: '会员建档费',
  [PAYMENT_TYPES.PARTNER_MATCHMAKER_UPGRADE]: '联创推荐官升级费',
  [PAYMENT_TYPES.CITY_FRANCHISEE_JOIN]: '城市合伙人加盟费',
  [PAYMENT_TYPES.PROFESSIONAL_UPGRADE]: '专业推荐官升级培训费',
  [PAYMENT_TYPES.SALON_TICKET_PROMO]: '圈层主题沙龙报名费（优惠价）',
  [PAYMENT_TYPES.SALON_TICKET_REGULAR]: '圈层主题沙龙报名费',
};

// 金额配置（单位：元）
// 限时特惠：原价199元，现0.19元成为会员（限量199个名额）
const PAYMENT_AMOUNTS = {
  [PAYMENT_TYPES.SINGLE_REGISTRATION]: 0.19,  // 限量199个名额特惠价
  [PAYMENT_TYPES.PARTNER_MATCHMAKER_UPGRADE]: 399,
  [PAYMENT_TYPES.CITY_FRANCHISEE_JOIN]: 10000,
  [PAYMENT_TYPES.PROFESSIONAL_UPGRADE]: 3999,
  [PAYMENT_TYPES.SALON_TICKET_PROMO]: 299,
  [PAYMENT_TYPES.SALON_TICKET_REGULAR]: 399,
};

// ========== 统一支付方法 ==========

/**
 * 发起微信支付（统一入口）
 * @param {Object} params
 * @param {string} params.type - 支付类型（PAYMENT_TYPES中的值）
 * @param {string} [params.description] - 商品描述（默认从类型获取）
 * @param {number} [params.amount] - 支付金额（元，默认从配置获取）
 * @param {Object} [params.extra] - 额外参数（如 target_user_id 等）
 * @returns {Promise<{success: boolean, orderId: string, reason?: string}>}
 */
const createPayment = (params) => {
  const { type, description, amount, extra = {} } = params;

  // ── DEV_MODE 模拟支付（不发起真实请求）──
  if (DEV_MODE) {
    const paymentType = type || PAYMENT_TYPES.SINGLE_REGISTRATION;
    const paymentAmount = amount || PAYMENT_AMOUNTS[paymentType] || 199;
    wx.showToast({ title: '[DEV] 模拟支付成功', icon: 'none', duration: 1500 });
    return Promise.resolve({
      success: true,
      orderId: `DEV_${Date.now()}`,
      paymentType,
      amount: paymentAmount,
      paid: true,
      devMock: true,
    });
  }
  // ──────────────────────────────────────────────

  return new Promise((resolve, reject) => {
    // 参数校验：支持传入 key（大写，如 'SINGLE_REGISTRATION'）或 value（如 'single_registration'）
    const PAYMENT_VALUES = Object.values(PAYMENT_TYPES);
    const isValidKey = type && PAYMENT_TYPES[type.toUpperCase()];
    const isValidValue = type && PAYMENT_VALUES.includes(type);
    if (!type || (!isValidKey && !isValidValue)) {
      reject({ success: false, reason: 'invalid_payment_type', message: '无效的支付类型: ' + type });
      return;
    }

    // 统一转成 value（如 'single_registration'）
    const paymentType = isValidValue ? type : PAYMENT_TYPES[type.toUpperCase()];

    const paymentAmount = amount || PAYMENT_AMOUNTS[paymentType];
    const paymentDesc = description || PAYMENT_TYPE_LABELS[paymentType] || '人人媒好服务';

    wx.showLoading({ title: '准备支付...' });

    // 1. 向后端创建订单
    request({
      url: API.PAYMENT.CREATE,
      method: 'POST',
      data: {
        type: paymentType,           // 后端期望 type，不是 payment_type
        amount: paymentAmount,       // 元，后端 isFloat({ min: 0.01 }) 验证
        description: paymentDesc,
        ...extra,
      },
    }).then((orderData) => {
      wx.hideLoading();

      // 保存订单ID到Storage，用于后续轮询
      wx.setStorageSync('last_order_id', orderData.orderNo || orderData.outTradeNo);

      // 模拟支付响应：跳过 wx.requestPayment，直接确认成功
      if (orderData.mock || orderData.status === 'paid') {
        resolve({
          success: true,
          orderId: orderData.orderNo,
          paymentType: paymentType,
          amount: paymentAmount,
          paid: true,
          mock: true,
        });
        return;
      }

      // 2. 调起微信支付（signType 由服务端返回，默认 MD5）
      wx.requestPayment({
        timeStamp: orderData.timeStamp || String(Math.floor(Date.now() / 1000)),
        nonceStr: orderData.nonceStr,
        package: orderData.package,
        signType: orderData.signType || 'MD5',
        paySign: orderData.paySign,
        success: (res) => {
          // 支付成功后，轮询后台确认支付状态（最多10秒）
          pollPaymentStatus(orderData.orderNo, 5, 2000).then((finalStatus) => {
            if (finalStatus && finalStatus.paid) {
              resolve({
                success: true,
                orderId: orderData.orderNo,
                paymentType: paymentType,
                amount: paymentAmount,
                paid: true
              });
            } else {
              // 后台尚未确认，可能需要等待回调
              resolve({
                success: true,
                orderId: orderData.orderNo,
                paymentType: paymentType,
                amount: paymentAmount,
                paid: false,
                message: '支付成功，等待后台确认'
              });
            }
          }).catch(() => {
            // 轮询失败，但仍认为支付成功（微信已扣款）
            resolve({
              success: true,
              orderId: orderData.orderNo,
              paymentType: paymentType,
              amount: paymentAmount,
              paid: false,
              message: '支付成功，后台确认延迟'
            });
          });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) {
            resolve({ success: false, reason: 'cancelled', orderId: orderData.orderNo });
          } else {
            reject({ success: false, reason: 'payment_failed', detail: err, orderId: orderData.orderNo });
          }
        },
      });
    }).catch((err) => {
      wx.hideLoading();
      reject({ success: false, reason: 'create_order_failed', message: err.message || '创建订单失败' });
    });
  });
};

/**
 * 快捷支付方法（常用场景简化调用）
 */
const payment = {
  /**
   * 会员建档费（199元）
   */
  payRegistration(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.SINGLE_REGISTRATION, extra });
  },

  /**
   * 联创推荐官升级费（399元）
   */
  payPartnerUpgrade(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.PARTNER_MATCHMAKER_UPGRADE, extra });
  },

  /**
   * 城市合伙人加盟费（10000元，一次性）
   */
  payFranchiseeJoin(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.CITY_FRANCHISEE_JOIN, extra });
  },

  /**
   * 专业推荐官升级培训费（3999元）
   */
  payProfessionalUpgrade(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.PROFESSIONAL_UPGRADE, extra });
  },

  /**
   * 沙龙报名费-优惠价（299元/人，上线第一年）
   */
  paySalonTicketPromo(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.SALON_TICKET_PROMO, extra });
  },

  /**
   * 沙龙报名费-原价（399元/人，第二年起）
   */
  paySalonTicketRegular(extra = {}) {
    return createPayment({ type: PAYMENT_TYPES.SALON_TICKET_REGULAR, extra });
  },

  /**
   * 沙龙报名（自动判断优惠期/正价期）
   * @param {boolean} isPromoPhase - 是否处于上线第一年优惠期
   */
  paySalonTicket(isPromoPhase = true, extra = {}) {
    const type = isPromoPhase ? PAYMENT_TYPES.SALON_TICKET_PROMO : PAYMENT_TYPES.SALON_TICKET_REGULAR;
    return createPayment({ type, extra });
  },
};

// ========== 退费功能 ==========

/**
 * 申请退款
 * @param {Object} params
 * @param {string} params.orderId - 订单ID
 * @param {string} [params.reason] - 退款原因
 * @param {number} [params.refundAmount] - 退款金额（元），不填则全额退款
 * @returns {Promise<{success: boolean, refundId: string}>}
 */
const requestRefund = (params) => {
  const { orderId, reason = '用户申请退款', refundAmount } = params;

  return new Promise((resolve, reject) => {
    wx.showModal({
      title: '确认退款',
      content: refundAmount
        ? `确定要申请退款 ¥${refundAmount.toFixed(2)} 吗？`
        : '确定要申请全额退款吗？',
      confirmText: '确认退款',
      confirmColor: '#C8102E',
      success: (modalRes) => {
        if (!modalRes.confirm) return;

        wx.showLoading({ title: '提交退款申请...' });

        request({
          url: API.PAYMENT.REFUND.replace(':id', orderId),
          method: 'POST',
          data: {
            reason,
            refund_amount: refundAmount ? refundAmount * 100 : undefined,
          },
        }).then((data) => {
          wx.hideLoading();
          wx.showToast({ title: '退款申请已提交', icon: 'success' });
          resolve({
            success: true,
            refundId: data.refundId,
            message: '退款申请已提交，预计1-3个工作日到账',
          });
        }).catch((err) => {
          wx.hideLoading();
          wx.showToast({ title: err.message || '退款申请失败', icon: 'none' });
          reject({ success: false, message: err.message });
        });
      },
    });
  });
};

// ========== 订单查询 ==========

/**
 * 查询订单详情
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
const getOrderDetail = (orderId) => {
  return request({ url: API.PAYMENT.ORDER.replace(':id', orderId) });
};

/**
 * 查询用户订单列表
 * @param {Object} [params]
 * @param {string} [params.status] - 订单状态筛选
 * @param {string} [params.type] - 支付类型筛选
 * @param {number} [params.page] - 页码
 * @param {number} [params.limit] - 每页数量
 * @returns {Promise<{list: Array, total: number}>}
 */
const getOrderList = (params = {}) => {
  return request({
    url: API.PAYMENT.ORDER_LIST,
    data: {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { payment_type: params.type } : {}),
    },
  });
};

/**
 * 检查支付状态
 * @param {string} orderId
 * @returns {Promise<{paid: boolean, status: string}>}
 */
const checkPaymentStatus = (orderId) => {
  return request({ url: API.PAYMENT.STATUS.replace(':id', orderId) });
};

/**
 * 轮询支付状态（最多轮询N次，每次间隔delay毫秒）
 * @param {string} orderId
 * @param {number} maxAttempts - 最大尝试次数（默认5次）
 * @param {number} delay - 轮询间隔（默认2000ms）
 * @returns {Promise<{paid: boolean, status: string}>}
 */
const pollPaymentStatus = (orderId, maxAttempts = 5, delay = 2000) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const poll = () => {
      attempts++;
      checkPaymentStatus(orderId).then((statusData) => {
        if (statusData && (statusData.paid || statusData.status === 1 || statusData.paidAt)) {
          // 支付已确认
          resolve({ paid: true, status: 'paid', data: statusData });
        } else if (attempts >= maxAttempts) {
          // 达到最大尝试次数，返回当前状态
          resolve({ paid: false, status: statusData?.status || 'pending', data: statusData });
        } else {
          // 继续轮询
          setTimeout(poll, delay);
        }
      }).catch((err) => {
        if (attempts >= maxAttempts) {
          reject(err);
        } else {
          // 查询失败，继续轮询
          setTimeout(poll, delay);
        }
      });
    };
    
    poll();
  });
};

// ========== 工具方法 ==========

/**
 * 获取支付类型标签
 * @param {string} type
 * @returns {string}
 */
const getPaymentLabel = (type) => {
  return PAYMENT_TYPE_LABELS[type] || '未知支付类型';
};

/**
 * 获取支付类型金额
 * @param {string} type
 * @returns {number} 金额（元）
 */
const getPaymentAmount = (type) => {
  return PAYMENT_AMOUNTS[type] || 0;
};

/**
 * 格式化金额（分转元）
 * @param {number} fen
 * @returns {string}
 */
const formatAmount = (fen) => {
  return (fen / 100).toFixed(2);
};

module.exports = {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PAYMENT_AMOUNTS,
  createPayment,
  payment,
  requestRefund,
  getOrderDetail,
  getOrderList,
  checkPaymentStatus,
  getPaymentLabel,
  getPaymentAmount,
  formatAmount,
};
