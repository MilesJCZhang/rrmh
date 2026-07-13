// services/index.js - 服务层统一出口（双兼容导出）
// 页面/组件统一通过 require('@/services') 或 require('../../services/api') 取 API 常量表
const API = require('./api');

// 同时支持 `require('./services').default` 与 `require('./services').API` 两种取法
module.exports = API;
module.exports.default = API;
module.exports.API = API;
