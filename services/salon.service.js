// services/salon.service.js - 沙龙活动相关 API
// ============================================================

const { request } = require('../utils/request');
const API = require('./api');
const { DEV_MOCK_DATA } = require('../utils/config');

const _MOCK_SALONS = [
  {
    id: 1,
    name: '深圳·南山 4月社交圈层沙龙',
    date: '2026-04-20',
    time: '14:00',
    location: '南山区某地',
    max_participants: 30,
    current_count: 18,
    fee: 299,
    organizer_id: 1,
    status: 'upcoming',
    process: [
      { time: '14:00-14:30', title: '签到入场', description: '来宾签到' },
      { time: '14:30-15:30', title: '破冰环节', description: '自我介绍' },
    ],
    notices: ['请准时到场', '着装得体'],
  },
];

const _MOCK_TEMPLATES = [
  {
    id: 1,
    name: '标准社交沙龙',
    description: '适合一般社交活动',
    process: [
      { time: '14:00-14:30', title: '签到入场', description: '来宾签到，领取活动资料' },
      { time: '14:30-14:45', title: '破冰环节', description: '自我介绍，互相认识' },
      { time: '14:45-16:15', title: '自由交流', description: '分组讨论，自由互动' },
      { time: '16:15-16:30', title: '总结分享', description: '活动总结，合影留念' },
    ],
    notices: [
      '请准时签到，迟到超过15分钟将无法入场',
      '活动期间请将手机调至静音',
      '尊重他人隐私',
      '着装得体',
    ],
    default_fee: 299,
    default_max_count: 30,
    default_min_count: 15,
    default_duration: 150,
    is_system: true,
    status: 1,
  },
  {
    id: 2,
    name: '高端精英派对',
    description: '专为高端人群设计',
    process: [
      { time: '18:30-19:00', title: '红毯签到', description: '精美签到墙' },
      { time: '19:00-19:30', title: '开场致辞', description: '主持人介绍' },
      { time: '19:30-20:30', title: '主题分享', description: '嘉宾分享' },
    ],
    notices: ['建议正装出席', '名额有限'],
    default_fee: 399,
    default_max_count: 50,
    default_min_count: 20,
    default_duration: 210,
    is_system: true,
    status: 1,
  },
  {
    id: 3,
    name: '户外拓展社交',
    description: '户外运动为主',
    process: [
      { time: '09:00-09:30', title: '集合签到', description: '指定地点集合' },
      { time: '09:30-12:00', title: '户外拓展', description: '团队协作游戏' },
    ],
    notices: ['穿着运动装', '注意防晒'],
    default_fee: 199,
    default_max_count: 40,
    default_min_count: 20,
    default_duration: 420,
    is_system: true,
    status: 1,
  },
];

/**
 * 获取沙龙列表
 */
function getSalonList(params = {}) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ total: _MOCK_SALONS.length, list: _MOCK_SALONS });
  }
  return request({ url: API.SALON.LIST, data: params });
}

/**
 * 获取沙龙详情
 */
function getSalonDetail(salonId) {
  if (DEV_MOCK_DATA) {
    const item = _MOCK_SALONS.find(s => s.id == salonId) || _MOCK_SALONS[0];
    return Promise.resolve(item);
  }
  return request({ url: API.SALON.DETAIL.replace(':id', salonId) });
}

/**
 * 报名参加沙龙
 */
function joinSalon(salonId, params = {}) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, message: '报名成功（Mock）' });
  }
  return request({ url: API.SALON.JOIN.replace(':id', salonId), method: 'POST', data: params });
}

/**
 * 创建沙龙（城市合伙人专用）
 * @param {Object} params - { name, description, cover, date, time, location, city, max_participants, fee, process, notices, template_id }
 */
function createSalon(params) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, id: Date.now(), message: '创建成功（Mock）' });
  }
  return request({ url: API.SALON.CREATE, method: 'POST', data: params });
}

/**
 * 获取我参与/举办的沙龙
 */
