// utils/request.js - 统一网络请求封装
// 支持两种模式：云托管 callContainer / 传统 wx.request

// 延迟获取App实例（避免模块加载时getApp()返回undefined）
const _getApp = () => getApp() || {};

// 静默处理微信内部 "An object could not be cloned" 错误
// 微信开发者工具 v2.02.2606222 的已知 bug：createRequestTask 内部
// 异步抛出此错误，不影响请求实际成功
try {
  if (typeof wx !== 'undefined' && wx.onUnhandledRejection) {
    wx.onUnhandledRejection(function(res) {
      var reason = res && (res.reason || res);
      if (reason && typeof reason === 'object' && reason.message && reason.message.indexOf('could not be cloned') !== -1) {
        console.debug('[request] 静默处理微信内部 clone 错误');
        return true;
      }
    });
  }
} catch (e) {}

// ========== 模式切换（统一从 config.js 读取）==========
const { IS_DEV, API_BASE_URL } = require('./config');
const IS_PROD = !IS_DEV;
const MODE = IS_DEV ? 'mock' : 'request';

// 云托管配置（MODE='container' 时使用）
const CLOUD_ENV = '';           // 云环境ID
const CLOUD_SERVICE = 'api-server';                       // 云托管服务名
const CLOUD_VERSION = '$LATEST';                          // 最新版本

// BASE_URL 直接使用 config.js 中的 API_BASE_URL（上面已导入）
/**
 * 统一请求方法
 * @param {Object} options
 * @param {string} options.url       - 接口路径，如 /auth/wechat-login
 * @param {string} [options.method]  - GET/POST/PUT/DELETE
 * @param {Object} [options.data]    - 请求数据
 * @param {boolean} [options.withToken] - 是否带 token，默认 true
 * @param {number} [options.timeout] - 超时时间 ms
 */
// 防止并发刷新 + 无限循环
let isRefreshing = false;
let refreshPromise = null;

