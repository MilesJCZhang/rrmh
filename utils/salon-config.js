/**
 * 沙龙配置系统
 * 支持三种沙龙类型的灵活配置：常规沙龙、男推荐官沙龙、女推荐官沙龙
 * 
 * 使用方式：
 * 1. 在页面中引入：const { SALON_TYPES, getSalonConfig } = require('../../utils/salon-config');
 * 2. 获取配置：const config = getSalonConfig('male_salon');
 * 3. 使用配置：config.themeColor, config.maxParticipants 等
 */

// ============================================
// 沙龙类型常量
// ============================================
const SALON_TYPES = {
  MIXED: 'mixed',           // 常规沙龙（3男3女）
  MALE_SALON: 'male_salon',     // 男推荐官主体沙龙
  FEMALE_SALON: 'female_salon', // 女推荐官主体沙龙
};

// ============================================
// 沙龙类型配置
// ============================================
const SALON_TYPE_CONFIG = {
  [SALON_TYPES.MIXED]: {
    // 基本信息
    type: SALON_TYPES.MIXED,
    name: '圈层主题沙龙',
    shortName: '主题沙龙',
    description: '线下志趣交流・品质圈层聚会',
    
    // 主题配置
    theme: {
      color: '#C8102E',           // 主题色（红色）
      lightColor: '#FFF0F0',      // 浅色背景
      gradient: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
      bannerBg: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
      icon: '🎉',
      emoji: '🌸',
    },
    
    // 页面配置
    page: {
      list: '/subpackages/activity/pages/salon-weekly/salon-weekly',
      weekly: '/subpackages/activity/pages/salon-weekly/salon-weekly',
      detail: '/subpackages/activity/pages/salon-detail/salon-detail',
      create: '/subpackages/activity/pages/salon-create/salon-create',
      navTitle: '主题社交沙龙',
    },
    
    // 功能配置
    features: {
      isGrouped: true,              // 是否分组
      maxParticipants: 6,           // 最大参与人数
      maxPerGender: 3,             // 每性别最大人数
      allowCompanions: true,        // 是否允许随行人员
      maxCompanions: 3,            // 最大随行人数
      requireScoreTier: true,       // 是否需要评分等级
      allowedTiers: ['gold', 'silver', 'bronze'], // 允许的评分等级
      weeklyLimit: 0,              // 每周报名次数限制（0=无限制）
      needApproval: true,           // 是否需要审核
      showScoreFilter: true,       // 是否显示评分筛选
    },
    
    // 报名流程配置
    registration: {
      needPersonalInfo: true,       // 是否需要个人资料
      needCompanionInfo: false,     // 随行人员是否需要详细资料
      needPayment: true,            // 是否需要支付
      defaultFee: 399,             // 默认报名费
      allowFree: false,             // 是否允许免费
    },
    
    // 分组配置
    grouping: {
      strategy: 'score_tier',       // 分组策略：score_tier（按评分段）, manual（手动）
      groupSize: 6,                // 每组人数
      maleCount: 3,                // 每组男性人数
      femaleCount: 3,              // 每组女性人数
    },
    
    // 权限配置
    permissions: {
      whoCanCreate: ['admin', 'matchmaker'], // 谁可以创建：admin（管理员）, matchmaker（推荐官）
      whoCanJoin: 'all',           // 谁可以参加：all（所有人）, matchmaker（仅推荐官）, specific_gender（特定性别）
      genderRestriction: 'none',    // 性别限制：none（无）, male（仅男性）, female（仅女性）
    },
    
    // 服务保障
    serviceGuarantee: [
      '3男3女精准分组',
      '资料隐私加密保护',
      '按评分段匹配',
    ],
    
    // API配置
    api: {
      list: '/api/v1/salons',
      detail: '/api/v1/salons/:id',
      register: '/api/v1/salons/:id/register',
      create: '/api/v1/salons/create',
    },
  },
  
  [SALON_TYPES.MALE_SALON]: {
    // 基本信息
    type: SALON_TYPES.MALE_SALON,
    name: '男推荐官主体沙龙',
    shortName: '男沙龙',
    description: '男士推荐官主办・专属圈层交流',
    
    // 主题配置
    theme: {
      color: '#1565C0',           // 主题色（蓝色）
      lightColor: '#E3F2FD',      // 浅色背景
      gradient: 'linear-gradient(135deg, #1565C0, #42A5F5)',
      bannerBg: 'linear-gradient(135deg, #1565C0, #42A5F5)',
      icon: '🏋‍♂️',
      emoji: '💙',
    },
    
    // 页面配置
    page: {
      list: '/subpackages/activity/pages/male-salon-list/male-salon-list',
      detail: '/subpackages/activity/pages/male-salon-detail/male-salon-detail',
      create: '/subpackages/activity/pages/male-salon-create/male-salon-create',
      navTitle: '男推荐官沙龙',
    },
    
    // 功能配置
    features: {
      isGrouped: false,             // 是否分组
      maxRecommenders: 9,          // 推荐官上限
      maxCompanionsPerPerson: 2,    // 每人最多随行人数
      totalCap: 27,                // 单场总人数封顶（9推荐官×3人）
      allowCompanions: true,        // 是否允许随行人员
      requireScoreTier: false,      // 是否需要评分等级
      allowedTiers: ['all'],       // 允许的评分等级（不限制）
      weeklyLimit: 1,              // 每周报名次数限制
      needApproval: true,           // 是否需要审核
      showScoreFilter: false,       // 是否显示评分筛选
      weekDay: [1, 2, 3, 4, 5, 6, 7], // 每周几可以举办
    },
    
    // 报名流程配置
    registration: {
      needPersonalInfo: true,       // 是否需要个人资料
      needCompanionInfo: true,      // 随行人员是否需要详细资料
      needPayment: true,            // 是否需要支付
      defaultFee: 399,             // 默认报名费
      allowFree: false,            // 是否允许免费
      companionFields: [            // 随行人员需要填写的字段
        'name',
        'phone',
        'gender',
        'age',
        'industry',
      ],
    },
    
    // 分组配置
    grouping: {
      strategy: 'none',             // 不分组
      groupSize: 0,
      maleCount: 0,
      femaleCount: 0,
    },
    
    // 权限配置
    permissions: {
      whoCanCreate: ['male_matchmaker'], // 谁可以创建：仅男性推荐官
      whoCanJoin: 'specific_gender',    // 谁可以参加：特定性别
      genderRestriction: 'male',        // 性别限制：仅男性
    },
    
    // 服务保障
    serviceGuarantee: [
      '可携随行朋友',
      '按评分段匹配',
      '男士推荐官专属',
    ],
    
    // 收益配置
    earnings: {
      enable: true,                // 是否启用收益
      recommenderFee: 50,          // 推荐官收益（元/人）
      platformFee: 349,            // 平台收益（元/人）
    },
    
    // API配置
    api: {
      list: '/api/v1/salons?type=male_salon',
      detail: '/api/v1/salons/:id',
      register: '/api/v1/salons/:id/register',
      create: '/api/v1/salons/create',
      checkWeeklyLimit: '/api/v1/salons/check-weekly-limit',
    },
  },
  
  [SALON_TYPES.FEMALE_SALON]: {
    // 基本信息
    type: SALON_TYPES.FEMALE_SALON,
    name: '女推荐官主体沙龙',
    shortName: '女沙龙',
    description: '女士推荐官主办・专属圈层交流',
    
    // 主题配置
    theme: {
      color: '#C2185B',           // 主题色（粉色）
      lightColor: '#FCE4EC',      // 浅色背景
      gradient: 'linear-gradient(135deg, #C2185B, #F06292)',
      bannerBg: 'linear-gradient(135deg, #C2185B, #F06292)',
      icon: '🏋‍♀️',
      emoji: '💗',
    },
    
    // 页面配置
    page: {
      list: '/subpackages/activity/pages/female-salon-list/female-salon-list',
      detail: '/subpackages/activity/pages/female-salon-detail/female-salon-detail',
      create: '/subpackages/activity/pages/female-salon-create/female-salon-create',
      navTitle: '女推荐官沙龙',
    },
    
    // 功能配置
    features: {
      isGrouped: false,             // 是否分组
      maxRecommenders: 9,          // 推荐官上限
      maxCompanionsPerPerson: 2,    // 每人最多随行人数
      totalCap: 27,                // 单场总人数封顶（9推荐官×3人）
      allowCompanions: true,        // 是否允许随行人员
      requireScoreTier: false,      // 是否需要评分等级
      allowedTiers: ['all'],       // 允许的评分等级（不限制）
      weeklyLimit: 1,              // 每周报名次数限制
      needApproval: true,           // 是否需要审核
      showScoreFilter: false,       // 是否显示评分筛选
      weekDay: [1, 2, 3, 4, 5, 6, 7], // 每周几可以举办
    },
    
    // 报名流程配置
    registration: {
      needPersonalInfo: true,       // 是否需要个人资料
      needCompanionInfo: true,      // 随行人员是否需要详细资料
      needPayment: true,            // 是否需要支付
      defaultFee: 399,             // 默认报名费
      allowFree: false,            // 是否允许免费
      companionFields: [            // 随行人员需要填写的字段
        'name',
        'phone',
        'gender',
        'age',
        'industry',
      ],
    },
    
    // 分组配置
    grouping: {
      strategy: 'none',             // 不分组
      groupSize: 0,
      maleCount: 0,
      femaleCount: 0,
    },
    
    // 权限配置
    permissions: {
      whoCanCreate: ['female_matchmaker'], // 谁可以创建：仅女性推荐官
      whoCanJoin: 'specific_gender',      // 谁可以参加：特定性别
      genderRestriction: 'female',        // 性别限制：仅女性
    },
    
    // 服务保障
    serviceGuarantee: [
      '可携随行朋友',
      '按评分段匹配',
      '女士推荐官专属',
    ],
    
    // 收益配置
    earnings: {
      enable: true,                // 是否启用收益
      recommenderFee: 50,          // 推荐官收益（元/人）
      platformFee: 349,            // 平台收益（元/人）
    },
    
    // API配置
    api: {
      list: '/api/v1/salons?type=female_salon',
      detail: '/api/v1/salons/:id',
      register: '/api/v1/salons/:id/register',
      create: '/api/v1/salons/create',
      checkWeeklyLimit: '/api/v1/salons/check-weekly-limit',
    },
  },
};

