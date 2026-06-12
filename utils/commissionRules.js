// utils/commissionRules.js - 佣金规则配置文件
// 统一管理所有身份的分润规则
// 按分润规则表 v5 更新（2026-04-25）
// v5.1 更新（2026-04-26）：
//   - 联创推荐官获得推荐社区服务站专属权限（唯一有资格推荐的身份）
//   - 新增沉淀资金10%双向分配：联创推荐官推荐社区服务站后，双方各享受该服务站沉淀资金10%
//   - 社区服务站原20%调整为：自身10% + 推荐人（联创）10%（总额不变仍为20%）
//   - 若联创推荐官自荐（自己同时申请成为社区服务站），则自身独享20%（推荐人即自己）
//   - 申请社区服务站须具备联创推荐官身份或由联创推荐官推荐，无例外情况

// v5.2 更新（动态配置）：
//   - 从 /api/config/public-map 动态读取配置，支持配置变更实时生效

// ======================================================
// 动态配置管理
// ======================================================
const { request } = require('./request');

// 动态配置缓存
let _configCache = null;
let _configLoading = null;

/**
 * 从后端API获取公开配置
 * @returns {Promise<Object>} 配置对象
 */
async function fetchPublicConfig() {
  // 如果已有缓存，直接返回
  if (_configCache) {
    return _configCache;
  }

  // 如果正在加载，等待加载完成
  if (_configLoading) {
    return _configLoading;
  }

  // 发起请求
  _configLoading = request({
    url: '/v1/config/public-map',
    method: 'GET',
    withToken: false,  // 公开接口，无需认证
    timeout: 5000,
  })
    .then((data) => {
      _configCache = data || {};
      return _configCache;
    })
    .catch((err) => {
      console.error('[commissionRules] 加载配置失败，使用默认值:', err);
      _configLoading = null;
      return null;
    });

  return _configLoading;
}

/**
 * 获取配置值，支持默认值
 * @param {string} key - 配置键名
 * @param {any} defaultValue - 默认值
 * @returns {Promise<any>}
 */
