/**
 * pricing.js - 分层定价逻辑
 *
 * 规则：
 * - gold(80+): 可线上了解 199元 + 线下沙龙，可见所有tier用户
 * - silver(60-79): 可线上了解 299元 + 线下沙龙，不可解锁gold用户
 * - bronze(<60): 仅线下沙龙，不可线上解锁
 * - unrated: 无任何权限
 */

// 线上解锁定价（元）
const ONLINE_UNLOCK_PRICES = {
  gold: 199,
  silver: 299,
  bronze: 0,       // 不可线上解锁
  unrated: 0,      // 不可线上解锁
};

// 是否允许线上解锁
const CAN_ONLINE_UNLOCK = {
  gold: true,
  silver: true,
  bronze: false,
  unrated: false,
};

// 分层访问控制：viewerTier能否查看targetTier
// gold用户可见所有tier, silver可见silver+bronze, bronze仅可见bronze
const TIER_VISIBILITY = {
  gold:   ['gold', 'silver', 'bronze'],
  silver: ['silver', 'bronze'],
  bronze: ['bronze'],
  unrated: [],
};

// 分层可解锁对象：viewerTier能否线上解锁targetTier
// gold可解锁gold+silver, silver可解锁silver+bronze, bronze不可解锁
const TIER_UNLOCK_ACCESS = {
  gold:   ['gold', 'silver', 'bronze'],
  silver: ['silver', 'bronze'],
  bronze: [],
  unrated: [],
};

/**
 * 获取线上解锁价格（元）
 * @param {string} targetTier - 被查看用户的tier
 * @returns {number} 价格（元），0表示不可解锁
 */
function getOnlineUnlockPrice(targetTier) {
  return ONLINE_UNLOCK_PRICES[targetTier] || 0;
}

/**
 * 获取线上解锁价格（分），用于支付
 */
function getOnlineUnlockPriceFen(targetTier) {
  return (ONLINE_UNLOCK_PRICES[targetTier] || 0) * 100;
}

/**
 * 判断viewer能否线上解锁target
 * @param {string} viewerTier - 发起解锁用户的tier
 * @param {string} targetTier - 被解锁用户的tier
 * @returns {boolean}
 */
function canOnlineUnlock(viewerTier, targetTier) {
  if (!CAN_ONLINE_UNLOCK[viewerTier]) return false;
  const allowed = TIER_UNLOCK_ACCESS[viewerTier] || [];
  return allowed.includes(targetTier);
}

/**
 * 判断viewer能否查看target的推荐卡片
 * @param {string} viewerTier
 * @param {string} targetTier
 * @returns {boolean}
 */
function canViewTier(viewerTier, targetTier) {
  const visible = TIER_VISIBILITY[viewerTier] || [];
  return visible.includes(targetTier);
}

/**
 * 获取用户tier可执行的线上解锁价格和权限说明
 * @param {string} tier
 * @returns {{ canOnline, onlinePrice, canSalon, visibleTiers, unlockableTiers, description }}
 */
function getTierAccessInfo(tier) {
  const onlinePrice = ONLINE_UNLOCK_PRICES[tier] || 0;
  const canOnline = CAN_ONLINE_UNLOCK[tier] || false;
  const canSalon = tier === 'gold' || tier === 'silver' || tier === 'bronze';
  const visibleTiers = TIER_VISIBILITY[tier] || [];
  const unlockableTiers = TIER_UNLOCK_ACCESS[tier] || [];

  const descriptions = {
    gold: '80分以上，可线上了解199元/人+线下沙龙，查看所有会员',
    silver: '60-79分，可线上了解299元/人+线下沙龙',
    bronze: '60分以下，仅线下沙龙，不可线上解锁',
    unrated: '未建档，暂无权限',
  };

  return {
    canOnline,
    onlinePrice,
    canSalon,
    visibleTiers,
    unlockableTiers,
    description: descriptions[tier] || '',
  };
}

/**
 * 支付类型名（用于orders表type字段）
 */
function getUnlockPaymentType(targetTier) {
  if (targetTier === 'gold') return 'online_unlock_gold';
  if (targetTier === 'silver') return 'online_unlock_silver';
  return 'online_unlock';
}

module.exports = {
  ONLINE_UNLOCK_PRICES,
  CAN_ONLINE_UNLOCK,
  TIER_VISIBILITY,
  TIER_UNLOCK_ACCESS,
  getOnlineUnlockPrice,
  getOnlineUnlockPriceFen,
  canOnlineUnlock,
  canViewTier,
  getTierAccessInfo,
  getUnlockPaymentType,
};