// ============================================
// 配置获取函数
// ============================================

/**
 * 获取沙龙类型配置
 * @param {string} type - 沙龙类型（mixed/male_salon/female_salon）
 * @returns {Object} 配置对象
 */
function getSalonConfig(type) {
  if (!type || !SALON_TYPE_CONFIG[type]) {
    console.warn(`[salon-config] 未知的沙龙类型: ${type}，使用默认配置（mixed）`);
    return SALON_TYPE_CONFIG[SALON_TYPES.MIXED];
  }
  return SALON_TYPE_CONFIG[type];
}

/**
 * 获取所有沙龙类型配置
 * @returns {Object} 所有配置
 */
function getAllSalonConfigs() {
  return SALON_TYPE_CONFIG;
}

/**
 * 获取沙龙类型列表（用于首页入口配置）
 * @returns {Array} 沙龙类型列表
 */
function getSalonTypeList() {
  return [
    {
      key: 'mixed',
      type: SALON_TYPES.MIXED,
      name: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].name,
      shortName: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].shortName,
      description: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].description,
      icon: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].theme.icon,
      color: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].theme.color,
      page: SALON_TYPE_CONFIG[SALON_TYPES.MIXED].page.list,
      gridKey: 'salon',
    },
    {
      key: 'male_salon',
      type: SALON_TYPES.MALE_SALON,
      name: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].name,
      shortName: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].shortName,
      description: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].description,
      icon: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].theme.icon,
      color: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].theme.color,
      page: SALON_TYPE_CONFIG[SALON_TYPES.MALE_SALON].page.list,
      gridKey: 'maleSalon',
    },
    {
      key: 'female_salon',
      type: SALON_TYPES.FEMALE_SALON,
      name: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].name,
      shortName: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].shortName,
      description: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].description,
      icon: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].theme.icon,
      color: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].theme.color,
      page: SALON_TYPE_CONFIG[SALON_TYPES.FEMALE_SALON].page.list,
      gridKey: 'femaleSalon',
    },
  ];
}

