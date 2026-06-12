// utils/contentModeration.js - 基础内容风控 + 个人信息保护
// 第一阶段：客户端基础风控 + 敏感信息脱敏
// 完整风控需配合后端微信内容安全API（msgSecCheck + imgSecCheck）

const { request } = require('./request');
const { API_BASE_URL } = require('./config');

// ========== 敏感词库（客户端基础过滤） ==========
const SENSITIVE_WORDS = [
  // 违法违规
  '赌博', '色情', '暴力', '毒品', '枪支', '传销', '诈骗',
  // 社交平台特有风险
  '杀猪盘', '裸聊', '约炮', '援交', '包养', '小三',
  // 联系方式泄露（防止绕过平台沟通）
  '微信号：', 'V信', '加微信', '加我微',
  'QQ号：', '加我Q', 'QQ群',
  '电话：', '手机号：', '联系电话',
  '支付宝', '转账', '红包',
];

// 联系方式正则模式
const CONTACT_PATTERNS = [
  /1[3-9]\d{9}/g,                    // 手机号
  /\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,    // 电话号码
  /\w+@\w+\.\w+/g,                    // 邮箱
  /微信号[：:]\s*\w+/g,               // 微信号
  /QQ[号:：]\s*\d{5,12}/g,           // QQ号
];

// ========== 内容安全检查 ==========

/**
 * 检查文本是否包含敏感信息（客户端本地检测）
 * @param {string} text - 待检查的文本
 * @returns {{ safe: boolean, level: string, matched: string[] }}
 */
const checkTextSafety = (text) => {
  if (!text || typeof text !== 'string') return { safe: true, level: 'clean', matched: [] };

  const matched = [];

  // 敏感词匹配
  for (const word of SENSITIVE_WORDS) {
    if (text.includes(word)) {
      matched.push(word);
    }
  }

  // 联系方式匹配
  for (const pattern of CONTACT_PATTERNS) {
    const results = text.match(pattern);
    if (results) {
      matched.push(...results.map(r => r.slice(0, 6) + '***'));
    }
  }

  if (matched.length > 0) {
    return { safe: false, level: matched.length > 2 ? 'high' : 'medium', matched };
  }

  return { safe: true, level: 'clean', matched: [] };
};

/**
 * 过滤敏感内容（替换为***）
 * @param {string} text
 * @returns {string}
 */
const filterSensitiveContent = (text) => {
  if (!text) return text;
  let filtered = text;

  // 替换敏感词
  for (const word of SENSITIVE_WORDS) {
    filtered = filtered.replace(new RegExp(word, 'g'), '***');
  }

  // 替换联系方式
  for (const pattern of CONTACT_PATTERNS) {
    filtered = filtered.replace(pattern, '[联系方式已屏蔽]');
  }

  return filtered;
};

/**
 * 服务端文本安全检测（微信 msgSecCheck）
 * 对应服务端：POST /v1/moderation/text-check
 * @param {string} content - 待检查的文本
 * @param {number} [scene=1] - 场景值：1=资料, 2=评论, 3=论坛, 4=社交日志
 * @returns {Promise<{safe: boolean, label: string}>}
 */
const serverCheckText = (content, scene = 1) => {
  return request({
    url: '/v1/moderation/text-check',
    method: 'POST',
    data: { content, scene },
  }).then((data) => ({
    safe: data.safe !== false,
    label: data.label || 'clean',
  })).catch(() => ({ safe: true, label: 'unknown' }));
};

/**
 * 服务端图片安全检测（微信 imgSecCheck / mediaCheckAsync）
 * 对应服务端：POST /v1/moderation/image-check
 * 小程序端使用示例：
 *   wx.chooseImage({ count: 1 }).then(res => {
 *     const filePath = res.tempFilePaths[0];
 *     return wx.uploadFile({
 *       url: `${API_BASE_URL}/v1/moderation/image-check`,
 *       filePath,
 *       name: 'media',
 *       header: { Authorization: 'Bearer ' + token }
 *     });
 *   });
 * @param {string} mediaUrl - 图片临时路径（由小程序端通过 wx.uploadFile 上传）
 * @param {number} [scene=1]
 * @returns {Promise<{safe: boolean, label: string}>}
 */
