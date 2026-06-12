// services/avatar.service.js - AI分身服务层
// ============================================================
// 所有 AI 分身相关网络请求统一在此管理
// 支持 Mock 数据（DEV_MOCK_DATA=true 时使用）
// ============================================================

const { request, uploadFile } = require('../utils/request');
const { DEV_MOCK_DATA } = require('../utils/config');
const API = require('./api');

// ──────────────────────────────────────────────────────────
// Mock 数据（开发调试用）
// ──────────────────────────────────────────────────────────
const _MOCK = {
  avatarInfo: {
    id: 'av001',
    online: true,
    tags: ['温和耐心', '生活规律', '重视家庭', '有趣幽默'],
    groupFreeRemain: 30,
    summary: '真实、温暖、注重生活品质的人，善于倾听，对家庭有责任感。',
    status: 'ready',  // ready / processing / failed
    createdAt: '2026-04-28',
  },
  activities: [
    { id: 'a1', icon: '💬', text: '画像已与「阳光男孩」聊了12分钟，对方对您感兴趣', time: '1小时前', action: '查看聊天', type: 'view_chat', actionData: 'chat001' },
    { id: 'a2', icon: '🎯', text: '系统新推荐3位新朋友，等待画像主动出击', time: '3小时前', action: null, type: null, actionData: null },
    { id: 'a3', icon: '✅', text: '画像与「知性姐姐」完成深度聊天，报告已生成', time: '昨天', action: '看报告', type: 'suggest_meet', actionData: 'chat002' },
  ],
  chatHistory: [
    {
      id: 'chat001', status: 'chatting',
      targetName: '阳光男孩', targetAvatar: '',
      summary: '聊了家乡、兴趣爱好，双方话题投机', isMatch: null,
      startTime: '今天 14:30',
    },
    {
      id: 'chat002', status: 'done',
      targetName: '知性姐姐', targetAvatar: '',
      summary: '深度了解三观，双方均有好感', isMatch: true,
      startTime: '昨天 20:15',
    },
    {
      id: 'chat003', status: 'done',
      targetName: '健身达人', targetAvatar: '',
      summary: '生活方式差异较大，画像评估推荐度低', isMatch: false,
      startTime: '3天前',
    },
  ],
  matchList: [
    { id: 'u101', nickname: '晴天', avatar: '', age: 28, city: '深圳', job: '产品经理', tags: ['温柔', '爱旅行'], avatarReady: true, matchScore: 92 },
    { id: 'u102', nickname: '小白', avatar: '', age: 31, city: '广州', job: '设计师', tags: ['独立', '爱音乐'], avatarReady: true, matchScore: 87 },
    { id: 'u103', nickname: '星星', avatar: '', age: 26, city: '上海', job: '教师', tags: ['善良', '有想法'], avatarReady: false, matchScore: 80 },
  ],
};

// ──────────────────────────────────────────────────────────
// API 调用
// ──────────────────────────────────────────────────────────

/**
 * 获取 AI 分身基本信息
 */
const getAvatarInfo = () => {
  if (DEV_MOCK_DATA) return Promise.resolve(_MOCK.avatarInfo);
  return request({ url: API.AVATAR.INFO });
};

/**
 * 获取 AI 分身动态列表
 * @param {number} limit
 */
const getAvatarActivities = (limit = 5) => {
  if (DEV_MOCK_DATA) return Promise.resolve(_MOCK.activities.slice(0, limit));
  return request({ url: API.AVATAR.ACTIVITIES, data: { limit } });
};

/**
 * 提交语音答案，生成 AI 分身
 * voiceAnswers: [{questionIndex, question, voiceUrl}]
 */
const generateAvatar = (voiceAnswers) => {
  if (DEV_MOCK_DATA) {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ jobId: 'job_mock_001', estimatedSeconds: 30 }), 1000);
    });
  }
  return request({
    url: API.AVATAR.GENERATE,
    method: 'POST',
    data: { voiceAnswers },
    timeout: 60000,  // 生成可能较慢
  });
};

/**
 * 查询 AI 分身生成进度
 * @param {string} jobId
 */
const getAvatarGenerateStatus = (jobId) => {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ status: 'ready', progress: 100 });
  }
  return request({ url: `${API.AVATAR.GEN_STATUS}?jobId=${jobId}` });
};

/**
 * 获取推荐推荐列表
 * @param {Object} filter { distance, ageMin, ageMax, city }
 */
const getMatchList = (filter = {}) => {
  if (DEV_MOCK_DATA) return Promise.resolve(_MOCK.matchList);
  return request({ url: API.MATCH.RECOMMEND, data: filter });
};

/**
 * 获取画像聊天历史列表
 */