async function getConfig(key, defaultValue) {
  const config = await fetchPublicConfig();
  if (config === null) {
    return defaultValue;
  }
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * 清除配置缓存（强制重新加载）
 */
function clearConfigCache() {
  _configCache = null;
  _configLoading = null;
}

// ======================================================
// 所有身份类型
// ======================================================
const USER_ROLES = {
  USER: 'user',                    // 普通用户
  PUBLIC_MATCHMAKER: 'public_matchmaker',      // 公益推荐官
  PARTNER_MATCHMAKER: 'partner_matchmaker',    // 联创推荐官
  CITY_FRANCHISEE: 'city_franchisee',          // 城市合伙人
  PROFESSIONAL_RECOMMENDER: 'professional_recommender',  // 专业推荐官
  COMMUNITY_STATION: 'community_station',        // 社区服务站（免费·审核制）
  // ONLINE_FRANCHISEE：与 CITY_FRANCHISEE 同值，前端本地角色标记（无后端对应）
  ONLINE_FRANCHISEE: 'city_franchisee',
};

// ======================================================
// 费用标准默认值（元）- 会被后端配置覆盖
// ======================================================
const FEES_DEFAULT = {
  SINGLE_REGISTRATION: 199,                    // 会员建档费（统一199元）
  PARTNER_MATCHMAKER_JOIN: 399,                // 联创推荐官入驻费（399元）
  CITY_FRANCHISEE_JOIN: 10000,                 // 城市合伙人加盟费（一次性10000元，正价）
  PROFESSIONAL_RECOMMENDER_UPGRADE: 3999,      // 专业推荐官升级培训费（3999元）
};

// 沙龙费用默认值
const SALON_FEES_DEFAULT = {
  SALON_TICKET_PROMO: 299,   // 小程序上线第一年优惠价（元/人）
  SALON_TICKET_REGULAR: 399, // 第二年起恢复原价（元/人）
  // HOST_REVENUE_PROMO: 动态计算 = SALON_TICKET_PROMO - PARTNER_SALON_SUBSIDY
  // HOST_REVENUE_REGULAR: 动态计算 = SALON_TICKET_REGULAR - PLATFORM_FEE_REGULAR - PARTNER_SALON_SUBSIDY
  PLATFORM_FEE_REGULAR: 100, // 第二年起平台留存服务费100元/人
  PARTNER_SALON_SUBSIDY: 99, // 联创推荐官名下会员每参加一次沙龙，联创推荐官得99元
};

// 沉淀资金分配比例默认值
const PLATFORM_FUND_SHARE_DEFAULT = {
  CITY_FRANCHISEE_RATE: 0.70,    // 城市合伙人：加盟区域平台沉淀资金70%
  COMMUNITY_STATION_RATE: 0.10,  // 社区服务站：本社区关联业务平台沉淀资金10%（v5.1调整）
  COMMUNITY_STATION_REFERRER_RATE: 0.10, // 联创推荐官推荐社区服务站后永久享受10%沉淀资金（v5.1新增）
  PROFESSIONAL_RECOMMENDER_RATE: 0.03,  // 专业推荐官：推荐城市合伙人永久3%沉淀资金分红
};

// 平台分润规则默认值
const PLATFORM_RULES_DEFAULT = {
  WITHDRAWAL_FEE_RATE: 0.13,             // 公益/联创/专业推荐官提现扣除13%平台服务费
  COMMUNITY_STATION_WITHDRAWAL_FEE: 0.13, // 社区服务站提现扣除13%平台服务费
  FRANCHISEE_WITHDRAWAL_FEE_RATE: 0.70,  // 城市合伙人沉淀资金分配（合伙人70%）
};

// ======================================================
// 动态获取费用配置
// ======================================================
let _feesCache = null;

async function getFees() {
  if (_feesCache) {
    return _feesCache;
  }

  const config = await fetchPublicConfig();
  if (!config) {
    return FEES_DEFAULT;
  }

  _feesCache = {
    SINGLE_REGISTRATION: parseFloat(config.archive_fee) || FEES_DEFAULT.SINGLE_REGISTRATION,
    PARTNER_MATCHMAKER_JOIN: parseFloat(config.partner_matchmaker_join_fee) || FEES_DEFAULT.PARTNER_MATCHMAKER_JOIN,
    CITY_FRANCHISEE_JOIN: parseFloat(config.city_franchisee_join_fee) || FEES_DEFAULT.CITY_FRANCHISEE_JOIN,
    PROFESSIONAL_RECOMMENDER_UPGRADE: parseFloat(config.professional_recommender_upgrade_fee) || FEES_DEFAULT.PROFESSIONAL_RECOMMENDER_UPGRADE,
  };

  return _feesCache;
}

// 同步获取费用（使用缓存值，用于不需要async的地方）
function getFeesSync() {
  if (_feesCache) {
    return _feesCache;
  }
  return FEES_DEFAULT;
}

// ======================================================
// 动态获取沙龙费用配置
// ======================================================
let _salonFeesCache = null;

async function getSalonFees() {
  if (_salonFeesCache) {
    return _salonFeesCache;
  }

  const config = await fetchPublicConfig();
  if (!config) {
    // 默认配置：动态计算主办方收益
    const defaultFees = { ...SALON_FEES_DEFAULT };
    defaultFees.HOST_REVENUE_PROMO = defaultFees.SALON_TICKET_PROMO - defaultFees.PARTNER_SALON_SUBSIDY;
    defaultFees.HOST_REVENUE_REGULAR = defaultFees.SALON_TICKET_REGULAR - defaultFees.PLATFORM_FEE_REGULAR - defaultFees.PARTNER_SALON_SUBSIDY;
    return defaultFees;
  }

  const salonFees = {
    SALON_TICKET_PROMO: parseFloat(config.salon_ticket_promo) || SALON_FEES_DEFAULT.SALON_TICKET_PROMO,
    SALON_TICKET_REGULAR: parseFloat(config.salon_ticket_regular) || SALON_FEES_DEFAULT.SALON_TICKET_REGULAR,
    PLATFORM_FEE_REGULAR: parseFloat(config.salon_platform_fee_regular) || SALON_FEES_DEFAULT.PLATFORM_FEE_REGULAR,
    PARTNER_SALON_SUBSIDY: parseFloat(config.partner_salon_subsidy) || SALON_FEES_DEFAULT.PARTNER_SALON_SUBSIDY,
  };
  
  // 动态计算主办方收益
  salonFees.HOST_REVENUE_PROMO = salonFees.SALON_TICKET_PROMO - salonFees.PARTNER_SALON_SUBSIDY;
  salonFees.HOST_REVENUE_REGULAR = salonFees.SALON_TICKET_REGULAR - salonFees.PLATFORM_FEE_REGULAR - salonFees.PARTNER_SALON_SUBSIDY;
  
  _salonFeesCache = salonFees;
  return _salonFeesCache;
}

// 同步获取沙龙费用
function getSalonFeesSync() {
  if (_salonFeesCache) {
    return _salonFeesCache;
  }
  
  // 同步版本：动态计算主办方收益
  const fees = { ...SALON_FEES_DEFAULT };
  fees.HOST_REVENUE_PROMO = fees.SALON_TICKET_PROMO - fees.PARTNER_SALON_SUBSIDY;
  fees.HOST_REVENUE_REGULAR = fees.SALON_TICKET_REGULAR - fees.PLATFORM_FEE_REGULAR - fees.PARTNER_SALON_SUBSIDY;
  
  return fees;
}

// ======================================================
// 动态获取沉淀资金分配比例
// ======================================================
let _platformFundShareCache = null;

async function getPlatformFundShare() {
  if (_platformFundShareCache) {
    return _platformFundShareCache;
  }

  const config = await fetchPublicConfig();
  if (!config) {
    return PLATFORM_FUND_SHARE_DEFAULT;
  }

  _platformFundShareCache = {
    CITY_FRANCHISEE_RATE: parseFloat(config.city_franchisee_withdrawal_rate) || PLATFORM_FUND_SHARE_DEFAULT.CITY_FRANCHISEE_RATE,
    COMMUNITY_STATION_RATE: parseFloat(config.community_station_fund_rate) || PLATFORM_FUND_SHARE_DEFAULT.COMMUNITY_STATION_RATE,
    COMMUNITY_STATION_REFERRER_RATE: parseFloat(config.community_station_referrer_fund_rate) || PLATFORM_FUND_SHARE_DEFAULT.COMMUNITY_STATION_REFERRER_RATE,
    PROFESSIONAL_RECOMMENDER_RATE: parseFloat(config.professional_recommender_fund_rate) || PLATFORM_FUND_SHARE_DEFAULT.PROFESSIONAL_RECOMMENDER_RATE,
  };

  return _platformFundShareCache;
}

// 同步获取沉淀资金分配
function getPlatformFundShareSync() {
  if (_platformFundShareCache) {
    return _platformFundShareCache;
  }
  return PLATFORM_FUND_SHARE_DEFAULT;
}

// ======================================================
// 动态获取平台分润规则
// ======================================================
let _platformRulesCache = null;

async function getPlatformRules() {
  if (_platformRulesCache) {
    return _platformRulesCache;
  }

  const config = await fetchPublicConfig();
  if (!config) {
    return PLATFORM_RULES_DEFAULT;
  }

  _platformRulesCache = {
    WITHDRAWAL_FEE_RATE: parseFloat(config.platform_withdraw_fee_rate) || PLATFORM_RULES_DEFAULT.WITHDRAWAL_FEE_RATE,
    COMMUNITY_STATION_WITHDRAWAL_FEE: parseFloat(config.community_station_withdrawal_fee_rate) || PLATFORM_RULES_DEFAULT.COMMUNITY_STATION_WITHDRAWAL_FEE,
    FRANCHISEE_WITHDRAWAL_FEE_RATE: parseFloat(config.platform_withdraw_fee_rate) || PLATFORM_RULES_DEFAULT.FRANCHISEE_WITHDRAWAL_FEE_RATE,
  };

  return _platformRulesCache;
}

// 同步获取平台规则
function getPlatformRulesSync() {
  if (_platformRulesCache) {
    return _platformRulesCache;
  }
  return PLATFORM_RULES_DEFAULT;
}

// ======================================================
// 各身份收益规则（动态版本）
// ======================================================

/**
 * 获取指定身份的收益规则（异步版本，会合并动态配置）
 * @param {string} role - 身份类型
 * @returns {Promise<Object|null>}
 */
async function getCommissionRulesAsync(role) {
  const fees = await getFees();
  const salonFees = await getSalonFees();
  const platformFundShare = await getPlatformFundShare();

  // 基础规则模板
  const baseRules = {
    // ===== 公益推荐官 =====
    [USER_ROLES.PUBLIC_MATCHMAKER]: {
      name: '公益推荐官',
      description: '免费注册，推荐会员建档每人得99元',
      entryFee: 0,
      entryFrom: 'navigation',
      canUpgradeTo: [
        USER_ROLES.PARTNER_MATCHMAKER,
        USER_ROLES.PROFESSIONAL_RECOMMENDER,
        USER_ROLES.CITY_FRANCHISEE,
      ],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐1人做${fees.SINGLE_REGISTRATION}元会员建档，推荐人得99元/人（无首推限制）`,
        },
      },
    },

    // ===== 社区服务站 =====
    [USER_ROLES.COMMUNITY_STATION]: {
      name: '社区服务站',
      description: '免费入驻·审核制·深耕本地社区，提现扣13%，享本社区关联业务沉淀资金10%',
      entryFee: 0,
      entryFrom: 'grid',
      referredBy: [USER_ROLES.PARTNER_MATCHMAKER],
      canUpgradeTo: [
        USER_ROLES.PROFESSIONAL_RECOMMENDER,
        USER_ROLES.CITY_FRANCHISEE,
      ],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        PLATFORM_FUND_SHARE: {
          rate: platformFundShare.COMMUNITY_STATION_RATE,
          selfReferralRate: platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE,
          description: `本社区关联业务平台沉淀资金${platformFundShare.COMMUNITY_STATION_RATE * 100}%（推荐人联创推荐官同享${platformFundShare.COMMUNITY_STATION_REFERRER_RATE * 100}%；联创推荐官自荐时独享${(platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE) * 100}%）`,
        },
      },
      withdrawalFeeRate: 0.13, // 固定13%
    },

    // ===== 联创推荐官 =====
    [USER_ROLES.PARTNER_MATCHMAKER]: {
      name: '联创推荐官',
      description: `缴纳${fees.PARTNER_MATCHMAKER_JOIN}元联创基金，享有推荐收益+沙龙补贴+直推联创收益+推荐社区服务站专属权益`,
      entryFee: fees.PARTNER_MATCHMAKER_JOIN,
      entryFrom: 'navigation',
      canUpgradeTo: [
        USER_ROLES.PROFESSIONAL_RECOMMENDER,
        USER_ROLES.CITY_FRANCHISEE,
      ],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        SALON_SUBSIDY: {
          commission: salonFees.PARTNER_SALON_SUBSIDY,
          description: `名下会员每参加一次沙龙，联创推荐官得${salonFees.PARTNER_SALON_SUBSIDY}元/次（永久、每次）`,
        },
        COMMUNITY_STATION_REFERRAL: {
          description: '推荐社区服务站入驻（联创推荐官专属资格），永久享受所推荐服务站本社区沉淀资金10%',
          ongoingDividendRate: platformFundShare.COMMUNITY_STATION_REFERRER_RATE,
          note: `社区服务站本身同享${platformFundShare.COMMUNITY_STATION_RATE * 100}%，双方合计占该服务站沉淀资金${(platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE) * 100}%`,
        },
      },
    },

    // ===== 专业推荐官 =====
    [USER_ROLES.PROFESSIONAL_RECOMMENDER]: {
      name: '专业推荐官',
      description: `升级培训费${fees.PROFESSIONAL_RECOMMENDER_UPGRADE}元，独家拥有推荐城市合伙人资格（${fees.CITY_FRANCHISEE_JOIN}元+${platformFundShare.PROFESSIONAL_RECOMMENDER_RATE * 100}%沉淀分红）`,
      entryFee: fees.PROFESSIONAL_RECOMMENDER_UPGRADE,
      entryFrom: 'navigation',
      upgradeFrom: [
        USER_ROLES.PUBLIC_MATCHMAKER,
        USER_ROLES.PARTNER_MATCHMAKER,
        USER_ROLES.COMMUNITY_STATION,
        USER_ROLES.CITY_FRANCHISEE,
      ],
      canUpgradeTo: [
        USER_ROLES.CITY_FRANCHISEE,
      ],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        CITY_FRANCHISEE_REFERRAL: {
          fee: fees.CITY_FRANCHISEE_JOIN,
          firstCommission: 0,
          commission: fees.CITY_FRANCHISEE_JOIN,
          ongoingDividendRate: platformFundShare.PROFESSIONAL_RECOMMENDER_RATE,
          description: `推荐城市合伙人：第1个无收益，第2个起全额${fees.CITY_FRANCHISEE_JOIN}元+永久${platformFundShare.PROFESSIONAL_RECOMMENDER_RATE * 100}%沉淀资金分红（独家推荐权）`,
        },
      },
    },

    // ===== 城市合伙人 =====
    [USER_ROLES.CITY_FRANCHISEE]: {
      name: '城市合伙人',
      description: `一次性${fees.CITY_FRANCHISEE_JOIN}元加盟，可承办沙龙，享本区域沉淀资金${platformFundShare.CITY_FRANCHISEE_RATE * 100}%（提现直接拿净额）`,
      entryFee: fees.CITY_FRANCHISEE_JOIN,
      entryFrom: 'grid',
      upgradeFrom: [
        USER_ROLES.PARTNER_MATCHMAKER,
        USER_ROLES.PROFESSIONAL_RECOMMENDER,
      ],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        SALON_ORGANIZATION_PROMO: {
          ticketPrice: salonFees.SALON_TICKET_PROMO,
          hostRevenue: salonFees.HOST_REVENUE_PROMO,
          description: `优惠价${salonFees.SALON_TICKET_PROMO}元期间：主办方每场每人到手${salonFees.HOST_REVENUE_PROMO}元（联创补贴${salonFees.PARTNER_SALON_SUBSIDY}元已扣除）`,
        },
        SALON_ORGANIZATION_REGULAR: {
          ticketPrice: salonFees.SALON_TICKET_REGULAR,
          hostRevenue: salonFees.HOST_REVENUE_REGULAR,
          platformFee: salonFees.PLATFORM_FEE_REGULAR,
          description: `正价${salonFees.SALON_TICKET_REGULAR}元期间：平台服务费${salonFees.PLATFORM_FEE_REGULAR}元，主办方每场每人到手${salonFees.HOST_REVENUE_REGULAR}元（联创补贴${salonFees.PARTNER_SALON_SUBSIDY}元已扣除）`,
        },
        PLATFORM_FUND_SHARE: {
          rate: platformFundShare.CITY_FRANCHISEE_RATE,
          description: `加盟区域平台沉淀资金${platformFundShare.CITY_FRANCHISEE_RATE * 100}%`,
        },
      },
      withdrawalFeeRate: 0,
      fundAllocationRate: platformFundShare.CITY_FRANCHISEE_RATE,
    },
  };

  return baseRules[role] || null;
}

// ======================================================
// 提现手续费计算
// ======================================================

/**
 * 计算提现手续费（异步版本，调用后端API，失败时降级为本地计算）
 * @param {string} role - 身份类型
 * @param {number} amount - 提现金额
 * @returns {Promise<Object>}
 */
async function calculateWithdrawalFeeAsync(role, amount) {
  // 优先调用后端API，以后端计算结果为唯一可信源
  try {
    const res = await request({
      url: '/commission/withdrawal-fee',
      method: 'GET',
      data: { amount },
    });
    if (res && res.code === 200 && res.data) {
      return res.data; // { fee, netAmount, rate, description }
    }
  } catch (err) {
    console.warn('[commissionRules] 后端手续费计算失败，降级为本地计算:', err.message);
  }

  // 降级：本地计算（规则应与后端 commissionService.ts 保持一致）
  const platformFundShare = await getPlatformFundShare();
  const platformRules = await getPlatformRules();

  if (role === USER_ROLES.CITY_FRANCHISEE) {
    const fundRate = platformFundShare.CITY_FRANCHISEE_RATE;
    return {
      fee: 0,
      netAmount: amount,
      fundRate: fundRate,
      description: `沉淀资金分成：合伙人${fundRate * 100}% · 平台${(1 - fundRate) * 100}%（已为净额，无额外扣费）`,
    };
  }
  if (role === USER_ROLES.COMMUNITY_STATION) {
    const rate = platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE;
    return {
      fee: amount * rate,
      netAmount: amount * (1 - rate),
      rate: rate,
      description: `提现扣除${rate * 100}%平台服务费`,
    };
  }
  // 其他所有身份（普通推荐、公益、联创、专业推荐官）统一扣固定比例
  const rate = platformRules.WITHDRAWAL_FEE_RATE;
  return {
    fee: amount * rate,
    netAmount: amount * (1 - rate),
    rate: rate,
    description: `提现扣除${rate * 100}%平台服务费`,
  };
}

/**
 * 计算提现手续费（同步版本，已废弃）
 * @deprecated 请使用 calculateWithdrawalFeeAsync（调用后端API）
 * 保留此方法仅作为后端不可用时的降级方案
 */
function calculateWithdrawalFee(role, amount) {
  const platformFundShare = getPlatformFundShareSync();
  const platformRules = getPlatformRulesSync();

  if (role === USER_ROLES.CITY_FRANCHISEE) {
    const fundRate = platformFundShare.CITY_FRANCHISEE_RATE;
    return {
      fee: 0,
      netAmount: amount,
      fundRate: fundRate,
      description: `沉淀资金分成：合伙人${fundRate * 100}% · 平台${(1 - fundRate) * 100}%（已为净额，无额外扣费）`,
    };
  }
  if (role === USER_ROLES.COMMUNITY_STATION) {
    const rate = platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE;
    return {
      fee: amount * rate,
      netAmount: amount * (1 - rate),
      rate: rate,
      description: `提现扣除${rate * 100}%平台服务费`,
    };
  }
  const rate = platformRules.WITHDRAWAL_FEE_RATE;
  return {
    fee: amount * rate,
    netAmount: amount * (1 - rate),
    rate: rate,
    description: `提现扣除${rate * 100}%平台服务费`,
  };
}

// ======================================================
// 获取指定身份的收益规则（同步版本，使用默认配置）
// ======================================================
function getCommissionRules(role) {
  // 同步版本使用默认配置
  const fees = getFeesSync();
  const salonFees = getSalonFeesSync();
  const platformFundShare = getPlatformFundShareSync();

  return buildRulesFromFees(fees, salonFees, platformFundShare)[role] || null;
}

/**
 * 根据费用配置构建规则
 */
function buildRulesFromFees(fees, salonFees, platformFundShare) {
  return {
    [USER_ROLES.PUBLIC_MATCHMAKER]: {
      name: '公益推荐官',
      description: '免费注册，推荐会员建档每人得99元',
      entryFee: 0,
      entryFrom: 'navigation',
      canUpgradeTo: [USER_ROLES.PARTNER_MATCHMAKER, USER_ROLES.PROFESSIONAL_RECOMMENDER, USER_ROLES.CITY_FRANCHISEE],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐1人做${fees.SINGLE_REGISTRATION}元会员建档，推荐人得99元/人（无首推限制）`,
        },
      },
    },

    [USER_ROLES.COMMUNITY_STATION]: {
      name: '社区服务站',
      description: '免费入驻·审核制·深耕本地社区，提现扣13%，享本社区关联业务沉淀资金10%',
      entryFee: 0,
      entryFrom: 'grid',
      referredBy: [USER_ROLES.PARTNER_MATCHMAKER],
      canUpgradeTo: [USER_ROLES.PROFESSIONAL_RECOMMENDER, USER_ROLES.CITY_FRANCHISEE],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        PLATFORM_FUND_SHARE: {
          rate: platformFundShare.COMMUNITY_STATION_RATE,
          selfReferralRate: platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE,
          description: `本社区关联业务平台沉淀资金${platformFundShare.COMMUNITY_STATION_RATE * 100}%（推荐人联创推荐官同享${platformFundShare.COMMUNITY_STATION_REFERRER_RATE * 100}%；联创推荐官自荐时独享${(platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE) * 100}%）`,
        },
      },
      withdrawalFeeRate: 0.13,
    },

    [USER_ROLES.PARTNER_MATCHMAKER]: {
      name: '联创推荐官',
      description: `缴纳${fees.PARTNER_MATCHMAKER_JOIN}元联创基金，享有推荐收益+沙龙补贴+直推联创收益+推荐社区服务站专属权益`,
      entryFee: fees.PARTNER_MATCHMAKER_JOIN,
      entryFrom: 'navigation',
      canUpgradeTo: [USER_ROLES.PROFESSIONAL_RECOMMENDER, USER_ROLES.CITY_FRANCHISEE],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        SALON_SUBSIDY: {
          commission: salonFees.PARTNER_SALON_SUBSIDY,
          description: `名下会员每参加一次沙龙，联创推荐官得${salonFees.PARTNER_SALON_SUBSIDY}元/次（永久、每次）`,
        },
        COMMUNITY_STATION_REFERRAL: {
          description: '推荐社区服务站入驻（联创推荐官专属资格），永久享受所推荐服务站本社区沉淀资金10%',
          ongoingDividendRate: platformFundShare.COMMUNITY_STATION_REFERRER_RATE,
          note: `社区服务站本身同享${platformFundShare.COMMUNITY_STATION_RATE * 100}%，双方合计占该服务站沉淀资金${(platformFundShare.COMMUNITY_STATION_RATE + platformFundShare.COMMUNITY_STATION_REFERRER_RATE) * 100}%`,
        },
      },
    },

    [USER_ROLES.PROFESSIONAL_RECOMMENDER]: {
      name: '专业推荐官',
      description: `升级培训费${fees.PROFESSIONAL_RECOMMENDER_UPGRADE}元，独家拥有推荐城市合伙人资格（${fees.CITY_FRANCHISEE_JOIN}元+${platformFundShare.PROFESSIONAL_RECOMMENDER_RATE * 100}%沉淀分红）`,
      entryFee: fees.PROFESSIONAL_RECOMMENDER_UPGRADE,
      entryFrom: 'navigation',
      upgradeFrom: [USER_ROLES.PUBLIC_MATCHMAKER, USER_ROLES.PARTNER_MATCHMAKER, USER_ROLES.COMMUNITY_STATION, USER_ROLES.CITY_FRANCHISEE],
      canUpgradeTo: [USER_ROLES.CITY_FRANCHISEE],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        CITY_FRANCHISEE_REFERRAL: {
          fee: fees.CITY_FRANCHISEE_JOIN,
          firstCommission: 0,
          commission: fees.CITY_FRANCHISEE_JOIN,
          ongoingDividendRate: platformFundShare.PROFESSIONAL_RECOMMENDER_RATE,
          description: `推荐城市合伙人：第1个无收益，第2个起全额${fees.CITY_FRANCHISEE_JOIN}元+永久${platformFundShare.PROFESSIONAL_RECOMMENDER_RATE * 100}%沉淀资金分红（独家推荐权）`,
        },
      },
    },

    [USER_ROLES.CITY_FRANCHISEE]: {
      name: '城市合伙人',
      description: `一次性${fees.CITY_FRANCHISEE_JOIN}元加盟，可承办沙龙，享本区域沉淀资金${platformFundShare.CITY_FRANCHISEE_RATE * 100}%（提现直接拿净额）`,
      entryFee: fees.CITY_FRANCHISEE_JOIN,
      entryFrom: 'grid',
      upgradeFrom: [USER_ROLES.PARTNER_MATCHMAKER, USER_ROLES.PROFESSIONAL_RECOMMENDER],
      commissions: {
        SINGLE_REGISTRATION: {
          fee: fees.SINGLE_REGISTRATION,
          commission: 99,
          platformRevenue: fees.SINGLE_REGISTRATION - 99,
          description: `推荐会员建档${fees.SINGLE_REGISTRATION}元，推荐人得99元/人`,
        },
        PARTNER_MATCHMAKER_REFERRAL: {
          fee: fees.PARTNER_MATCHMAKER_JOIN,
          firstCommission: 0,
          commission: fees.PARTNER_MATCHMAKER_JOIN,
          description: `推荐联创推荐官：第1个无收益，第2个起${fees.PARTNER_MATCHMAKER_JOIN}元/人`,
        },
        SALON_ORGANIZATION_PROMO: {
          ticketPrice: salonFees.SALON_TICKET_PROMO,
          hostRevenue: salonFees.HOST_REVENUE_PROMO,
          description: `优惠价${salonFees.SALON_TICKET_PROMO}元期间：主办方每场每人到手${salonFees.HOST_REVENUE_PROMO}元（联创补贴${salonFees.PARTNER_SALON_SUBSIDY}元已扣除）`,
        },
        SALON_ORGANIZATION_REGULAR: {
          ticketPrice: salonFees.SALON_TICKET_REGULAR,
          hostRevenue: salonFees.HOST_REVENUE_REGULAR,
          platformFee: salonFees.PLATFORM_FEE_REGULAR,
          description: `正价${salonFees.SALON_TICKET_REGULAR}元期间：平台服务费${salonFees.PLATFORM_FEE_REGULAR}元，主办方每场每人到手${salonFees.HOST_REVENUE_REGULAR}元（联创补贴${salonFees.PARTNER_SALON_SUBSIDY}元已扣除）`,
        },
        PLATFORM_FUND_SHARE: {
          rate: platformFundShare.CITY_FRANCHISEE_RATE,
          description: `加盟区域平台沉淀资金${platformFundShare.CITY_FRANCHISEE_RATE * 100}%`,
        },
      },
      withdrawalFeeRate: 0,
      fundAllocationRate: platformFundShare.CITY_FRANCHISEE_RATE,
    },
  };
}

