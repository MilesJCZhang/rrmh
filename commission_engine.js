/**
 * 佣金计算引擎 - v5.1 分润规则实现
 *
 * 角色体系:
 * - user: 普通用户
 * - public_matchmaker: 公益推荐官 (免费注册)
 * - partner_matchmaker: 联创推荐官 (399元)
 * - professional_recommender: 专业推荐官 (3999元)
 * - city_franchisee: 城市合伙人 (10000元)
 * - community_station: 社区服务站 (需联创推荐, 审核制)
 *
 * 付款类型:
 * - single_registration: 199元 (会员建档)
 * - partner_matchmaker: 399元 (联创推荐官入驻)
 * - professional_recommender: 3999元 (专业推荐官入驻)
 * - city_franchisee: 10000元 (城市合伙人入驻)
 * - salon_attend: 沙龙参会费 (299/399元)
 *
 * 数据库: better-sqlite3 (同步 API)
 */

const { getDB } = require('./config');
const { REFERRER_ELIGIBLE_ROLES, CITY_REFERRER_ELIGIBLE_ROLES } = require('./constants/roles');
const logger = require('./utils/logger');

// ============================================
// 分润规则配置 (与前端 commissionRules.js 保持一致)
// ============================================

const COMMISSION_RULES = {
  // 会员建档 (199元)
  single_registration: {
    amount: 199,
    referrerRate: 0.5,           // 推荐人得 99元 (50%)
    platformRate: 0.5,           // 平台沉淀 100元 (50%)
  },

  // 联创推荐官入驻 (399元)
  partner_matchmaker: {
    amount: 399,
    fromSecondRate: true,        // 第2个起才有佣金
    referrerRate: 1.0,           // 推荐人得全部 399元
    platformRate: 0,             // 无平台沉淀
  },

  // 专业推荐官入驻 (3999元)
  professional_recommender: {
    amount: 3999,
    fromSecondRate: true,        // 第2个起才有佣金
    referrerRate: 1.0,           // 推荐人得全部 3999元
    platformRate: 0,             // 无平台沉淀
  },

  // 城市合伙人入驻 (10000元)
  city_franchisee: {
    amount: 10000,
    fromSecondRate: true,        // 第2个起才有佣金
    referrerRate: 1.0,           // 推荐人得全部 10000元
    platformRate: 0,             // 沉淀资金单独计算
    settlementRate: 0.03,        // 专业推荐官得沉淀资金的 3%
    cityPartnerRate: 0.70,       // 城市合伙人本区域沉淀 70%
  },

  // 线上解锁-优质会员 (199元)
  online_unlock_gold: {
    amount: 199,
    referrerFixed: 99,            // 联创红娘固定得99元
    platformRate: 0,              // 剩余归平台
    referrerRoleRequired: 'partner_matchmaker', // 仅联创红娘有佣金
  },

  // 线上解锁-良好会员 (299元)
  online_unlock_silver: {
    amount: 299,
    referrerFixed: 99,            // 联创红娘固定得99元
    platformRate: 0,              // 剩余归平台
    referrerRoleRequired: 'partner_matchmaker', // 仅联创红娘有佣金
  },

  // 沙龙参会费
  salon_attend: {
    organizerSubsidy: 99,         // 承办人(城市合伙人)补贴 99元/人
    referralSubsidy: 99,         // 推荐人(联创)补贴 99元/人 (沙龙补贴)
  },

  // 沙龙报名费 (399元, 新版)
  salon_signup: {
    amount: 399,
    referrerFixed: 99,            // 联创红娘推荐补贴 99元/人
    organizerFixed: 99,           // 城市合伙人承办补贴 99元/人
    referrerRoleRequired: 'partner_matchmaker',
    organizerRoleRequired: 'city_franchisee',
  },
};

// 可获得推荐建档佣金的角色（来自 constants/roles.js）
// REFERRER_ELIGIBLE_ROLES 已从集中定义导入

// 推荐城市合伙人有佣金的角色（来自 constants/roles.js）
// CITY_REFERRER_ELIGIBLE_ROLES 已从集中定义导入

