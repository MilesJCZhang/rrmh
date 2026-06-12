// utils/referral.js - 推荐关系绑定系统
// 核心规则：扫码必绑定、永久锁定、不可更换

const { request } = require('./request');
const { DEV_MODE } = require('../utils/config');   // ← 新增
const API = require('../services/api');

/**
 * 延迟获取App实例（避免模块加载时getApp()返回undefined）
 */
const _getApp = () => getApp() || {};

/**
 * 安全设置 globalData（避免 getApp() 返回 undefined 时报错）
 * @param {Object} data - 要设置到 globalData 的数据
 */
const _safeSetGlobalData = (data) => {
  const app = getApp();
  if (app && app.globalData) {
    Object.assign(app.globalData, data);
  }
};

// Storage keys
const KEYS = {
  REFERRER_ID: 'referrer_id',
  REFERRER_INFO: 'referrer_info',
  REFERRER_LOCKED: 'referrer_locked',
  REFERRER_BIND_TIME: 'referrer_bind_time',
};

// 静默绑定失败缓存：持久化到 Storage，避免重新编译后重复发请求
const _getSilentFailedIds = () => {
  try {
    return JSON.parse(wx.getStorageSync('__silent_failed_referrers') || '{}');
  } catch (e) {
    return {};
  }
};

const _addSilentFailedId = (referrerId) => {
  const ids = _getSilentFailedIds();
  ids[String(referrerId)] = Date.now();
  try { wx.setStorageSync('__silent_failed_referrers', JSON.stringify(ids)); } catch (e) {}
};

/**
 * 从扫码/scene 参数中解析推荐码和推荐人ID
 * 统一解析逻辑，供 app.js、index.js、mine.js 共用
 *
 * @param {Object} options - 页面 onLoad 的 options，可能包含 scene、referrer_id、invitationCode、code 等
 * @returns {{ referrerId: string, invitationCode: string }}
 */
function parseReferralScene(options) {
  if (!options) return { referrerId: '', invitationCode: '' };

  let referrerId = '';
  let invitationCode = '';

  // 1. 普通二维码参数：直接从 query 取
  if (options.referrer_id) {
    referrerId = String(options.referrer_id);
  }
  if (options.invitationCode || options.code) {
    invitationCode = String(options.invitationCode || options.code).toUpperCase();
  }

  // 2. 小程序码：query.scene 是编码后的字符串
  if (options.scene) {
    const sceneStr = decodeURIComponent(options.scene);

    // URL 参数格式：referrer_id=30&invitationCode=LCRG001
    if (sceneStr.includes('=')) {
      const params = new URLSearchParams(sceneStr);
      if (params.has('referrer_id') && !referrerId) {
        referrerId = params.get('referrer_id');
      }
      if (params.has('invitationCode') && !invitationCode) {
        invitationCode = params.get('invitationCode').toUpperCase();
      }
    }
    // 下划线/等号分隔格式：referrer_id_30 或 invitationCode_LCRG001
    else if (sceneStr.match(/referrer_id[=_](\d+)/)) {
      if (!referrerId) referrerId = sceneStr.match(/referrer_id[=_](\d+)/)[1];
    } else if (sceneStr.match(/^invitationCode[=_]/)) {
      if (!invitationCode) invitationCode = sceneStr.replace(/^invitationCode[=_]/, '').toUpperCase();
    }
    // 纯推荐码格式：LCRG001、GYRG001
    else if (sceneStr.match(/^[A-Z]{2,5}\d+/i)) {
      if (!invitationCode) invitationCode = sceneStr.toUpperCase();
    }
    // 纯数字格式（referrer_id）
    else if (sceneStr.match(/^\d+$/)) {
      if (!referrerId) referrerId = sceneStr;
    }
  }

  return { referrerId, invitationCode };
}

/**
 * 从扫码原始字符串中提取推荐码（供 mine.js 等只需要 code 的场景）
 * @param {string} raw - 扫码结果字符串
 * @returns {string} 推荐码（大写），无匹配返回空串
 */
function extractCodeFromScanResult(raw) {
  if (!raw) return '';
  // 1. URL/路径格式：?invitationCode=XXX 或 ?code=XXX
  let match = raw.match(/(?:invitationCode|code)=([A-Z0-9]+)/i);
  if (match) return match[1].toUpperCase();
  // 2. 纯推荐码格式：如 LCRG001、GYRG001
  if (raw.match(/^[A-Z]{2,5}\d+$/i)) return raw.toUpperCase();
  // 3. scene 格式：invitationCode_XXX 或 referral_XXX
  match = raw.match(/invitationCode[_=]([A-Z0-9]+)/i);
  if (match) return match[1].toUpperCase();
  match = raw.match(/referral[_=](\d+)/i);
  if (match) return match[1];
  return '';
}