// ======================================================
// 计算特定业务的收益
// ======================================================
function calculateCommission(role, businessType, isFirstRecommendation = false, amount = 0) {
  const rules = getCommissionRules(role);
  if (!rules) return 0;
  const commissionRule = rules.commissions[businessType];
  if (!commissionRule) return 0;

  if (isFirstRecommendation && commissionRule.firstCommission !== undefined) {
    return commissionRule.firstCommission;
  }
  if (commissionRule.commission !== undefined) {
    return commissionRule.commission;
  }
  return 0;
}

// ======================================================
// 获取可升级的身份列表
// ======================================================
function getUpgradableRoles(currentRole) {
  const rules = getCommissionRules(currentRole);
  return rules ? (rules.canUpgradeTo || []) : [];
}

// ======================================================
// 判断是否可以升级到专业推荐官
// ======================================================
function canUpgradeToProfessionalRecommender(currentRole) {
  const rules = getCommissionRules(USER_ROLES.PROFESSIONAL_RECOMMENDER);
  return rules && rules.upgradeFrom && rules.upgradeFrom.includes(currentRole);
}

// ======================================================
// 获取身份入驻/升级费用
// ======================================================
function getUpgradeFee(fromRole, toRole) {
  const fees = getFeesSync();

  if (toRole === USER_ROLES.CITY_FRANCHISEE) {
    return fees.CITY_FRANCHISEE_JOIN;
  }
  if (toRole === USER_ROLES.PROFESSIONAL_RECOMMENDER) {
    return fees.PROFESSIONAL_RECOMMENDER_UPGRADE;
  }
  if (toRole === USER_ROLES.PARTNER_MATCHMAKER) {
    return fees.PARTNER_MATCHMAKER_JOIN;
  }
  if (toRole === USER_ROLES.COMMUNITY_STATION) {
    return 0;
  }
  return 0;
}