/**
 * 根据首页gridKey获取沙龙类型配置
 * @param {string} gridKey - 宫格key（salon/maleSalon/femaleSalon）
 * @returns {Object} 配置对象
 */
function getSalonConfigByGridKey(gridKey) {
  const map = {
    salon: SALON_TYPES.MIXED,
    maleSalon: SALON_TYPES.MALE_SALON,
    femaleSalon: SALON_TYPES.FEMALE_SALON,
  };
  const type = map[gridKey];
  if (!type) {
    console.warn(`[salon-config] 未知的gridKey: ${gridKey}`);
    return null;
  }
  return getSalonConfig(type);
}

/**
 * 检查用户是否有权限参加指定类型的沙龙
 * @param {string} salonType - 沙龙类型
 * @param {Object} userInfo - 用户信息
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkJoinPermission(salonType, userInfo) {
  const config = getSalonConfig(salonType);
  if (!config) {
    return { allowed: false, reason: '沙龙类型不存在' };
  }
  
  const { permissions } = config;
  
  // 检查性别限制
  if (permissions.genderRestriction !== 'none') {
    if (!userInfo.gender) {
      return { allowed: false, reason: '请先完善个人资料（性别）' };
    }
    if (permissions.genderRestriction === 'male' && userInfo.gender !== 'male') {
      return { allowed: false, reason: '该沙龙仅限男性参加' };
    }
    if (permissions.genderRestriction === 'female' && userInfo.gender !== 'female') {
      return { allowed: false, reason: '该沙龙仅限女性参加' };
    }
  }
  
  // 检查评分等级限制
  if (config.features.requireScoreTier) {
    if (!userInfo.scoreTier) {
      return { allowed: false, reason: '请先完成评分测试' };
    }
    if (!config.features.allowedTiers.includes(userInfo.scoreTier)) {
      return { allowed: false, reason: `该沙龙仅限${config.features.allowedTiers.join('/')}等级参加` };
    }
  }
  
  // 检查推荐官身份
  if (permissions.whoCanJoin === 'matchmaker') {
    if (!userInfo.isMatchmaker) {
      return { allowed: false, reason: '该沙龙仅限推荐官参加' };
    }
  }
  
  return { allowed: true, reason: '' };
}

/**
 * 检查用户是否有权限创建指定类型的沙龙
 * @param {string} salonType - 沙龙类型
 * @param {Object} userInfo - 用户信息
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkCreatePermission(salonType, userInfo) {
  const config = getSalonConfig(salonType);
  if (!config) {
    return { allowed: false, reason: '沙龙类型不存在' };
  }
  
  const { permissions } = config;
  
  // 检查是否为管理员
  if (permissions.whoCanCreate.includes('admin') && userInfo.isAdmin) {
    return { allowed: true, reason: '' };
  }
  
  // 检查推荐官身份
  if (permissions.whoCanCreate.includes('matchmaker') && !userInfo.isMatchmaker) {
    return { allowed: false, reason: '该沙龙仅限推荐官创建' };
  }
  
  // 检查性别限制
  if (salonType === SALON_TYPES.MALE_SALON) {
    if (userInfo.gender !== 'male') {
      return { allowed: false, reason: '男推荐官沙龙仅限男性推荐官创建' };
    }
  }
  
  if (salonType === SALON_TYPES.FEMALE_SALON) {
    if (userInfo.gender !== 'female') {
      return { allowed: false, reason: '女推荐官沙龙仅限女性推荐官创建' };
    }
  }
  
  return { allowed: true, reason: '' };
}

// ============================================
// 配置管理（从后端读取）
// ============================================

/**
 * 从后端获取沙龙配置（异步）
 * @returns {Promise<object>} 配置对象
 */
