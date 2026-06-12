// utils/avatar-helper.js
// 统一处理头像 URL：兜底 + 加载失败自动替换
// ============================================================

const DEFAULT_AVATAR = '/assets/images/default-avatar.png';

/**
 * 获取安全的头像 URL
 * - 空值 → 默认头像
 * - 相对路径（/ 开头）→ 原样返回（本地文件）
 * - 完整 URL → 原样返回（网络图片）
 * @param {string|null} url
 * @returns {string}
 */
function getAvatarUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return DEFAULT_AVATAR;
  }
  const s = url.trim();
  // 已经是完整 URL 或本地路径，直接返回
  return s;
}

/**
 * 判断是否为「可能失效的网络头像」
 *（微信第三方头像域名，会过期）
 * @param {string} url
 * @returns {boolean}
 */
function isVolatileUrl(url) {
  if (!url) return false;
  return /thirdwx\.qlogo\.cn|wx\.qlogo\.cn/.test(url);
}

/**
 * WXML binderror 的通用处理函数工厂
 * 用法：在 Page data 中设置 avatarErrorCount 字段，
 *       然后在 binderror 回调中调用此函数返回的新 avatarUrl。
 *
 * 更简单的用法：直接在 WXML 中用 wx:if/else 做双节点兜底
 * 见本文件底部的说明。
 */

/**
 * 最简单的 WXML 兜底方案（无需 JS 参与）：
 *
 * <!-- 方案A：双节点（推荐，纯 WXML） -->
 * <image wx:if="{{avatarUrl}}" src="{{avatarUrl}}" mode="aspectFill" binderror="onAvatarErr" data-field="avatarUrl" />
 * <image wx:else src="/assets/images/default-avatar.png" mode="aspectFill" />
 *
 * <!-- 方案B：binderror + JS 重置（适合需要动态切换的场景） -->
 * <image src="{{avatarUrl}}" mode="aspectFill" binderror="onAvatarError" data-field="avatarUrl" />
 *
 * // JS:
 * onAvatarError(e) {
 *   const field = e.currentTarget.dataset.field || 'avatarUrl';
 *   this.setData({ [field]: '/assets/images/default-avatar.png' });
 * }
 */

module.exports = {
  DEFAULT_AVATAR,
  getAvatarUrl,
  isVolatileUrl,
};