// ─── 开发调试：默认测试推荐官 ───────────────────────────
// DEV_MODE 已设为 false，以下代码上线前已确认不会执行，但仍保留注释供后续调试参考
// const DEV_MODE = false;   // 开发调试开关
// const DEV_REFERRER = { id: 'test_matchmaker_001', name: '李姐推荐官', ... };

/**
 * 检查开发模式下身份切换器是否选择了"访客"（无推荐人状态）
 * @deprecated DEV_MODE = false，此函数永不触发，保留仅供扩展参考
 */
const _isDevGuest = () => {
  if (typeof DEV_MODE !== 'undefined' && !DEV_MODE) return false;
  const roleIndex = wx.getStorageSync('dev_role_index');
  return roleIndex === 1; // index=1 是"访客"
};

/**
 * 检查推荐关系是否已永久锁定
 * @returns {boolean}
 */
const isReferralLocked = () => {
  return wx.getStorageSync(KEYS.REFERRER_LOCKED) === true;
};

/**
 * 获取当前推荐人ID
 * @returns {string|null}
 */
const getReferrerId = () => {
  // 开发模式 + 访客身份 → 返回无推荐人
  if (_isDevGuest()) return null;
  const stored = wx.getStorageSync(KEYS.REFERRER_ID) || _getApp().globalData?.referrerId || null;
  return stored;
};

/**
 * 获取推荐人信息
 * @returns {Object|null}
 */
const getReferrerInfo = () => {
  // 开发模式 + 访客身份 → 返回无推荐人
  if (_isDevGuest()) return null;
  const stored = wx.getStorageSync(KEYS.REFERRER_INFO) || null;
  return stored;
};

/**
 * 绑定推荐关系（核心方法）
 * 规则：
 * 1. 已锁定 → 直接返回，不做任何处理
 * 2. 未锁定但有推荐人 → 锁定现有关系
 * 3. 全新绑定 → 调用后端API，成功后才写本地状态
 *
 * @param {string} referrerId - 推荐人（推荐官）ID
 * @param {string} [code] - 推荐码（ReferralCode.code），用于后端递增 useCount
 * @param {Object} [options] - 可选参数
 * @param {boolean} [options.silent=false] - 静默模式，不弹窗提示
 * @returns {Promise<{bound: boolean, locked: boolean, isNew: boolean}>}
 */
const bindReferrer = (referrerId, code, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!referrerId) {
      resolve({ bound: false, locked: false, isNew: false });
      return;
    }

    // 静默模式下，如果该 ID 曾绑定失败，直接跳过，不再发请求
    if (options.silent && _getSilentFailedIds()[String(referrerId)]) {
      resolve({ bound: false, locked: false, isNew: false });
      return;
    }

    // 1. 已锁定 → 直接返回
    if (isReferralLocked()) {
      const existingId = getReferrerId();
      if (existingId === referrerId) {
        resolve({ bound: true, locked: true, isNew: false });
      } else {
        resolve({ bound: true, locked: true, isNew: false, ignored: true });
      }
      return;
    }

    // 2. 已有推荐人但未锁定 → 锁定并确认
    const existingId = wx.getStorageSync(KEYS.REFERRER_ID);
    if (existingId && existingId !== referrerId) {
      _lockReferral(existingId);
      resolve({ bound: true, locked: true, isNew: false, ignored: true });
      return;
    }

    // 3. 调用后端绑定API，成功后才写本地状态
    const bindTime = new Date().toISOString();
    // 后端 /v1/referral/bind 期望的字段名是 recommendCode 和 code（camelCase）
    const requestData = {
      recommendCode: referrerId || undefined,
      code: code || undefined,
    };
    // 清除 undefined 值
    Object.keys(requestData).forEach(k => requestData[k] === undefined && delete requestData[k]);
    request({
      url: API.REFERRAL.BIND,
      method: 'POST',
      data: requestData,
      withToken: true,
    }).then((resp) => {
      // request.js 在 success 时已 resolve(body.data)，走到这里说明业务成功
      // resp 即为后端返回的业务数据（无需再判断 code/success）
      const result = resp || {};

      // 后端返回成功，才写本地状态
      wx.setStorageSync(KEYS.REFERRER_ID, referrerId);
      wx.setStorageSync(KEYS.REFERRER_BIND_TIME, bindTime);
      wx.setStorageSync(KEYS.REFERRER_LOCKED, true);
      _safeSetGlobalData({ referrerId });

      if (result && result.referrer_info) {
        wx.setStorageSync(KEYS.REFERRER_INFO, result.referrer_info);
        _safeSetGlobalData({ referrerInfo: result.referrer_info });
      }

      // 加载推荐人信息
      _loadReferrerInfo(referrerId);

      // 同步到 userInfo（供 mine 页面展示）
      const authService = require('../services/auth.service');
      const info = authService.getUserInfo() || {};
      info.referrerId = referrerId;
      authService.setUserInfo(info);

      if (!options.silent) {
        wx.showToast({ title: '已绑定推荐官', icon: 'success', duration: 1500 });
      }

      resolve({ bound: true, locked: true, isNew: true });
    }).catch((err) => {
      // 后端返回失败，不写本地状态
      if (options.silent) {
        // 静默模式：记录失败 ID 到 Storage，避免重复发请求
        _addSilentFailedId(referrerId);
      } else {
        console.error('[bindReferrer] 绑定失败:', err);
        wx.showToast({ title: '绑定失败，请重试', icon: 'none', duration: 2000 });
      }
      resolve({ bound: false, locked: false, isNew: false });
    });
  });
};