const serverCheckImage = (mediaUrl, scene = 1) => {
  return request({
    url: '/moderation/image-check',
    method: 'POST',
    data: { media_url: mediaUrl, scene },
  }).then((data) => ({
    safe: data.safe !== false,
    label: data.label || 'clean',
  })).catch(() => ({ safe: true, label: 'unknown' }));
};

/**
 * 服务端图片安全检测 - multipart 上传模式
 * 小程序端直接上传文件，服务端转发微信检测
 * 对应服务端：POST /v1/moderation/image-check
 * @param {string} filePath - wx.chooseImage 返回的临时文件路径
 * @param {string} token - 用户登录 token
 * @returns {Promise<{safe: boolean, label: string}>}
 */
const serverCheckImageUpload = (filePath, token) => {
  return new Promise((resolve) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/v1/moderation/image-check`,
      filePath,
      name: 'media',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          resolve({ safe: data.safe !== false, label: data.label || 'clean' });
        } catch (e) {
          resolve({ safe: true, label: 'unknown' });
        }
      },
      fail: () => resolve({ safe: true, label: 'unknown' }),
    });
  });
};

/**
 * 获取用户安全等级（微信 getUserRiskRank）
 * 对应服务端：POST /v1/moderation/user-risk-rank
 * @param {Object} params
 * @param {string} [params.openid]
 * @param {string} [params.mobile]
 * @param {string} [params.email]
 * @param {string} [params.wechat_id]
 * @returns {Promise<{risk_rank: number, risk_type: string, desc: string}>}
 * risk_rank: 0=安全, 1=关注, 2=中风险, 3=高风险, 4=极高风险
 */
const serverCheckUserRisk = (params = {}) => {
  return request({
    url: '/moderation/user-risk-rank',
    method: 'POST',
    data: params,
  }).then((data) => data || { risk_rank: 0, risk_type: 'unknown', desc: '' })
    .catch(() => ({ risk_rank: 0, risk_type: 'unknown', desc: '' }));
};

// ========== 个人信息保护 ==========

/**
 * 脱敏用户资料（用于展示给其他用户）
 * @param {Object} profile - 用户资料
 * @returns {Object} 脱敏后的资料
 */
const maskUserProfile = (profile) => {
  if (!profile) return profile;
  return {
    ...profile,
    real_name: profile.real_name ? _maskName(profile.real_name) : '',
    phone: profile.phone ? _maskPhone(profile.phone) : '',
    id_number: profile.id_number ? _maskIdNumber(profile.id_number) : '',
    // 以下字段不展示给其他用户
    wechat: '',
    address: profile.address ? profile.address.slice(0, 6) + '...' : '',
  };
};

/**
 * 脱敏手机号
 */
const _maskPhone = (phone) => {
  if (!phone || phone.length < 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
};

/**
 * 脱敏身份证号
 */
const _maskIdNumber = (idNumber) => {
  if (!idNumber || idNumber.length < 10) return idNumber;
  return idNumber.slice(0, 6) + '****' + idNumber.slice(-4);
};

/**
 * 脱敏姓名
 */
const _maskName = (name) => {
  if (!name) return '';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(name.length - 1);
};

/**
 * 检查资料是否完整度足够展示
 * @param {Object} profile
 * @returns {{ complete: boolean, missing: string[] }}
 */
const checkProfileCompleteness = (profile) => {
  if (!profile) return { complete: false, missing: ['基本信息'] };

  const required = [
    { key: 'nickname', label: '昵称' },
    { key: 'gender', label: '性别' },
    { key: 'birth_date', label: '出生日期' },
    { key: 'height', label: '身高' },
    { key: 'city', label: '所在城市' },
    { key: 'occupation', label: '职业' },
  ];

  const missing = required.filter(r => !profile[r.key]).map(r => r.label);

  return {
    complete: missing.length === 0,
    missing,
  };
};

module.exports = {
  checkTextSafety,
  filterSensitiveContent,
  serverCheckText,
  serverCheckImage,
  serverCheckImageUpload,
  serverCheckUserRisk,
  maskUserProfile,
  checkProfileCompleteness,
  SENSITIVE_WORDS,
};