const request = (options) => {
  // ── 云托管模式 (callContainer) ──
  if (MODE === 'container') {
    return new Promise((resolve, reject) => {
      const token = options.withToken !== false
        ? (_getApp().globalData?.token || wx.getStorageSync('token'))
        : undefined;

      wx.cloud.callContainer({
        config: {
          env: CLOUD_ENV,
        },
        path: options.url.startsWith('/') ? `/v1${options.url}` : `/v1/${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Custom-Token': token } : {}),
          ...options.header,
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = res.data || {};
            if (body.code === 0 || body.code === 200) {
              resolve(body.data !== undefined ? body.data : body);
            } else {
              reject({ code: body.code, message: body.message || '请求失败' });
            }
          } else {
            reject({ code: res.statusCode, message: body?.message || '服务器错误' });
          }
        },
        fail: (err) => {
          reject({ code: -1, message: '请求失败', detail: err });
        },
      });
    });
  }

  // ── 传统 wx.request 模式（备用） ──
  return new Promise((resolve, reject) => {
    let token = options.withToken !== false
      ? (_getApp().globalData?.token || wx.getStorageSync('token'))
      : null;

    // 清洗 token：去除首尾空白字符（防止存储时带入换行/空格导致 nginx 400）
    if (token && typeof token === 'string') {
      token = token.trim();
      if (!token) {
        // token 全是空白字符，清除无效 token
        console.warn('[request] token 无效（空白字符），已清除');
        wx.removeStorageSync('token');
        try { _getApp().globalData.token = null; } catch (e) {}
        token = null;
      }
    }

    // GET 请求：将 data 参数拼接到 URL 作为 query string
    // 非 GET 请求：data 放在请求体中
    let fullUrl = `${API_BASE_URL}${options.url}`;
    let requestData = options.data;

    if (options.method === 'GET' || options.method === undefined) {
      // GET 请求：将参数拼接到 URL，不传 body
      if (requestData) {
        const qs = Object.entries(requestData)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
      }
      requestData = undefined; // GET 不传 body
    } else {
      // 非 GET 请求：清洗 data 中的 undefined/null 值，避免微信 native 层 clone 失败
      requestData = {};
      if (options.data) {
        Object.entries(options.data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) requestData[k] = v;
        });
      }
    }

    // 构建 wx.request 参数：逐属性赋值，避免对象字面量/spread 导致 clone 失败
    var reqOpt = {};
    reqOpt.url = fullUrl;
    reqOpt.method = options.method || 'GET';
    reqOpt.timeout = options.timeout || 8000;
    reqOpt.header = {};
    reqOpt.header['Content-Type'] = 'application/json';
    if (token && typeof token === 'string') {
      reqOpt.header['Authorization'] = 'Bearer ' + token;
    }
    if (options.header) {
      for (var _k in options.header) {
        if (Object.prototype.hasOwnProperty.call(options.header, _k)) {
          var _v = options.header[_k];
          if (_v !== undefined && _v !== null) reqOpt.header[_k] = String(_v);
        }
      }
    }
    // ⚠️ 关键：只有非 GET 且 data 非空时才传 data 字段
    //     GET 请求或空的 data 对象不传 data，避免 data:undefined 导致 native clone 失败
    if (options.method !== 'GET' && options.method !== undefined) {
      if (requestData && Object.keys(requestData).length > 0) {
        reqOpt.data = requestData;
      }
    }
    reqOpt.success = function(res) {
        if (res.statusCode === 401) {
          console.warn('[request] 401 on', options.url, 'retry?', options._retry);
          const currentToken = _getApp().globalData?.token || wx.getStorageSync('token');
          // 无 token，或已经重试过一次，不再刷新，直接失败
          if (!currentToken || options._retry) {
            console.warn('[request] 401 skip refresh. token?', !!currentToken, 'already retried?', !!options._retry);
            reject({ code: 401, message: currentToken ? '登录已过期' : '未登录' });
            return;
          }
          // 有 token 且首次 401，尝试刷新（带全局锁防止并发）
          const doRefresh = () => {
            return refreshToken().then((refreshRes) => {
              console.log('[request] refresh success, retrying', options.url, 'new token prefix:', (refreshRes.token || '').substring(0, 20));
              return request({ ...options, _retry: true });
            }).then(resolve).catch((err) => {
              console.error('[request] refresh failed:', err);
              // refresh 失败，尝试静默重新登录
              silentLogin().then((loginRes) => {
                console.log('[request] silent login success, retrying', options.url);
                return request({ ...options, _retry: true });
              }).then(resolve).catch((loginErr) => {
                console.error('[request] silent login also failed:', loginErr);
                wx.removeStorageSync('token');
                wx.removeStorageSync('refresh_token');
                try { _getApp().globalData.token = null; } catch (e) {}
                wx.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2000 });
                reject({ code: 401, message: '登录已过期' });
              });
            });
          };
          if (isRefreshing) {
            console.log('[request] 401 but refresh already in progress, waiting...');
            refreshPromise.then(() => request({ ...options, _retry: true })).then(resolve).catch(() => {
              reject({ code: 401, message: '登录已过期' });
            });
          } else {
            isRefreshing = true;
            refreshPromise = doRefresh().finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
          }
          return;
        }
        // 400：可能是业务错误（如"已有推荐人"），也可能是 token 格式异常导致 nginx 拒收
        if (res.statusCode === 400) {
          console.error('[request] 400 on', options.url, '- 响应body:', res.data);
          // 先尝试解析响应体，判断是否是合法的业务错误
          let businessError = null;
          try {
            const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            if (body && body.code && body.message) {
              businessError = body;
            }
          } catch (e) { /* not JSON, probably nginx error */ }
          if (businessError) {
            // 合法的业务错误，直接 reject 真实消息，不清 token
            reject({ code: businessError.code, message: businessError.message });
            return;
          }
          // 非业务错误（nginx 拒收等），才清 token
          wx.removeStorageSync('token');
          wx.removeStorageSync('refresh_token');
          try { _getApp().globalData.token = null; } catch (e) {}
          wx.showToast({ title: '登录状态异常，请重新登录', icon: 'none', duration: 2000 });
          reject({ code: 400, message: '登录状态异常，请重新登录' });
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          // 业务状态码：code === 0 或 code === 200 都视为成功（兼容新旧后端）
          const isSuccess = body.code === 0 || body.code === 200;
          if (isSuccess) {
            // 统一返回 data（兼容云托管模式和传统模式）
            resolve(body.data !== undefined ? body.data : body);
          } else {
            console.error('[request] Business error:', body);
            reject({ code: body.code, message: body.message || '请求失败' });
          }
        } else {
          // 详细打印非 2xx 响应的完整信息，便于调试 500 等错误
          console.error('[request] HTTP', res.statusCode, 'on', options.url, '- 完整响应:', res.data);
          const errBody = typeof res.data === 'string' ? { message: res.data } : (res.data || {});
          reject({ code: res.statusCode, message: errBody.message || errBody.error || `服务器错误(${res.statusCode})`, detail: errBody });
        }
    };
    
    reqOpt.fail = function(err) {
      console.error('[request] Network error on', options.url, ':', err);
      reject({ code: -1, message: '网络异常', detail: err });
    };
    
    wx.request(reqOpt);
  });
};

/**
 * 静默重新登录（wx.login → /auth/wechat-login）
 * 加简单节流：同一时刻只发一次，避免 wx.login 限流
 */
let _loginLock = false;
let _loginPromise = null;

const silentLogin = () => {
  if (_loginLock) return _loginPromise || Promise.reject({ code: -1, message: '登录中，请稍候' });
  _loginLock = true;
  _loginPromise = new Promise((resolve, reject) => {
    console.log('[silentLogin] calling wx.login...');
    wx.login({
      success: (res) => {
        if (!res.code) {
          _loginLock = false; _loginPromise = null;
          return reject({ code: -1, message: 'wx.login no code' });
        }
        wx.request({
          url: `${API_BASE_URL}/v1/auth/wechat-login`,
          method: 'POST',
          data: { code: res.code },
          header: { 'Content-Type': 'application/json' },
          success: (loginRes) => {
            _loginLock = false; _loginPromise = null;
            console.log('[silentLogin] response status:', loginRes.statusCode, 'body:', loginRes.data);
            if (loginRes.statusCode >= 200 && loginRes.statusCode < 300) {
              const body = loginRes.data;
              const isSuccess = body.code === 0 || body.code === 200;
              if (isSuccess) {
                const data = body.data !== undefined ? body.data : body;
                if (data.token) {
                  try { getApp().globalData.token = data.token; } catch(e) {}
                  wx.setStorageSync('token', data.token);
                }
                if (data.refresh_token) {
                  wx.setStorageSync('refresh_token', data.refresh_token);
                }
                console.log('[silentLogin] success, new token prefix:', (data.token || '').substring(0,15));
                resolve(data);
              } else {
                reject({ code: body.code, message: body.message || '静默登录失败' });
              }
            } else {
              reject({ code: loginRes.statusCode, message: loginRes.data?.message || '静默登录失败' });
            }
          },
          fail: (err) => { _loginLock = false; _loginPromise = null; reject({ code: -1, message: '静默登录网络异常', detail: err }); },
        });
      },
      fail: (err) => { _loginLock = false; _loginPromise = null; reject({ code: -1, message: 'wx.login failed', detail: err }); },
    });
  });
  return _loginPromise;
};

/**
 * 刷新 Token
 */
const refreshToken = () => {
  if (MODE === 'container') {
    // 云托管模式下也走 callContainer 刷新
    return request({ url: '/auth/refresh', method: 'POST', withToken: false });
  }
  // 传统模式
  return new Promise((resolve, reject) => {
    const refreshTk = wx.getStorageSync('refresh_token');
    if (!refreshTk) return reject(new Error('no refresh token'));
    // 直接走 wx.request，不走 request()，避免 401 递归死循环
    wx.request({
      url: `${API_BASE_URL}/v1/auth/refresh`,
      method: 'POST',
      data: { refresh_token: refreshTk },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        console.log('[refreshToken] response status:', res.statusCode, 'body:', res.data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          if ((body.code >= 200 && body.code < 300) || body.code === 0) {
            const data = body.data !== undefined ? body.data : body;
            console.log('[refreshToken] extracted data:', data);
            if (data.token) {
              _getApp().globalData.token = data.token;
              wx.setStorageSync('token', data.token);
            }
            resolve(data);
          } else {
            reject({ code: body.code, message: body.message || '刷新失败' });
          }
        } else {
          reject({ code: res.statusCode, message: res.data?.message || '刷新失败' });
        }
      },
      fail: (err) => reject({ code: -1, message: '网络异常', detail: err }),
    });
  });
};

/**
 * 上传文件
 */
const uploadFile = (filePath, type = 'image') => {
  const uploadUrl = `${API_BASE_URL}/v1/upload/${type}`;
  const token = _getApp().globalData?.token || wx.getStorageSync('token');
  // 根据上传类型确定字段名（与服务端 multer.single() 字段名一致）
  const nameMap = { avatar: 'avatar', image: 'image', voice: 'voice' };
  const fieldName = nameMap[type] || 'image';
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: uploadUrl, filePath, name: fieldName,
      header: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0 || data.code === 200) resolve(data.data !== undefined ? data.data : data);
          else reject(data);
        } catch (e) { reject(e); }
      },
      fail: reject,
    });
  });
};

module.exports = { request, refreshToken, uploadFile, MODE };