/**
 * 锁定现有推荐关系
 * @private
 */
const _lockReferral = (referrerId) => {
  wx.setStorageSync(KEYS.REFERRER_LOCKED, true);
  if (!wx.getStorageSync(KEYS.REFERRER_BIND_TIME)) {
    wx.setStorageSync(KEYS.REFERRER_BIND_TIME, new Date().toISOString());
  }
  _safeSetGlobalData({ referrerId });
};

/**
 * 加载推荐人详细信息
 * @private
 */
const _loadReferrerInfo = (referrerId) => {
  request({
    url: API.MATCHMAKER.DETAIL.replace(':id', referrerId),
    withToken: false,
  }).then((resp) => {
    const data = (resp.data !== undefined ? resp.data : resp) || {};
    const info = {
      id: referrerId,
      name: data.name || data.nickname || '',
      avatar: data.avatar || '',
      role: data.role || 'public_matchmaker',
    };
    wx.setStorageSync(KEYS.REFERRER_INFO, info);
    _safeSetGlobalData({ referrerInfo: info });
  }).catch(() => {});
};

/**
 * 检查用户是否通过扫码进入（是否有推荐人）
 * @returns {boolean}
 */
const hasReferrer = () => {
  return !!getReferrerId();
};

/**
 * 获取推荐人名称（用于UI展示）
 * @returns {string}
 */
const getReferrerName = () => {
  const info = getReferrerInfo();
  if (info && info.name) return info.name;
  const id = getReferrerId();
  return id ? `推荐官${id.slice(-4)}` : '';
};

/**
 * 初始化推荐关系（应用启动时调用）
 * 从Storage恢复到globalData
 */
const initReferral = () => {
  const referrerId = wx.getStorageSync(KEYS.REFERRER_ID);
  if (referrerId) {
    _safeSetGlobalData({
      referrerId,
      referrerInfo: wx.getStorageSync(KEYS.REFERRER_INFO) || null
    });
  }
};

/**
 * 验证推荐码是否有效
 * @param {string} code - 推荐码（如 LCRG001, GYRG001）
 * @returns {Promise<{valid: boolean, code_type: string, referrer_id: number, referrer_name: string}>}
 */
const verifyCode = (code) => {
  return new Promise((resolve, reject) => {
    if (!code) {
      resolve({ valid: false, message: '推荐码不能为空' });
      return;
    }

    request({
      url: API.REFERRAL.VERIFY_CODE,
      method: 'POST',
      data: { code: code.toUpperCase() },
      withToken: false,
    }).then((resp) => {
      // request.js 返回完整响应体 {code, message, data}
      // 实际数据在 resp.data 中
      const data = resp.data || resp;
      if (data && data.valid) {
        resolve({
          valid: true,
          code: data.code,
          code_type: data.code_type,
          referrer_id: data.referrer_id,
          referrer_name: data.referrer_name,
          message: data.message || '推荐码有效'
        });
      } else {
        resolve({
          valid: false,
          message: data?.message || '推荐码无效'
        });
      }
    }).catch((err) => {
      console.error('[verifyCode] 验证失败:', err);
      reject(new Error('推荐码验证失败，请稍后重试'));
    });
  });
};