// ======================================================
// 获取入驻入口
// ======================================================
function getEntryFrom(role) {
  const rules = getCommissionRules(role);
  return rules ? rules.entryFrom : null;
}

// ======================================================
// 获取沙龙票价（根据是否优惠期）
// ======================================================
function getSalonTicketPrice(isPromoPhase = true) {
  const salonFees = getSalonFeesSync();
  return isPromoPhase ? salonFees.SALON_TICKET_PROMO : salonFees.SALON_TICKET_REGULAR;
}

// ======================================================
// 获取沙龙主办方实际到手收益
// ======================================================
function getSalonHostRevenue(isPromoPhase = true) {
  const salonFees = getSalonFeesSync();
  return isPromoPhase ? salonFees.HOST_REVENUE_PROMO : salonFees.HOST_REVENUE_REGULAR;
}

// ======================================================
// 预加载配置（在App启动时调用）
// ======================================================
function preloadConfig() {
  console.log('[commissionRules] 开始预加载配置...');
  fetchPublicConfig()
    .then((config) => {
      console.log('[commissionRules] 配置预加载成功:', config);
    })
    .catch((err) => {
      console.error('[commissionRules] 配置预加载失败:', err);
    });
}

module.exports = {
  USER_ROLES,
  FEES: FEES_DEFAULT,
  SALON_FEES: SALON_FEES_DEFAULT,
  PLATFORM_FUND_SHARE: PLATFORM_FUND_SHARE_DEFAULT,
  PLATFORM_RULES: PLATFORM_RULES_DEFAULT,
  getCommissionRules,
  getCommissionRulesAsync,
  calculateCommission,
  calculateWithdrawalFee,
  calculateWithdrawalFeeAsync,
  getUpgradableRoles,
  canUpgradeToProfessionalRecommender,
  getUpgradeFee,
  getEntryFrom,
  getSalonTicketPrice,
  getSalonHostRevenue,
  getFees,
  getFeesSync,
  getSalonFees,
  getSalonFeesSync,
  getPlatformFundShare,
  getPlatformFundShareSync,
  getPlatformRules,
  getPlatformRulesSync,
  fetchPublicConfig,
  clearConfigCache,
  preloadConfig,
};