const getChatHistory = () => {
  if (DEV_MOCK_DATA) return Promise.resolve(_MOCK.chatHistory);
  return request({ url: API.CHAT.HISTORY });
};

/**
 * 获取单个聊天详情（含消息记录）
 * @param {string} chatId
 */
const getChatDetail = (chatId) => {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({
      id: chatId,
      status: 'done',
      messages: [
        { id: 'm1', from: 'me', senderName: '我的画像', content: '你好！很高兴认识你，我叫晴天的画像～', time: '14:30', avatar: '' },
        { id: 'm2', from: 'target', senderName: '对方画像', content: '嗨！我是阳光男孩的画像，你平时有什么兴趣爱好？', time: '14:31', avatar: '' },
        { id: 'm3', from: 'me', senderName: '我的画像', content: '我喜欢旅行和读书，每年会去几个城市走走，你呢？', time: '14:32', avatar: '' },
        { id: 'm4', from: 'target', senderName: '对方画像', content: '我也很喜欢旅行！上个月刚去了云南，风景真的很美。', time: '14:33', avatar: '' },
        { id: 'm5', from: 'me', senderName: '我的画像', content: '云南真棒！我去年也去了大理和丽江，特别喜欢那里的节奏。', time: '14:35', avatar: '' },
      ],
      report: {
        summary: '双方都热爱旅行，话题投机，三观较为一致。聊天气氛轻松愉快，互有好感。',
        isMatch: true,
        matchScore: 88,
        highlights: ['旅行爱好相同', '生活节奏相近', '价值观契合'],
      },
    });
  }
  return request({ url: API.CHAT.MESSAGES.replace(':chatId', chatId) });
};

/**
 * 发起一对一画像聊天
 * @param {string} targetUserId
 * @param {string} orderId  支付订单ID
 */
const startChat = (targetUserId, orderId) => {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ chatId: `chat_mock_${Date.now()}` });
  }
  return request({
    url: API.CHAT.START,
    method: 'POST',
    data: { target_user_id: targetUserId, order_id: orderId },
  });
};

/**
 * 上传语音文件
 * @param {string} filePath  本地临时路径
 */
const uploadVoice = (filePath) => {
  return uploadFile(filePath, 'voice');
};

/**
 * 更新画像设置（开启/关闭画像）
 * @param {Object} settings { online }
 */
const updateAvatarSettings = (settings) => {
  if (DEV_MOCK_DATA) return Promise.resolve({ success: true });
  return request({ url: API.AVATAR.SETTINGS, method: 'PUT', data: settings });
};

/**
 * 加入推荐群
 */
const joinGroup = () => {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ groupId: 'group_mock_001', freeRemain: 30 });
  }
  return request({ url: API.GROUP.JOIN, method: 'POST' });
};

/**
 * 申请线下见面（通过推荐官邀约）
 * @param {string} chatId
 */
const applyMeet = (chatId) => {
  if (DEV_MOCK_DATA) return Promise.resolve({ success: true });
  return request({ url: API.MEET.APPLY, method: 'POST', data: { chat_id: chatId } });
};

/**
 * 推荐官获取名下会员的AI画像列表
 * 返回 { stats: { total, active, matched, chatting }, list: [...] }
 */
const getMemberAvatars = () => {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({
      stats: { total: 5, active: 4, matched: 3, chatting: 1 },
      list: [
        { id: 'm001', name: '小雨', avatar: '', age: 28, city: '威海', online: true, matching: true, statusText: '画像活跃中', lastActive: '刚刚' },
        { id: 'm002', name: '阿梅', avatar: '', age: 35, city: '青岛', online: true, matching: true, statusText: '画像活跃中', lastActive: '5分钟前' },
        { id: 'm003', name: '张姐', avatar: '', age: 42, city: '烟台', online: true, matching: true, statusText: '画像聊天中', lastActive: '10分钟前' },
        { id: 'm004', name: '小芳', avatar: '', age: 26, city: '大理', online: false, matching: false, statusText: '画像休眠中', lastActive: '3天前' },
        { id: 'm005', name: '陈哥', avatar: '', age: 38, city: '楚雄', online: true, matching: true, statusText: '画像活跃中', lastActive: '刚刚' },
      ],
    });
  }
  return request({ url: API.MATCHMAKER.MY_MEMBERS });
};

module.exports = {
  getAvatarInfo,
  getAvatarActivities,
  getMemberAvatars,
  generateAvatar,
  getAvatarGenerateStatus,
  getMatchList,
  getChatHistory,
  getChatDetail,
  startChat,
  uploadVoice,
  updateAvatarSettings,
  joinGroup,
  applyMeet,
};