// ============================================
// 核心函数
// ============================================

/**
 * 计算并记录佣金
 * @param {Object} params
 * @param {number} params.orderId - 订单ID
 * @param {number} params.payerId - 付款人ID
 * @param {string} params.payType - 付款类型
 * @param {number} params.totalAmount - 付款金额
 * @param {number} params.referrerId - 推荐人ID (可为NULL)
 * @param {Object} [externalDb] - 外部传入的数据库连接（用于事务），不传则使用全局连接
 */
function processCommission({ orderId, payerId, payType, totalAmount, referrerId }, externalDb = null) {
  const db = externalDb || getDB();

  const payer = getUser(db, payerId);
  const isSelfReferral = referrerId && referrerId === payerId;
  const referrer = referrerId ? getUser(db, referrerId) : null;

  const rule = COMMISSION_RULES[payType];
  if (!rule) {
    logger.debug(`[commission] Unknown payType: ${payType}`);
    return;
  }

  // 获取付款人的推荐人计数
  const refStats = getOrCreateReferralStats(db, payerId, referrerId);

  // 无条件创建/更新 referral_stats（不管有没有佣金）
  // 解决：第1个入驻无佣金 → 不创建记录 → 第2个永远查不到的死锁问题
  upsertReferralStats(db, payerId, referrerId, payType, 0);

  // 按付款类型分发
  switch (payType) {
    case 'single_registration':
      processRegistrationCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, refStats, rule
      });
      break;

    case 'partner_matchmaker':
      processPartnerCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, refStats, rule
      });
      break;

    case 'professional_recommender':
      processProfessionalCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, refStats, rule
      });
      break;

    case 'city_franchisee':
      processCityFranchiseeCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, refStats, rule
      });
      break;

    case 'online_unlock_gold':
    case 'online_unlock_silver':
      processOnlineUnlockCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, rule
      });
      break;

    case 'salon_signup':
      processSalonSignupCommission(db, {
        orderId, payerId, payType, totalAmount, referrerId, isSelfReferral,
        referrer, rule
      });
      break;

    default:
      logger.debug(`[commission] Not implemented for payType: ${payType}`);
  }
}

/**
 * 会员建档佣金
 * - 推荐人(公益/联创/社区): 99元
 * - 平台沉淀: 100元
 * - 自荐: 联创得20%沉淀，其他无推荐佣金
 */
function processRegistrationCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, rule } = params;

  // 推荐人佣金 (99元)
  if (referrerId && referrer && REFERRER_ELIGIBLE_ROLES.includes(referrer.role)) {
    const amount = rule.amount * rule.referrerRate;

    insertCommission(db, {
      orderId, payerId, payType, totalAmount,
      recipientId: referrerId,
      recipientRole: referrer.role,
      recipientType: 'referrer',
      amount,
      referrerId: referrerId,
      isSelfReferral: isSelfReferral ? 1 : 0,
      note: isSelfReferral ? '自荐建档' : '推荐建档'
    });

    // 更新推荐统计
    updateReferralStats(db, referrerId, payerId, 'registration', amount);
  }

  // 平台沉淀 (100元)
  const platformAmount = rule.amount * rule.platformRate;

  if (isSelfReferral && referrer && referrer.role === 'partner_matchmaker') {
    // 自荐 + 联创身份: 20%沉淀归联创 (本应是100%沉淀，但联创自荐得20%)
    const partnerShare = platformAmount * 0.2;  // 20元

    insertPlatformFund(db, {
      source: 'single_registration',
      orderId,
      amount: platformAmount,
      ownerType: 'platform',  // 先入平台
      note: `联创自荐沉淀资金`
    });

    // 联创得20%
    insertCommission(db, {
      orderId, payerId, payType, totalAmount,
      recipientId: referrerId,
      recipientRole: referrer.role,
      recipientType: 'self',
      amount: partnerShare,
      platformFee: platformAmount - partnerShare,
      referrerId: referrerId,
      isSelfReferral: 1,
      note: '联创自荐沉淀资金20%'
    });
  } else {
    // v5.1 新增：社区服务站沉淀资金分配
    // 查找会员的直接推荐链中是否有社区服务站
    let communityStationId = null;
    let partnerId = null;

    // 从 referral_stats 表查直接推荐人
    const refChain = db.prepare(
      'SELECT referrer_id FROM referral_stats WHERE user_id = ? LIMIT 1'
    ).get(payerId);

    if (refChain) {
      const directReferrerId = refChain.referrer_id;
      const directRefUser = db.prepare(
        'SELECT id, role, referrer_id FROM users WHERE id = ?'
      ).get(directReferrerId);

      if (directRefUser) {
        if (directRefUser.role === 'community_station') {
          communityStationId = directRefUser.id;
          partnerId = directRefUser.referrer_id || null;
        } else if (directRefUser.role === 'partner_matchmaker') {
          partnerId = directRefUser.id;
        }
      }
    }

    if (communityStationId) {
      // 场景A/B/C：社区服务站参与分配
      const communityShare = platformAmount * 0.10; // 10%
      const partnerShare = platformAmount * 0.10;   // 10%（推荐人联创）
      const platformShare = platformAmount - communityShare - partnerShare; // 80%

      // 社区服务站得 10%
      insertPlatformFund(db, {
        source: 'single_registration',
        orderId,
        amount: communityShare,
        ownerType: 'city_partner',
        ownerId: communityStationId,
        note: '社区服务站沉淀资金10%（v5.1）'
      });

      // 推荐人联创得 10%（若联创自荐则合并计算）
      if (partnerId && partnerId !== communityStationId) {
        insertPlatformFund(db, {
          source: 'single_registration',
          orderId,
          amount: partnerShare,
          ownerType: 'professional_partner',
          ownerId: partnerId,
          note: '推荐社区服务站沉淀资金10%（v5.1）'
        });
      }

      // 平台留 80%
      insertPlatformFund(db, {
        source: 'single_registration',
        orderId,
        amount: platformShare,
        ownerType: 'platform',
        note: '社区服务站关联业务沉淀（v5.1）'
      });
    } else {
      // 普通场景：全部归平台沉淀
      insertPlatformFund(db, {
        source: 'single_registration',
        orderId,
        amount: platformAmount,
        ownerType: 'platform',
        note: null
      });
    }
  }
}

/**
 * 联创推荐官入驻佣金
 * - 第2个起: 推荐人(联创)得 399元
 * - 沉淀资金 (用于社区服务站推荐分红)
 */
function processPartnerCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, refStats, rule } = params;

  if (!referrerId) return;

  // 第2个起才有佣金
  const partnerCount = refStats.partner_count || 0;

  if (partnerCount >= 1) {
    // 推荐人佣金 (第2个起)
    if (referrer && referrer.role === 'partner_matchmaker') {
      const amount = rule.amount;

      insertCommission(db, {
        orderId, payerId, payType, totalAmount,
        recipientId: referrerId,
        recipientRole: referrer.role,
        recipientType: referrerId === payerId ? 'self' : 'referrer',
        amount,
        referrerId: referrerId,
        isSelfReferral: isSelfReferral ? 1 : 0,
        note: isSelfReferral ? '自荐联创(第2个起)' : `推荐联创(第${partnerCount + 1}个)`
      });

      // 更新推荐统计
      updateReferralStats(db, referrerId, payerId, 'partner', amount);
    }
  }
}

/**
 * 专业推荐官入驻佣金
 * - 第2个起: 推荐人(专业)得 3999元
 * - 专业推荐城市合伙人: 额外得 3%沉淀
 */
function processProfessionalCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, refStats, rule } = params;

  if (!referrerId) return;

  // 第2个起才有佣金
  const professionalCount = refStats.professional_count || 0;

  if (professionalCount >= 1) {
    if (referrer && referrer.role === 'professional_recommender') {
      const amount = rule.amount;

      insertCommission(db, {
        orderId, payerId, payType, totalAmount,
        recipientId: referrerId,
        recipientRole: referrer.role,
        recipientType: referrerId === payerId ? 'self' : 'referrer',
        amount,
        referrerId: referrerId,
        isSelfReferral: isSelfReferral ? 1 : 0,
        note: isSelfReferral ? '自荐专业(第2个起)' : `推荐专业(第${professionalCount + 1}个)`
      });

      updateReferralStats(db, referrerId, payerId, 'professional', amount);
    }
  }
}

/**
 * 城市合伙人入驻佣金
 * - 推荐人(专业): 得 10000元 + 3%沉淀 (独家推荐权)
 * - 自荐: 城市合伙人得本区域沉淀 70%
 */
function processCityFranchiseeCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, refStats, rule } = params;

  // 第2个城市合伙人起
  const cityCount = refStats.city_count || 0;

  if (cityCount >= 1) {
    // 有推荐人
    if (referrerId && referrer) {
      // 专业推荐官推荐: 得 10000元 + 3%沉淀
      if (referrer.role === 'professional_recommender') {
        const commissionAmount = rule.amount;
        const settlementAmount = totalAmount * rule.settlementRate; // 3%沉淀

        // 推荐佣金
        insertCommission(db, {
          orderId, payerId, payType, totalAmount,
          recipientId: referrerId,
          recipientRole: referrer.role,
          recipientType: 'referrer',
          amount: commissionAmount,
          settlementPool: settlementAmount,
          referrerId: referrerId,
          isSelfReferral: isSelfReferral ? 1 : 0,
          note: `推荐城市(第${cityCount + 1}个) + 3%沉淀`
        });

        updateReferralStats(db, referrerId, payerId, 'city', commissionAmount);

        // 沉淀资金: 70%归城市合伙人, 3%归推荐专业, 27%归平台
        const cityShare = totalAmount * rule.cityPartnerRate;     // 70%
        const referralShare = settlementAmount;                   // 3%
        const platformShare = totalAmount - cityShare - referralShare; // 27%

        // 城市合伙人沉淀 (关联到新入驻的城市合伙人)
        insertPlatformFund(db, {
          source: 'city_franchisee',
          orderId,
          amount: cityShare,
          ownerType: 'city_partner',
          ownerId: payerId,
          note: `城市合伙人沉淀资金70%`
        });

        // 专业推荐官沉淀分红 (记录)
        insertPlatformFund(db, {
          source: 'city_franchisee',
          orderId,
          amount: referralShare,
          ownerType: 'professional_partner',
          ownerId: referrerId,
          note: `推荐专业沉淀分红3%`
        });
      }
    }
  } else if (isSelfReferral) {
    // 第1个城市合伙人自荐: 得本区域沉淀 70%
    const cityShare = totalAmount * rule.cityPartnerRate;

    insertPlatformFund(db, {
      source: 'city_franchisee',
      orderId,
      amount: cityShare,
      ownerType: 'city_partner',
      ownerId: payerId,
      note: '自荐城市合伙人沉淀70%'
    });

    insertCommission(db, {
      orderId, payerId, payType, totalAmount,
      recipientId: payerId,
      recipientRole: referrer?.role || 'city_franchisee',
      recipientType: 'self',
      amount: 0,
      settlementPool: cityShare,
      referrerId: referrerId,
      isSelfReferral: 1,
      note: '自荐城市合伙人沉淀70%'
    });
  }
}

/**
 * 线上解锁佣金
 * - 联创红娘(推荐人): 固定99元
 * - 公益推荐官: 无佣金
 * - 剩余归平台
 */
function processOnlineUnlockCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, rule } = params;

  if (!referrerId || !referrer) return;

  // 仅联创红娘有佣金
  if (referrer.role === rule.referrerRoleRequired) {
    const commissionAmount = rule.referrerFixed; // 99元

    insertCommission(db, {
      orderId, payerId, payType, totalAmount,
      recipientId: referrerId,
      recipientRole: referrer.role,
      recipientType: 'referrer',
      amount: commissionAmount,
      platformFee: totalAmount - commissionAmount,
      referrerId: referrerId,
      isSelfReferral: isSelfReferral ? 1 : 0,
      note: `线上解锁推荐佣金(${payType === 'online_unlock_gold' ? '优质' : '良好'})`
    });

    // 平台沉淀剩余金额
    insertPlatformFund(db, {
      source: payType,
      orderId,
      amount: totalAmount - commissionAmount,
      ownerType: 'platform',
      note: `线上解锁平台收入`
    });
  } else {
    // 非联创红娘(如公益推荐官): 全部归平台
    insertPlatformFund(db, {
      source: payType,
      orderId,
      amount: totalAmount,
      ownerType: 'platform',
      note: `线上解锁(推荐人非联创，全部归平台)`
    });
  }
}

/**
 * 沙龙报名佣金 (新版 salon_signup)
 * - 联创红娘(推荐人): 固定99元/人
 * - 城市合伙人(承办人): 固定99元/人
 * - 剩余归平台
 */
function processSalonSignupCommission(db, params) {
  const { orderId, payerId, payType, totalAmount, referrerId, isSelfReferral, referrer, rule } = params;

  let distributed = 0;

  // 推荐人佣金 - 联创红娘得99元
  if (referrerId && referrer && referrer.role === rule.referrerRoleRequired) {
    const refAmount = rule.referrerFixed; // 99元
    distributed += refAmount;

    insertCommission(db, {
      orderId, payerId, payType, totalAmount,
      recipientId: referrerId,
      recipientRole: referrer.role,
      recipientType: 'referrer',
      amount: refAmount,
      referrerId: referrerId,
      isSelfReferral: isSelfReferral ? 1 : 0,
      note: '沙龙报名推荐佣金'
    });
  }

  // 承办人补贴 - 查找沙龙对应的城市合伙人
  // 从订单关联的沙龙信息中获取organizerId
  const salonMember = db.prepare(
    `SELECT s.id, s.organizer_id FROM salon_group_members sgm
     JOIN salon_groups sg ON sgm.group_id = sg.id
     JOIN salons s ON sg.salon_id = s.id
     WHERE sgm.user_id = ? AND sgm.order_id = ?
     LIMIT 1`
  ).get(payerId, orderId);

  if (salonMember && salonMember.organizer_id) {
    const organizer = getUser(db, salonMember.organizer_id);
    if (organizer && organizer.role === rule.organizerRoleRequired) {
      const orgAmount = rule.organizerFixed; // 99元
      distributed += orgAmount;

      insertCommission(db, {
        orderId, payerId, payType, totalAmount,
        recipientId: salonMember.organizer_id,
        recipientRole: organizer.role,
        recipientType: 'organizer',
        amount: orgAmount,
        referrerId: referrerId || null,
        isSelfReferral: 0,
        note: '沙龙承办补贴'
      });
    }
  }

  // 平台沉淀剩余金额
  if (totalAmount > distributed) {
    insertPlatformFund(db, {
      source: 'salon_signup',
      orderId,
      amount: totalAmount - distributed,
      ownerType: 'platform',
      note: '沙龙报名平台收入'
    });
  }
}

/**
 * 处理沙龙参会补贴
 * - 承办人(城市合伙人): 99元/人
 * - 推荐人(联创): 99元/人 (沙龙补贴)
 */