/**
 * 通过推荐码绑定推荐关系
 * 流程：验证推荐码 → 获取referrer_id → 调用bindReferrer()
 *
 * @param {string} code - 推荐码（如 LCRG001, GYRG001）
 * @param {Object} [options] - 可选参数
 * @param {boolean} [options.silent=false] - 静默模式，不弹窗提示
 * @returns {Promise<{bound: boolean, locked: boolean, isNew: boolean}>}
 */
const bindByCode = (code, options = {}) => {
  // ── DEV_MODE 模拟绑定成功，不发真实请求 ──
  if (DEV_MODE) {
    wx.showToast({ title: '[DEV] 模拟绑定成功', icon: 'none', duration: 1500 });
    return Promise.resolve({
      bound: true,
      locked: true,
      isNew: true,
      code: (code || 'DEV_CODE').toUpperCase(),
      code_type: 'partner_matchmaker',
      referrer_name: '测试推荐官',
    });
  }
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────

  // 改用 async 函数，支持 await
  const doBind = async (code, options) => {
    if (!code) return { bound: false, locked: false, isNew: false };

    // 1. 先验证推荐码
    const verifyResult = await verifyCode(code);
    if (!verifyResult.valid) {
      if (!options.silent) {
        wx.showToast({ title: verifyResult.message || '推荐码无效', icon: 'none', duration: 2000 });
      }
      return { bound: false, locked: false, isNew: false, reason: verifyResult.message };
    }

    // 2. 确保用户已登录（新访客可能还没有token）
    const authService = require('../services/auth.service');
    let token = authService.getToken();

    if (!token) {
      // 未登录，先执行登录
      console.log('[bindByCode] 未登录，先执行登录');
      wx.showLoading({ title: '登录中...' });

      const loginSuccess = await new Promise((loginResolve) => {
        wx.login({
          success: (res) => {
            if (res.code) {
              request({
                url: '/v1/auth/wechat-login',
                method: 'POST',
                data: { code: res.code },
                withToken: false,
              }).then((loginResp) => {
                const loginData = loginResp.data || loginResp;
                if (loginData && loginData.token) {
                  authService.setToken(loginData.token);
                  authService.setUserInfo(loginData.user || {});
                  loginResolve(true);
                } else {
                  loginResolve(false);
                }
              }).catch(() => loginResolve(false));
            } else {
              loginResolve(false);
            }
          },
          fail: () => loginResolve(false)
        });
      });

      wx.hideLoading();

      if (!loginSuccess) {
        if (!options.silent) {
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        }
        return { bound: false, locked: false, isNew: false };
      }
    }

    // 3. 验证通过，获取referrer_id
    const referrerId = verifyResult.referrer_id;

    // 4. 调用 bindReferrer 完成绑定，传入 code 让后端递增 useCount
    const bindResult = await new Promise((resolve, reject) => {
      bindReferrer(referrerId, code, options).then((result) => {
        resolve(result);
      }).catch((err) => {
        reject(err);
      });
    });

    // 绑定成功，显示推荐官信息
    if (bindResult.bound && !options.silent) {
      const name = verifyResult.referrer_name || '推荐官';
      wx.showToast({ title: `已绑定${name}`, icon: 'success', duration: 2000 });
    }

    return {
      ...bindResult,
      code: code.toUpperCase(),
      code_type: verifyResult.code_type,
      referrer_name: verifyResult.referrer_name
    };
  };

  return new Promise((resolve, reject) => {
    doBind(code, options).then((result) => {
      resolve(result);
    }).catch((err) => {
      if (!options.silent) {
        console.error('[bindByCode] 绑定失败:', err);
        wx.showToast({ title: '绑定失败，请重试', icon: 'none', duration: 2000 });
      }
      reject(err);
    });
  });
};

module.exports = {
  KEYS,
  parseReferralScene,
  extractCodeFromScanResult,
  isReferralLocked,
  getReferrerId,
  getReferrerInfo,
  bindReferrer,
  hasReferrer,
  getReferrerName,
  initReferral,
  verifyCode,
  bindByCode,
};
