// utils/auth.js - 登录与权限工具

const { request } = require('./request');

// 延迟获取App实例
const _getApp = () => getApp() || {};

// ===== 导航节流：防止快速点击导致 routeDone 错误 =====
let _lastNavTime = 0;
const NAV_THROTTLE_MS = 500; // 500ms 内禁止重复导航

/**
 * 节流导航包装器
 * @param {Function} navFn - 导航函数，如 () => wx.navigateTo({ url: '...' })
 * @returns {boolean} - true=已执行导航，false=被节流
 */
const throttledNav = (navFn) => {
  const now = Date.now();
  if (now - _lastNavTime < NAV_THROTTLE_MS) {
    console.log('[导航节流] 忽略重复导航请求');
    return false;
  }
  _lastNavTime = now;
  navFn();
  return true;
};

/**
 * TabBar 页面导航（自动选择正确方法）
 * @param {string} url - tabBar 页面路径
 * @returns {boolean}
 */
const switchTab = (url) => {
  return throttledNav(() => wx.switchTab({ url }));
};

/**
 * 普通页面导航（navigateTo）
 * @param {string} url - 页面路径
 * @returns {boolean}
 */
const navigateTo = (url) => {
  return throttledNav(() => wx.navigateTo({ url }));
};

/**
 * 关闭当前页面导航（redirectTo）
 * @param {string} url - 页面路径
 * @returns {boolean}
 */
const redirectTo = (url) => {
  return throttledNav(() => wx.redirectTo({ url }));
};

/**
 * 重新加载页面（reLaunch）
 * @param {string} url - 页面路径
 * @returns {boolean}
 */
const reLaunch = (url) => {
  return throttledNav(() => wx.reLaunch({ url }));
};

// ===== 登录锁：防止并发多次 wx.login =====
let _loginInProgress = false;
let _loginPromise = null;

/**
 * 确保已登录（游客静默登录）
 * 注意：如果已经是访客状态，不触发微信登录，直接放行
 */
const ensureLogin = () => {
  const app = _getApp();
  if (app.globalData?.token) return Promise.resolve(app.globalData);
  // 如果已经是访客状态（退出后），不触发登录，保持访客模式
  if (app.globalData?.isGuest) return Promise.resolve(app.globalData);
  // 如果登录正在进行中，返回同一个 Promise（防重）
  if (_loginInProgress) return _loginPromise;
  _loginInProgress = true;
  _loginPromise = (app.login?.() || Promise.reject(new Error('app.login not found')))
    .then((data) => {
      _loginInProgress = false;
      return data;
    })
    .catch((err) => {
      _loginInProgress = false;
      _loginPromise = null;  // 失败后允许重试
      throw err;
    });
  return _loginPromise;
};

/**
 * 提示登录（替代旧 login 页面跳转）
 * 弹窗提醒用户后调用微信静默登录
 * @param {string} [tip='请先登录'] - 提示文案
 * @param {boolean} [showCancel=true] - 是否显示取消按钮
 * @returns {Promise<boolean>} 是否登录成功
 */
const requireLogin = (tip, showCancel) => {
  const msg = tip || '请先登录后再操作';
  const cancelable = showCancel !== false;

  return new Promise((resolve) => {
    wx.showModal({
      title: '提示',
      content: msg,
      showCancel: cancelable,
      confirmText: '微信登录',
      success: (res) => {
        if (res.confirm) {
          const app = _getApp();
          if (app.login) {
            app.login()
              .then(() => resolve(true))
              .catch(() => {
                wx.showToast({ title: '登录失败', icon: 'none' });
                resolve(false);
              });
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      },
    });
  });
};

/**
 * 检查是否已建档，未建档则跳转
 */
const checkProfile = (options = {}) => {
  if (!_getApp().globalData?.hasProfile) {
    const ageGroup = options.ageGroup || '';
    wx.navigateTo({
      url: `/pages/register/register?age_group=${ageGroup}`,
    });
    return false;
  }
  return true;
};

/**
 * 检查是否已生成AI画像
 */
const checkAvatar = () => {
  if (!_getApp().globalData?.hasAvatar) {
    wx.navigateTo({ url: '/pages/avatar/avatar' });
    return false;
  }
  return true;
};

/**
 * 检查是否已实名认证
 */
const checkVerification = () => {
  if (!_getApp().globalData?.isVerified) {
    wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' });
    return false;
  }
  return true;
};

/**
 * 检查是否通过推荐人进入（有推荐关系）
 */
const checkReferrer = () => {
  const referrerId = _getApp().globalData?.referrerId || wx.getStorageSync('referrer_id');
  if (!referrerId) {
    return false;
  }
  return true;
};

/**
 * 请求录音权限
 */
const requestRecordPermission = () => {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope: 'scope.record',
      success: resolve,
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: 'AI画像需要采集您的声音，请在设置中开启录音权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({
                success: (setting) => {
                  if (setting.authSetting['scope.record']) {
                    resolve();
                  } else {
                    reject(new Error('用户拒绝录音权限'));
                  }
                },
              });
            } else {
              reject(new Error('用户取消'));
            }
          },
        });
      },
    });
  });
};

/**
 * 微信支付（统一入口，委托给 payment.js）
 * 保留此方法以兼容现有调用
 */
const wxPay = (orderData) => {
  const { createPayment } = require('./payment');
  return createPayment(orderData);
};

/**
 * 订阅消息授权
 */
const requestSubscribe = (tmplIds) => {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const accepted = tmplIds.filter((id) => res[id] === 'accept');
        resolve({ accepted });
      },
      fail: () => resolve({ accepted: [] }),
    });
  });
};

/**
 * 格式化价格（分 -> 元）
 */
const formatPrice = (fen) => (fen / 100).toFixed(2);

/**
 * 格式化日期
 */
const formatDate = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

/**
 * 年龄段配置
 */
const AGE_GROUPS = [
  { id: 'young',    label: '20–35岁 青年会员', icon: '💑', minAge: 20, maxAge: 35,  color: '#C8102E' },
  { id: 'middle',   label: '35–50岁 中年会员', icon: '💍', minAge: 35, maxAge: 50,  color: '#7649A4' },
  { id: 'senior',   label: '50岁以上 银发会员', icon: '🌸', minAge: 50, maxAge: 100, color: '#D4A017' },
  { id: 'divorced', label: '再出发社群',         icon: '🌿', minAge: 20, maxAge: 100, color: '#27AE60' },
  { id: 'reunion',  label: '情感再出发人群',   icon: '🕊️', minAge: 20, maxAge: 100, color: '#3498DB' },
];

/**
 * 收费标准（第一阶段）
 * 注意：统一由 payment.js 管理，此处保留供兼容引用
 */
const PRICING = {
  SINGLE_REGISTRATION: 199,   // 建档激活费（元）
  GROUP_MONTHLY: 99,         // 画像进群月费（元）
  ONE_ON_ONE: 199,           // 画像一对一聊天（元/次）
  REUNION: 399,              // AI陪伴服务（元/人）
  PARTNER_UPGRADE: 399,      // 联创推荐官升级（元）
};

module.exports = {
  ensureLogin,
  requireLogin,
  checkProfile,
  checkAvatar,
  checkVerification,
  checkReferrer,
  requestRecordPermission,
  wxPay,
  requestSubscribe,
  formatPrice,
  formatDate,
  AGE_GROUPS,
  PRICING,
  // 导航节流工具
  switchTab,
  navigateTo,
  redirectTo,
  reLaunch,
};
