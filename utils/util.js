// util.js - 工具函数库

/**
 * 格式化时间
 * @param {Date|string|number} date - 日期对象或时间戳
 * @param {string} format - 格式字符串，默认 'YYYY-MM-DD HH:mm'
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(date, format = 'YYYY-MM-DD HH:mm') {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  const second = d.getSeconds().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

/**
 * 格式化金额
 * @param {number} amount - 金额（分或元）
 * @param {boolean} isCent - 是否为分，默认为false（元）
 * @returns {string} 格式化后的金额字符串
 */
function formatMoney(amount, isCent = false) {
  if (amount === null || amount === undefined) return '¥0.00';
  
  let yuan = isCent ? amount / 100 : amount;
  yuan = parseFloat(yuan).toFixed(2);
  
  // 添加千分位分隔符
  const parts = yuan.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return '¥' + parts.join('.');
}

/**
 * 格式化手机号
 * @param {string} phone - 手机号
 * @returns {string} 格式化后的手机号
 */
function formatPhone(phone) {
  if (!phone || phone.length !== 11) return phone;
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 **** $3');
}

/**
 * 验证手机号格式
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
function validatePhone(phone) {
  const reg = /^1[3-9]\d{9}$/;
  return reg.test(phone);
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱
 * @returns {boolean} 是否有效
 */
function validateEmail(email) {
  const reg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return reg.test(email);
}

/**
 * 验证身份证号格式
 * @param {string} idCard - 身份证号
 * @returns {boolean} 是否有效
 */
function validateIdCard(idCard) {
  const reg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  return reg.test(idCard);
}

/**
 * 深拷贝对象
 * @param {Object} obj - 要拷贝的对象
 * @returns {Object} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  
  return obj;
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait = 300) {
  let timeout = null;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, wait = 300) {
  let timeout = null;
  let previous = 0;
  
  return function(...args) {
    const context = this;
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };
}

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @param {string} url - URL地址，默认为当前页面URL
 * @returns {string|null} 参数值
 */
function getQueryParam(name, url = '') {
  const queryString = url.split('?')[1] || wx.getStorageSync('currentUrl') || '';
  const params = new URLSearchParams(queryString);
  return params.get(name);
}

/**
 * 设置URL参数
 * @param {string} url - 原始URL
 * @param {Object} params - 参数对象
 * @returns {string} 添加参数后的URL
 */
function setQueryParam(url, params) {
  const urlObj = new URL(url);
  Object.keys(params).forEach(key => {
    urlObj.searchParams.set(key, params[key]);
  });
  return urlObj.toString();
}

/**
 * 计算距离现在的时间
 * @param {Date|string|number} date - 日期
 * @returns {string} 时间描述
 */
function timeAgo(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return Math.floor(diff / minute) + '分钟前';
  } else if (diff < day) {
    return Math.floor(diff / hour) + '小时前';
  } else if (diff < week) {
    return Math.floor(diff / day) + '天前';
  } else if (diff < month) {
    return Math.floor(diff / week) + '周前';
  } else if (diff < year) {
    return Math.floor(diff / month) + '个月前';
  } else {
    return Math.floor(diff / year) + '年前';
  }
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名
 */
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

/**
 * 检查文件类型是否允许
 * @param {string} filename - 文件名
 * @param {Array} allowedTypes - 允许的类型数组
 * @returns {boolean} 是否允许
 */
function isFileTypeAllowed(filename, allowedTypes = ['jpg', 'jpeg', 'png', 'gif']) {
  const ext = getFileExtension(filename);
  return allowedTypes.includes(ext);
}

/**
 * 获取文件大小描述
 * @param {number} bytes - 字节数
 * @returns {string} 大小描述
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成UUID
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 检查对象是否为空
 * @param {Object} obj - 要检查的对象
 * @returns {boolean} 是否为空
 */
function isEmptyObject(obj) {
  if (!obj || typeof obj !== 'object') return true;
  return Object.keys(obj).length === 0;
}

/**
 * 安全获取对象属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {any} defaultValue - 默认值
 * @returns {any} 属性值
 */
function safeGet(obj, path, defaultValue = null) {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    current = current[key];
  }
  
  return current === undefined ? defaultValue : current;
}

/**
 * 数组去重
 * @param {Array} array - 数组
 * @returns {Array} 去重后的数组
 */
function uniqueArray(array) {
  return [...new Set(array)];
}

/**
 * 数组分组
 * @param {Array} array - 数组
 * @param {Function} keyFunc - 分组键函数
 * @returns {Object} 分组后的对象
 */
function groupBy(array, keyFunc) {
  return array.reduce((result, item) => {
    const key = keyFunc(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {});
}

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise} Promise对象
 */
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: text,
        success: resolve,
        fail: reject
      });
    } else {
      reject(new Error('不支持复制到剪贴板'));
    }
  });
}

/**
 * 获取当前页面路径
 * @returns {string} 页面路径
 */
function getCurrentPagePath() {
  const pages = getCurrentPages();
  if (pages.length === 0) return '';
  
  const currentPage = pages[pages.length - 1];
  return currentPage.route;
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {Object} options - 选项
 * @returns {Promise} Promise对象
 */
function showConfirm(title, content, options = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title: title || '提示',
      content: content || '',
      showCancel: options.showCancel !== false,
      cancelText: options.cancelText || '取消',
      confirmText: options.confirmText || '确定',
      cancelColor: options.cancelColor || '#999999',
      confirmColor: options.confirmColor || '#FF3366',
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
}

module.exports = {
  formatTime,
  formatMoney,
  formatPhone,
  validatePhone,
  validateEmail,
  validateIdCard,
  deepClone,
  debounce,
  throttle,
  randomString,
  getQueryParam,
  setQueryParam,
  timeAgo,
  getFileExtension,
  isFileTypeAllowed,
  formatFileSize,
  generateUUID,
  isEmptyObject,
  safeGet,
  uniqueArray,
  groupBy,
  sleep,
  copyToClipboard,
  getCurrentPagePath,
  showConfirm
};