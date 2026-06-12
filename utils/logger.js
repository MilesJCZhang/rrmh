/**
 * utils/logger.js - 统一日志工具
 *
 * 生产环境自动屏蔽 DEBUG 级别日志，
 * 保留 INFO/WARN/ERROR 级别（但 INFO 也会过滤掉敏感数据输出）。
 *
 * 用法:
 *   const logger = require('./logger');
 *   logger.debug('[tag] message', data);   // 仅开发环境输出
 *   logger.info('[tag] message');          // 始终输出
 *   logger.warn('[tag] message');          // 始终输出
 *   logger.error('[tag] message', err);    // 始终输出
 */

const IS_DEV = (process.env.NODE_ENV || 'development') !== 'production';

function debug(...args) {
  if (IS_DEV) {
    console.log('[DEBUG]', ...args);
  }
}

function info(...args) {
  console.log('[INFO]', ...args);
}

function warn(...args) {
  console.warn('[WARN]', ...args);
}

function error(...args) {
  console.error('[ERROR]', ...args);
}

module.exports = { debug, info, warn, error };