function processSalonSubsidy(db, { salonId, organizerId, attendeeId, referrerId, subsidyAmount }) {
  const subsidy = subsidyAmount || COMMISSION_RULES.salon_attend.organizerSubsidy;

  // 承办人补贴
  if (organizerId) {
    const organizer = getUser(db, organizerId);
    if (organizer && organizer.role === 'city_franchisee') {
      db.prepare(
        `INSERT INTO commissions (order_id, payer_id, pay_type, total_amount, recipient_id, recipient_role, recipient_type, amount, note)
         VALUES (?, ?, 'salon_attend', ?, ?, ?, 'organizer', ?, '沙龙承办补贴')`
      ).run(salonId, attendeeId, subsidy, organizerId, organizer.role, subsidy);
    }
  }

  // 推荐人补贴 (联创推荐官)
  if (referrerId) {
    const referrer = getUser(db, referrerId);
    if (referrer && referrer.role === 'partner_matchmaker') {
      const referralSubsidy = COMMISSION_RULES.salon_attend.referralSubsidy;

      db.prepare(
        `INSERT INTO commissions (order_id, payer_id, pay_type, total_amount, recipient_id, recipient_role, recipient_type, amount, referrer_id, note)
         VALUES (?, ?, 'salon_attend', ?, ?, ?, 'referrer', ?, ?, '沙龙推荐补贴')`
      ).run(salonId, attendeeId, referralSubsidy, referrerId, referrer.role, referralSubsidy, referrerId);

      // 更新沙龙补贴记录
      db.prepare(
        `INSERT INTO salon_subsidies (salon_id, organizer_id, attendee_id, referrer_id, subsidy_amount, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      ).run(salonId, organizerId, attendeeId, referrerId, referralSubsidy);
    }
  }
}

// ============================================
// 辅助函数
// ============================================

function getUser(db, userId) {
  return db.prepare(
    'SELECT id, role, matchmaker_level, referrer_id FROM users WHERE id = ?'
  ).get(userId) || null;
}

/**
 * 无条件创建/更新 referral_stats（解决第1个无佣金导致记录缺失的死锁问题）
 */
function upsertReferralStats(db, userId, referrerId, payType, amount) {
  if (!referrerId) return;

  const column = `${payType}_count`;
  const amountColumn = `${payType}_amount`;

  const existing = db.prepare(
    'SELECT id FROM referral_stats WHERE user_id = ? AND referrer_id = ?'
  ).get(userId, referrerId);

  if (existing) {
    if (amount > 0) {
      db.prepare(
        `UPDATE referral_stats SET ${column} = ${column} + 1, ${amountColumn} = ${amountColumn} + ?, updated_at = datetime('now')
         WHERE user_id = ? AND referrer_id = ?`
      ).run(amount, userId, referrerId);
    }
  } else {
    db.prepare(
      `INSERT INTO referral_stats (user_id, referrer_id, ${column}, ${amountColumn})
       VALUES (?, ?, 1, ?)`
    ).run(userId, referrerId, amount);
  }
}

function getOrCreateReferralStats(db, userId, referrerId) {
  if (!referrerId) return { registration_count: 0, partner_count: 0, professional_count: 0, city_count: 0 };

  const row = db.prepare(
    'SELECT * FROM referral_stats WHERE user_id = ? AND referrer_id = ?'
  ).get(userId, referrerId);

  if (row) return row;

  // 统计该推荐人的各类型推荐数量
  const counts = db.prepare(
    `SELECT
       SUM(CASE WHEN pay_type = 'single_registration' THEN 1 ELSE 0 END) as registration_count,
       SUM(CASE WHEN pay_type = 'partner_matchmaker' THEN 1 ELSE 0 END) as partner_count,
       SUM(CASE WHEN pay_type = 'professional_recommender' THEN 1 ELSE 0 END) as professional_count,
       SUM(CASE WHEN pay_type = 'city_franchisee' THEN 1 ELSE 0 END) as city_count
     FROM commissions WHERE recipient_id = ? AND status = 'settled'`
  ).get(referrerId);

  return {
    registration_count: counts?.registration_count || 0,
    partner_count: counts?.partner_count || 0,
    professional_count: counts?.professional_count || 0,
    city_count: counts?.city_count || 0,
  };
}

function insertCommission(db, data) {
  const {
    orderId, payerId, payType, totalAmount,
    recipientId, recipientRole, recipientType,
    amount, platformFee = 0, settlementPool = 0,
    referrerId, isSelfReferral = 0, note = null
  } = data;

  db.prepare(
    `INSERT INTO commissions
     (order_id, payer_id, pay_type, total_amount, recipient_id, recipient_role, recipient_type,
      amount, platform_fee, settlement_pool, referrer_id, is_self_referral, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(orderId, payerId, payType, totalAmount, recipientId, recipientRole, recipientType,
       amount, platformFee, settlementPool, referrerId, isSelfReferral, note);
}

function insertPlatformFund(db, data) {
  const { source, orderId, amount, ownerType, ownerId = null, note = null } = data;

  db.prepare(
    `INSERT INTO platform_fund (source, order_id, amount, owner_type, owner_id, status, note)
     VALUES (?, ?, ?, ?, ?, 'accumulated', ?)`
  ).run(source, orderId, amount, ownerType, ownerId, note);
}

function updateReferralStats(db, referrerId, userId, type, amount) {
  const column = `${type}_count`;
  const amountColumn = `${type}_amount`;

  // 检查记录是否存在
  const existing = db.prepare(
    'SELECT id FROM referral_stats WHERE user_id = ? AND referrer_id = ?'
  ).get(userId, referrerId);

  if (existing) {
    db.prepare(
      `UPDATE referral_stats SET ${column} = ${column} + 1, ${amountColumn} = ${amountColumn} + ?, updated_at = datetime('now')
       WHERE user_id = ? AND referrer_id = ?`
    ).run(amount, userId, referrerId);
  } else {
    db.prepare(
      `INSERT INTO referral_stats (user_id, referrer_id, ${column}, ${amountColumn})
       VALUES (?, ?, 1, ?)`
    ).run(userId, referrerId, amount);
  }
}

/**
 * 获取用户可提现佣金总额
 */
function getWithdrawableCommission(userId, externalDb = null) {
  const db = externalDb || getDB();

  const row = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM commissions
     WHERE recipient_id = ? AND status = 'pending' AND recipient_type != 'platform'`
  ).get(userId);

  return parseFloat(row?.total || 0);
}

/**
 * 获取沉淀资金余额
 */
function getPlatformFundBalance(userId, ownerType, externalDb = null) {
  const db = externalDb || getDB();

  const row = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM platform_fund
     WHERE owner_type = ? AND owner_id = ? AND status = 'accumulated'`
  ).get(ownerType, userId);

  return parseFloat(row?.total || 0);
}

/**
 * 获取佣金明细列表
 */
function getCommissionList(userId, options = {}, externalDb = null) {
  const db = externalDb || getDB();
  const { status, limit = 20, offset = 0 } = options;

  let sql = `
    SELECT c.*, u.nickname as payer_nickname, u.avatar_url as payer_avatar
    FROM commissions c
    LEFT JOIN users u ON c.payer_id = u.id
    WHERE c.recipient_id = ? AND c.recipient_type != 'platform'
  `;
  const params = [userId];

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * 计算提现手续费
 */
function calculateWithdrawalFee(role, amount) {
  // 城市合伙人：沉淀资金分成，无额外扣费（已为净额）
  if (role === 'city_franchisee') {
    return {
      fee: 0,
      netAmount: amount,
      rate: 0,
      description: '沉淀资金分成（已为净额，无额外扣费）'
    };
  }

  // 社区服务站：提现扣除13%平台服务费
  if (role === 'community_station') {
    const rate = 0.13;
    return {
      fee: amount * rate,
      netAmount: amount * (1 - rate),
      rate: rate,
      description: `提现扣除${rate * 100}%平台服务费`
    };
  }

  // 其他所有身份（公益/联创/专业推荐官）统一扣13%
  const rate = 0.13;
  return {
    fee: amount * rate,
    netAmount: amount * (1 - rate),
    rate: rate,
    description: `提现扣除${rate * 100}%平台服务费`
  };
}

/**
 * 处理提现申请（事务）
 * - 计算手续费
 * - 更新佣金状态为 'withdraw_requested'
 * - 记录提现流水
 */
function processWithdrawal({ userId, amount, role, withdrawalMethod = 'wechat' }, externalDb = null) {
  const db = externalDb || getDB();

  const doWithdrawal = db.transaction(() => {
    // 计算手续费
    const feeCalc = calculateWithdrawalFee(role, amount);
    const { fee, netAmount } = feeCalc;

    // 检查可提现余额（只统计推荐收益，不包含平台沉淀）
    const balanceRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM commissions
       WHERE recipient_id = ? AND status = 'pending' AND recipient_type != 'platform'`
    ).get(userId);
    const balance = parseFloat(balanceRow?.total || 0);

    if (balance < amount) {
      throw new Error(`余额不足：可提现 ${balance.toFixed(2)} 元，申请提现 ${amount.toFixed(2)} 元`);
    }

    // 插入提现记录（status: 0=待处理, 1=已到账, 2=已拒绝）
    const result = db.prepare(
      `INSERT INTO withdrawals (userId, amount, fee, actualAmount, type, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).run(userId, amount, fee, netAmount, withdrawalMethod);
    const withdrawalId = Number(result.lastInsertRowid);

    // 锁定对应金额的佣金记录（更新状态为 'withdraw_requested'）
    // 按时间顺序锁定，直到金额足够
    const pendingCommissions = db.prepare(
      `SELECT id, amount FROM commissions
       WHERE recipient_id = ? AND status = 'pending' AND recipient_type != 'platform'
       ORDER BY created_at ASC`
    ).all(userId);

    let remaining = amount;
    const lockedIds = [];
    for (const comm of pendingCommissions) {
      if (remaining <= 0) break;
      lockedIds.push(comm.id);
      remaining -= parseFloat(comm.amount);
    }

    if (lockedIds.length > 0) {
      const placeholders = lockedIds.map(() => '?').join(',');
      db.prepare(
        `UPDATE commissions
         SET status = 'withdraw_requested', withdrawal_id = ?, updated_at = datetime('now')
         WHERE id IN (${placeholders})`
      ).run(withdrawalId, ...lockedIds);
    }

    logger.debug(`[processWithdrawal] 用户 ${userId} 提现 ${amount} 元，手续费 ${fee} 元，实际到账 ${netAmount} 元`);

    return {
      withdrawalId,
      amount,
      fee,
      netAmount,
      status: 'pending'
    };
  });

  return doWithdrawal();
}

/**
 * 确认提现到账（管理员操作，事务）
 * - 更新提现状态为 'completed'
 * - 更新关联佣金状态为 'paid'
 */
function confirmWithdrawal(withdrawalId, externalDb = null) {
  const db = externalDb || getDB();

  const doConfirm = db.transaction(() => {
    // 获取提现记录（status: 0=待处理, 1=已到账, 2=已拒绝）
    const withdrawal = db.prepare(
      'SELECT * FROM withdrawals WHERE id = ?'
    ).get(withdrawalId);

    if (!withdrawal) {
      throw new Error(`提现记录不存在：ID ${withdrawalId}`);
    }

    if (withdrawal.status !== 0) {
      throw new Error(`提现记录状态不是待处理：当前状态 ${withdrawal.status}`);
    }

    // 更新提现状态为已到账（status=1）
    db.prepare(
      `UPDATE withdrawals SET status = 1, processedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?`
    ).run(withdrawalId);

    // 更新关联佣金状态为 'paid'
    db.prepare(
      `UPDATE commissions SET status = 'paid', updatedAt = datetime('now') WHERE withdrawalId = ?`
    ).run(withdrawalId);

    logger.debug(`[confirmWithdrawal] 提现 ${withdrawalId} 确认到账，用户 ${withdrawal.userId} 实际到账 ${withdrawal.actualAmount} 元`);

    return { success: true, withdrawalId };
  });

  return doConfirm();
}

module.exports = {
  processCommission,
  processSalonSubsidy,
  processOnlineUnlockCommission,
  processSalonSignupCommission,
  getWithdrawableCommission,
  getPlatformFundBalance,
  getCommissionList,
  calculateWithdrawalFee,
  processWithdrawal,
  confirmWithdrawal,
  COMMISSION_RULES,
};
