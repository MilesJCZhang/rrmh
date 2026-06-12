/**
 * scoreHelper.js - 前端评分计算辅助
 *
 * 作用：
 * 1. 前端离线模式计算评分（用户填写时实时展示，无需请求后端）
 * 2. 与服务端 scoreEngine.js 的评分规则保持同步
 * 3. 提供 getScoreForData(data) 方法，接收用户资料对象返回评分结果
 */

// 评分规则（与后端 scoreEngine.js DEFAULT_RULES 同步）
const SCORE_RULES = {
  basic: { max: 40, fields: ['avatar', 'nickname', 'gender', 'birthYear', 'city', 'phone', 'wechatAccount', 'education', 'maritalStatus', 'intro'] },
  career: { max: 15, fields: ['occupation', 'income', 'hasProperty', 'hasCar'] },
  hobby: { max: 15, fields: ['healthTags', 'sleepHabit', 'sportHabit', 'dietTags', 'smoking', 'drinking'] },
  preference: { max: 10, fields: ['expectAgeMin', 'expectEducation', 'expectIncome', 'marriageExpect'] },
  verification: { max: 12, fields: ['idVerification', 'faceAuth'] },
  asset: { max: 8, fields: ['propertyProof', 'vehicleProof', 'bankDepositProof', 'insuranceProof'] },
};

// 字段 → 分值映射
const FIELD_SCORES = {
  avatar: 8, nickname: 5, gender: 3, birthYear: 3, city: 3,
  phone: 3, wechatAccount: 3, education: 4, maritalStatus: 3, intro: 5,
  occupation: 5, income: 5, hasProperty: 3, hasCar: 2,
  healthTags: 5, sleepHabit: 3, sportHabit: 3, dietTags: 2, smoking: 1, drinking: 1,
  expectAgeMin: 3, expectEducation: 2, expectIncome: 2, marriageExpect: 3,
  idVerification: 5, faceAuth: 7,
  propertyProof: 3, vehicleProof: 2, bankDepositProof: 2, insuranceProof: 1,
};

// 维度中文标签
const GROUP_LABELS = {
  basic: '基础信息', career: '职业收入', hobby: '兴趣爱好',
  preference: '择偶需求', verification: '认证', asset: '资产',
};

/**
 * 判断字段是否有值
 */
function isFilled(fieldKey, data) {
  if (!data) return false;
  const val = data[fieldKey];
  if (val === undefined || val === null || val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  // 特殊映射
  switch (fieldKey) {
    case 'idVerification':
      return !!(data.id_card_front_image && data.id_card_back_image);
    case 'faceAuth':
      return data.face_auth_status === 'approved';
    case 'propertyProof':
      return !!(data.property_images && data.property_images !== '[]');
    case 'vehicleProof':
      return !!(data.vehicle_images && data.vehicle_images !== '[]');
    case 'bankDepositProof':
      return !!data.bank_deposit_proof;
    case 'insuranceProof':
      return !!data.insurance_proof;
    default:
      return true;
  }
}

/**
 * 离线计算评分
 * @param {Object} data - 用户资料对象
 * @returns {{ totalScore, tier, groupScores }}
 */
function getScoreForData(data) {
  const groupScores = {};
  let totalScore = 0;

  for (const [group, config] of Object.entries(SCORE_RULES)) {
    let groupTotal = 0;
    for (const field of config.fields) {
      if (isFilled(field, data)) {
        groupTotal += FIELD_SCORES[field] || 0;
      }
    }
    groupScores[group] = groupTotal;
    totalScore += groupTotal;
  }

  totalScore = Math.min(totalScore, 100);

  let tier = 'unrated';
  if (totalScore >= 80) tier = 'gold';
  else if (totalScore >= 60) tier = 'silver';
  else if (totalScore > 0) tier = 'bronze';

  return { totalScore, tier, groupScores };
}

/**
 * 获取评分等级说明
 */
function getTierInfo(tier) {
  const map = {
    gold: { label: '优质', color: '#FFD700', range: '80-100分', onlinePrice: 199, canOnline: true },
    silver: { label: '良好', color: '#C0C0C0', range: '60-79分', onlinePrice: 299, canOnline: true },
    bronze: { label: '基础', color: '#CD7F32', range: '60分以下', onlinePrice: 0, canOnline: false },
    unrated: { label: '未建档', color: '#999', range: '未填写资料', onlinePrice: 0, canOnline: false },
  };
  return map[tier] || map.unrated;
}

module.exports = {
  SCORE_RULES,
  FIELD_SCORES,
  GROUP_LABELS,
  isFilled,
  getScoreForData,
  getTierInfo,
};
