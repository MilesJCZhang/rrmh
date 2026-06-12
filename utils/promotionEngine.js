// utils/promotionEngine.js - 推荐关系与分润引擎
const app = getApp();
const commissionRules = require('./commissionRules');

const PROMOTION_STORAGE_KEY = 'promoterId';
const FIRST_RECOMMENDATION_KEY = 'firstRecommendation';

const BUSINESS_TYPES = {
  SINGLE_REGISTRATION: 'single_registration',
  PUBLIC_MATCHMAKER: 'public_matchmaker',
  PARTNER_MATCHMAKER: 'partner_matchmaker',
  COMMUNITY_STATION: 'community_station',
  ONLINE_FRANCHISEE: 'online_franchisee',
  CITY_FRANCHISEE: 'city_franchisee',
  SALON_PARTICIPATION: 'salon_participation'
};

function getPromoterId() {
  return wx.getStorageSync(PROMOTION_STORAGE_KEY) || null;
}

function setPromoterId(promoterId) {
  if (promoterId) {
    wx.setStorageSync(PROMOTION_STORAGE_KEY, promoterId);
  }
}

function clearPromoterId() {
  wx.removeStorageSync(PROMOTION_STORAGE_KEY);
}

function isFirstRecommendation(recommenderId, businessType) {
  const key = `${FIRST_RECOMMENDATION_KEY}_${recommenderId}_${businessType}`;
  const record = wx.getStorageSync(key);
  return !record;
}

function markFirstRecommendation(recommenderId, businessType) {
  const key = `${FIRST_RECOMMENDATION_KEY}_${recommenderId}_${businessType}`;
  wx.setStorageSync(key, {
    recommendedAt: new Date().toISOString()
  });
}

function calculateCommission(recommenderRole, businessType, amount = 0, isFirst = false) {
  const rules = commissionRules.getCommissionRules(recommenderRole);
  
  if (!rules || !rules.commissions) {
    return {
      success: false,
      message: '未找到对应的佣金规则'
    };
  }

  const commissionRule = rules.commissions[businessType];
  
  if (!commissionRule) {
    return {
      success: false,
      message: '未找到对应业务的佣金规则'
    };
  }

  let commissionAmount = 0;
  
  if (isFirst && commissionRule.firstCommission !== undefined) {
    commissionAmount = commissionRule.firstCommission;
  } else if (commissionRule.commission !== undefined) {
    commissionAmount = commissionRule.commission;
  } else if (commissionRule.platformFeeRate !== undefined) {
    commissionAmount = amount * (1 - commissionRule.platformFeeRate);
  }

  return {
    success: true,
    data: {
      amount: commissionAmount,
      description: commissionRule.description,
      isFirst: isFirst,
      businessType: businessType
    }
  };
}

function recordCommission(recommenderId, businessType, amount, userId) {
  const existingRecords = wx.getStorageSync('commissionRecords') || [];
  
  const newRecord = {
    id: Date.now(),
    recommenderId: recommenderId,
    businessType: businessType,
    amount: amount,
    userId: userId,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  existingRecords.push(newRecord);
  wx.setStorageSync('commissionRecords', existingRecords);
  
  return newRecord;
}

function getCommissionRecords(recommenderId) {
  const allRecords = wx.getStorageSync('commissionRecords') || [];
  return allRecords.filter(record => record.recommenderId === recommenderId);
}

function getIncomeStats(recommenderId) {
  const records = getCommissionRecords(recommenderId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let todayIncome = 0;
  let monthIncome = 0;
  let totalIncome = 0;
  let withdrawable = 0;
  
  records.forEach(record => {
    const recordDate = new Date(record.createdAt);
    const amount = parseFloat(record.amount) || 0;
    
    totalIncome += amount;
    
    if (record.status === 'confirmed') {
      withdrawable += amount;
    }
    
    if (recordDate >= today) {
      todayIncome += amount;
    }
    
    if (recordDate >= thisMonth) {
      monthIncome += amount;
    }
  });
  
  return {
    today: todayIncome.toFixed(2),
    month: monthIncome.toFixed(2),
    total: totalIncome.toFixed(2),
    withdrawable: withdrawable.toFixed(2)
  };
}

function bindPromotion(userId) {
  const promoterId = getPromoterId();
  
  if (!promoterId) {
    return { success: false, message: '没有推荐人信息' };
  }
  
  const promotionBindings = wx.getStorageSync('promotionBindings') || {};
  
  if (promotionBindings[userId]) {
    return { 
      success: false, 
      message: '用户已有推荐关系',
      data: promotionBindings[userId]
    };
  }
  
  promotionBindings[userId] = {
    promoterId: promoterId,
    boundAt: new Date().toISOString()
  };
  
  wx.setStorageSync('promotionBindings', promotionBindings);
  
  clearPromoterId();
  
  return {
    success: true,
    message: '推荐关系绑定成功',
    data: promotionBindings[userId]
  };
}

function getPromotionBinding(userId) {
  const promotionBindings = wx.getStorageSync('promotionBindings') || {};
  return promotionBindings[userId] || null;
}

function getDownlineUsers(promoterId) {
  const promotionBindings = wx.getStorageSync('promotionBindings') || {};
  const downlineUsers = [];
  
  Object.keys(promotionBindings).forEach(userId => {
    if (promotionBindings[userId].promoterId === promoterId) {
      downlineUsers.push({
        userId: userId,
        boundAt: promotionBindings[userId].boundAt
      });
    }
  });
  
  return downlineUsers;
}

function processPayment(userId, businessType, amount = 0) {
  const binding = getPromotionBinding(userId);
  
  if (!binding) {
    return { success: false, message: '该用户没有推荐人' };
  }
  
  const promoterId = binding.promoterId;
  const userInfo = app.globalData.userInfo;
  const recommenderRole = userInfo ? userInfo.role : 'user';
  const isFirst = isFirstRecommendation(promoterId, businessType);
  
  const commissionResult = calculateCommission(
    recommenderRole,
    businessType,
    amount,
    isFirst
  );
  
  if (!commissionResult.success) {
    return commissionResult;
  }
  
  const record = recordCommission(
    promoterId,
    businessType,
    commissionResult.data.amount,
    userId
  );
  
  if (isFirst) {
    markFirstRecommendation(promoterId, businessType);
  }
  
  return {
    success: true,
    data: {
      commission: commissionResult.data,
      record: record
    }
  };
}

module.exports = {
  BUSINESS_TYPES,
  getPromoterId,
  setPromoterId,
  clearPromoterId,
  isFirstRecommendation,
  markFirstRecommendation,
  calculateCommission,
  recordCommission,
  getCommissionRecords,
  getIncomeStats,
  bindPromotion,
  getPromotionBinding,
  getDownlineUsers,
  processPayment
};