function getMySalons(filter) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ list: _MOCK_SALONS.slice(0, 1) });
  }
  const params = {};
  if (filter) params.filter = filter;
  return request({ url: API.SALON.MY_LIST, data: params });
}

/**
 * 创建性别主体沙龙（推荐官专用）
 * @param {Object} data - { title, description, location, startTime, endTime, maxParticipants, registrationFee, coverImage, requirements }
 */
function createGenderSalon(data) {
  return request({ url: API.SALON.CREATE_GENDER, method: 'POST', data });
}

/**
 * 带随行人员报名沙龙（含详细资料）
 * @param {number|string} activityId - 沙龙ID
 * @param {Object} params - 报名参数
 * @param {string} params.name - 主推荐官姓名（必填）
 * @param {string} params.mobile - 主推荐官手机（必填）
 * @param {string} [params.gender] - 性别（选填）
 * @param {number} [params.age] - 年龄（选填）
 * @param {string} [params.industry] - 所在行业（选填）
 * @param {string} [params.identity] - 身份属性：上班族/个体老板/自由职业/其他（选填）
 * @param {string} [params.position] - 上班岗位/职务（选填）
 * @param {string} [params.business] - 经营主营项目（选填）
 * @param {string} [params.advantage] - 个人优势资源简介（选填）
 * @param {Array} [params.companions] - 随行人员列表（最多2人，每人含name/mobile等字段）
 */
function joinWithCompanions(activityId, params) {
  return request({ url: API.SALON.JOIN.replace(':id', activityId), method: 'POST', data: params });
}

/**
 * 导出本场沙龙所有报名人员资料（Excel）
 * @param {number|string} activityId - 沙龙ID
 */
function exportSalonMembers(activityId) {
  return request({ url: API.SALON.EXPORT.replace(':id', activityId), method: 'GET' });
}

/**
 * 触发生成沙龙海报
 * @param {number|string} activityId - 沙龙ID
 */
function generateSalonPoster(activityId) {
  return request({ url: API.SALON.POSTER.replace(':id', activityId), method: 'POST' });
}

/**
 * 取消报名
 * @param {number|string} activityId - 沙龙ID
 */
function cancelRegistration(activityId) {
  return request({ url: API.SALON.CANCEL.replace(':id', activityId), method: 'POST' });
}

/**
 * 审核沙龙（管理员）
 * @param {number|string} activityId - 沙龙ID
 * @param {string} action - 'approve' 或 'reject'
 * @param {string} [rejectReason] - 拒绝原因（action='reject'时必填）
 */
function approveSalon(activityId, action, rejectReason) {
  const data = { action };
  if (rejectReason) data.rejectReason = rejectReason;
  return request({ url: API.SALON.APPROVE.replace(':id', activityId), method: 'PUT', data });
}

/**
 * 发布沙龙（推荐官，审核通过后发布）
 * @param {number|string} activityId - 沙龙ID
 */
function publishSalon(activityId) {
  return request({ url: API.SALON.PUBLISH.replace(':id', activityId), method: 'POST' });
}

/**
 * 获取活动模板列表
 */
function getTemplateList() {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ list: _MOCK_TEMPLATES });
  }
  return request({ url: API.SALON.TEMPLATE_LIST });
}

/**
 * 获取模板详情
 */
function getTemplateDetail(templateId) {
  if (DEV_MOCK_DATA) {
    const item = _MOCK_TEMPLATES.find(t => t.id == templateId) || _MOCK_TEMPLATES[0];
    return Promise.resolve(item);
  }
  return request({ url: API.SALON.TEMPLATE_DETAIL.replace(':id', templateId) });
}

module.exports = {
  getSalonList,
  getSalonDetail,
  joinSalon,
  createSalon,
  getMySalons,
  getTemplateList,
  getTemplateDetail,
  createGenderSalon,
  joinWithCompanions,
  cancelRegistration,
  approveSalon,
  publishSalon,
  exportSalonMembers,
  generateSalonPoster,
};
