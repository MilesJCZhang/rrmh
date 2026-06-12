// utils/formDraft.js - 统一表单草稿保存/加载工具
// 所有需要保存填写进度的表单页面，统一调用此工具
// 存储 key 规则：form_draft_{pagePath}，如 form_draft_verify
// ============================================================

const DRAFT_PREFIX = 'form_draft_';

/**
 * 获取页面路径作为 storage key
 * @param {Page} page - 小程序 Page 实例（this）
 * @returns {string}
 */
function _getPageKey(page) {
  const pages = getCurrentPages();
  if (!pages || pages.length === 0) return 'unknown';
  const current = pages[pages.length - 1];
  // 去掉开头的 / 和后面的参数
  let route = current.route || '';
  route = route.replace(/^\//, '');
  return DRAFT_PREFIX + route.replace(/\//g, '_');
}

/**
 * 保存表单草稿
 * @param {Page} page - this
 * @param {Object} formData - 要保存的表单数据
 * @param {Array<string>} [excludeKeys] - 不需要保存的 key 列表
 */
function saveDraft(page, formData, excludeKeys = []) {
  try {
    const key = _getPageKey(page);
    const data = { ...formData };
    // 排除指定字段（如 submitting、loading 等）
    const defaultExclude = ['submitting', 'loading', 'paying', 'pollingTimer', 'agreed', 'sensitiveAgreed'];
    const allExclude = defaultExclude.concat(excludeKeys);
    allExclude.forEach(k => delete data[k]);
    wx.setStorageSync(key, JSON.stringify({
      data,
      savedAt: Date.now(),
    }));
    console.log('[formDraft] 草稿已保存', key, data);
  } catch (e) {
    console.warn('[formDraft] 保存草稿失败', e.message);
  }
}

/**
 * 加载表单草稿
 * @param {Page} page - this
 * @param {number} [maxAge=86400000] - 草稿最大有效期（ms），默认 24 小时
 * @returns {Object|null} 草稿数据，或 null
 */
function loadDraft(page, maxAge = 24 * 60 * 60 * 1000) {
  try {
    const key = _getPageKey(page);
    const raw = wx.getStorageSync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    // 检查有效期
    if (parsed.savedAt && (Date.now() - parsed.savedAt > maxAge)) {
      console.log('[formDraft] 草稿已过期，自动清除', key);
      wx.removeStorageSync(key);
      return null;
    }
    console.log('[formDraft] 草稿已加载', key, parsed.data);
    return parsed.data;
  } catch (e) {
    console.warn('[formDraft] 加载草稿失败', e.message);
    return null;
  }
}

/**
 * 清除表单草稿
 * @param {Page} page - this
 */
function clearDraft(page) {
  try {
    const key = _getPageKey(page);
    wx.removeStorageSync(key);
    console.log('[formDraft] 草稿已清除', key);
  } catch (e) {
    console.warn('[formDraft] 清除草稿失败', e.message);
  }
}

/**
 * 清除所有表单草稿（用于退出登录时）
 */
function clearAllDrafts() {
  try {
    const keys = wx.getStorageInfoSync().keys || [];
    keys.forEach(k => {
      if (k.startsWith(DRAFT_PREFIX)) {
        wx.removeStorageSync(k);
      }
    });
    console.log('[formDraft] 所有草稿已清除');
  } catch (e) {
    console.warn('[formDraft] 清除所有草稿失败', e.message);
  }
}

module.exports = {
  saveDraft,
  loadDraft,
  clearDraft,
  clearAllDrafts,
};