async function fetchSalonConfigsFromServer() {
  try {
    const { request } = require('./request');
    const API = require('./api');
    
    const result = await request({
      url: `${API.BASE_URL}/admin/salon-configs`,
      method: 'GET',
    });
    
    if (result && Array.isArray(result)) {
      // 更新本地配置
      const newConfig = {};
      result.forEach(config => {
        // 将后端配置转换为前端格式
        newConfig[config.type] = {
          type: config.type,
          name: config.name,
          shortName: config.name,
          description: config.description,
          theme: config.theme,
          page: config.page,
          features: config.features,
          registration: config.registration,
          grouping: {
            strategy: 'none',
            groupSize: 0,
            maleCount: 0,
            femaleCount: 0,
          },
          permissions: config.permissions,
          serviceGuarantee: [],
          earnings: config.commission,
          api: config.api,
        };
      });
      
      // 保存到本地存储
      wx.setStorageSync('salon_configs', newConfig);
      
      // 更新内存中的配置
      Object.assign(SALON_TYPE_CONFIG, newConfig);
      
      console.log('[salon-config] 从后端获取配置成功');
      return newConfig;
    }
  } catch (error) {
    console.error('[salon-config] 从后端获取配置失败:', error);
    // 如果获取失败，使用本地存储的配置
    const cachedConfig = wx.getStorageSync('salon_configs');
    if (cachedConfig) {
      Object.assign(SALON_TYPE_CONFIG, cachedConfig);
      console.log('[salon-config] 使用本地缓存配置');
    }
  }
  
  return SALON_TYPE_CONFIG;
}

/**
 * 初始化沙龙配置（小程序启动时调用）
 * 优先使用本地缓存，然后异步更新
 */
async function initSalonConfig() {
  console.log('[salon-config] 初始化沙龙配置...');
  
  // 1. 先使用本地存储的配置
  const cachedConfig = wx.getStorageSync('salon_configs');
  if (cachedConfig) {
    Object.assign(SALON_TYPE_CONFIG, cachedConfig);
    console.log('[salon-config] 已加载本地缓存配置');
  }
  
  // 2. 异步从后端获取最新配置
  try {
    await fetchSalonConfigsFromServer();
  } catch (error) {
    console.error('[salon-config] 初始化时获取配置失败:', error);
  }
}

// ============================================
// 导出
// ============================================
module.exports = {
  SALON_TYPES,
  SALON_TYPE_CONFIG,
  getSalonConfig,
  getAllSalonConfigs,
  getSalonTypeList,
  getSalonConfigByGridKey,
  checkJoinPermission,
  checkCreatePermission,
  fetchSalonConfigsFromServer,
  initSalonConfig,
};
