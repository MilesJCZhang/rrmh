/**
 * scoreEngine.js - 100分评分计算引擎
 *
 * 6维度评分体系：
 *   基础信息(40) + 职业收入(15) + 兴趣爱好(15) + 择偶需求(10) + 认证(12) + 资产(8) = 100分
 *
 * 评分等级(tier)：
 *   gold(80+): 线上了解199元 + 线下沙龙
 *   silver(60-79): 线上了解299元 + 线下沙龙，不可解锁gold用户
 *   bronze(<60): 仅线下沙龙
 *   unrated: 未建档
 */

const logger = require('./logger');

// ========== 默认评分规则 ==========
// 与 database/migrations/v3_score_system.sql 保持同步
const DEFAULT_RULES = [
  // 基础信息 (40分)
  { field_key: 'avatar',         field_group: 'basic',        field_label: '头像',     max_score: 8 },
  { field_key: 'nickname',       field_group: 'basic',        field_label: '昵称',     max_score: 5 },
  { field_key: 'gender',         field_group: 'basic',        field_label: '性别',     max_score: 3 },
  { field_key: 'birthYear',      field_group: 'basic',        field_label: '出生年份', max_score: 3 },
  { field_key: 'city',           field_group: 'basic',        field_label: '城市',     max_score: 3 },
  { field_key: 'phone',          field_group: 'basic',        field_label: '手机号',   max_score: 3 },
  { field_key: 'wechatAccount',  field_group: 'basic',        field_label: '微信号',   max_score: 3 },
  { field_key: 'education',      field_group: 'basic',        field_label: '学历',     max_score: 4 },
  { field_key: 'maritalStatus',  field_group: 'basic',        field_label: '婚姻状态', max_score: 3 },
  { field_key: 'intro',          field_group: 'basic',        field_label: '自我介绍', max_score: 5 },
  // 职业收入 (15分)
  { field_key: 'occupation',     field_group: 'career',      field_label: '职业',     max_score: 5 },
  { field_key: 'income',         field_group: 'career',      field_label: '收入',     max_score: 5 },
  { field_key: 'hasProperty',    field_group: 'career',      field_label: '房产',     max_score: 3 },
  { field_key: 'hasCar',         field_group: 'career',      field_label: '车辆',     max_score: 2 },
  // 兴趣爱好 (15分)
  { field_key: 'healthTags',     field_group: 'hobby',       field_label: '健康标签', max_score: 5 },
  { field_key: 'sleepHabit',     field_group: 'hobby',       field_label: '作息习惯', max_score: 3 },
  { field_key: 'sportHabit',     field_group: 'hobby',       field_label: '运动习惯', max_score: 3 },
  { field_key: 'dietTags',       field_group: 'hobby',       field_label: '饮食偏好', max_score: 2 },
  { field_key: 'smoking',        field_group: 'hobby',       field_label: '抽烟',     max_score: 1 },
  { field_key: 'drinking',       field_group: 'hobby',       field_label: '饮酒',     max_score: 1 },
  // 择偶需求 (10分)
  { field_key: 'expectAgeMin',    field_group: 'preference',  field_label: '期望年龄', max_score: 3 },
  { field_key: 'expectEducation', field_group: 'preference',  field_label: '期望学历', max_score: 2 },
  { field_key: 'expectIncome',    field_group: 'preference',  field_label: '期望收入', max_score: 2 },
  { field_key: 'marriageExpect',  field_group: 'preference',  field_label: '感情态度', max_score: 3 },
  // 认证 (12分)
  { field_key: 'idVerification',  field_group: 'verification', field_label: '身份证验证', max_score: 5 },
  { field_key: 'faceAuth',       field_group: 'verification', field_label: '人脸认证',   max_score: 7 },
  // 资产 (8分)
  { field_key: 'propertyProof',   field_group: 'asset',       field_label: '房产证明', max_score: 3 },
  { field_key: 'vehicleProof',    field_group: 'asset',       field_label: '车辆证明', max_score: 2 },
  { field_key: 'bankDepositProof',field_group: 'asset',       field_label: '银行存款', max_score: 2 },
  { field_key: 'insuranceProof',  field_group: 'asset',       field_label: '保险证明', max_score: 1 },
];

// 维度分组
const GROUP_ORDER = ['basic', 'career', 'hobby', 'preference', 'verification', 'asset'];
const GROUP_LABELS = {
  basic: '基础信息',
  career: '职业收入',
  hobby: '兴趣爱好',
  preference: '择偶需求',
  verification: '认证',
  asset: '资产',
};

// ========== 评分等级 ==========
/**
 * 根据总分返回tier
 * @param {number} score - 0-100
 * @returns {string} gold | silver | bronze | unrated
 */
function getTier(score) {
  if (score >= 80) return 'gold';
  if (score >= 60) return 'silver';
  if (score > 0) return 'bronze';
  return 'unrated';
}

/**
 * 获取tier的中文标签
 */
function getTierLabel(tier) {
  const labels = { gold: '优质', silver: '良好', bronze: '基础', unrated: '未建档' };
  return labels[tier] || '未知';
}

// ========== 字段值判断是否已填写 ==========
/**
 * 判断某个字段是否有值（已填写）
 * 特殊字段映射：某些字段的值来源与key不完全对应
 */
function isFieldFilled(fieldKey, userData) {
  if (!userData) return false;

  // camelCase → snake_case 映射（DB stored columns are snake_case）
  const SNAKE_CASE_MAP = {
    hasProperty: 'has_property',
    hasCar: 'has_car',
    healthTags: 'health_tags',
    sleepHabit: 'sleep_habit',
    sportHabit: 'sport_habit',
    dietTags: 'diet_tags',
    expectAgeMin: 'expect_age_min',
    expectAgeMax: 'expect_age_max',
    expectEducation: 'expect_education',
    expectIncome: 'expect_income',
    marriageExpect: 'marriage_expect',
    maritalStatus: 'marital_status',
    wechatAccount: 'wechat_account',
  };

  let val = userData[fieldKey];
  // camelCase 找不到时尝试 snake_case 变体
  if (val === undefined) {
    const altKey = SNAKE_CASE_MAP[fieldKey];
    if (altKey && userData[altKey] !== undefined) {
      val = userData[altKey];
    }
  }
  if (val === undefined || val === null || val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;

  // 特殊字段映射（这些字段的值来源与 key 不完全对应）
  switch (fieldKey) {
    case 'idVerification':
      return !!(userData.id_card_front_image || userData.id_card_front_image) && !!(userData.id_card_back_image || userData.id_card_back_image);
    case 'faceAuth':
      return (userData.face_auth_status || userData.faceAuth) === 'approved';
    case 'propertyProof':
      return !!(userData.property_images && userData.property_images !== '[]');
    case 'vehicleProof':
      return !!(userData.vehicle_images && userData.vehicle_images !== '[]');
    case 'bankDepositProof':
      return !!(userData.bank_deposit_proof || userData.bankDepositProof);
    case 'insuranceProof':
      return !!(userData.insurance_proof || userData.insuranceProof);
    default:
      return true; // 普通字段有值即可
  }
}

// ========== 核心评分计算 ==========
/**
 * 计算用户评分
 * @param {object} db - better-sqlite3 数据库实例
 * @param {number} userId - 用户ID
 * @returns {{ totalScore, groupScores, detail, tier }}
 */
function calculateScore(db, userId) {
  // 1. 获取用户数据
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { totalScore: 0, groupScores: {}, detail: {}, tier: 'unrated' };
  }

  // 2. 获取评分规则（优先从数据库读取，fallback到默认规则）
  let rules;
  try {
    rules = db.prepare('SELECT * FROM score_rules WHERE status = ? ORDER BY sort_order').all('active');
    if (!rules || rules.length === 0) {
      rules = DEFAULT_RULES;
    }
  } catch (e) {
    // score_rules表可能不存在，使用默认规则
    rules = DEFAULT_RULES;
  }

  // 3. 逐字段计算
  const detail = {};
  const groupScores = {};
  let totalScore = 0;

  for (const group of GROUP_ORDER) {
    let groupTotal = 0;
    const groupRules = rules.filter(r => r.field_group === group);
    for (const rule of groupRules) {
      const filled = isFieldFilled(rule.field_key, user);
      const earned = filled ? rule.max_score : 0;
      detail[rule.field_key] = {
        label: rule.field_label,
        maxScore: rule.max_score,
        earnedScore: earned,
        filled,
      };
      groupTotal += earned;
    }
    groupScores[group] = groupTotal;
    totalScore += groupTotal;
  }

  // 总分上限100
  totalScore = Math.min(totalScore, 100);

  return {
    totalScore,
    groupScores,
    detail,
    tier: getTier(totalScore),
  };
}

/**
 * 计算评分并保存到数据库
 * @param {object} db - better-sqlite3 数据库实例
 * @param {number} userId - 用户ID
 * @returns {{ totalScore, groupScores, detail, tier }}
 */
function recalculateAndSave(db, userId) {
  const result = calculateScore(db, userId);
  const { totalScore, groupScores, tier, detail } = result;

  // 保存到 user_scores 表
  const detailJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(detail).map(([k, v]) => [k, v.earnedScore])
    )
  );

  try {
    db.prepare(`
      INSERT INTO user_scores (user_id, total_score, basic_score, career_score,
        hobby_score, preference_score, verification_score, asset_score,
        score_tier, detail_json, calculated_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        total_score = excluded.total_score,
        basic_score = excluded.basic_score,
        career_score = excluded.career_score,
        hobby_score = excluded.hobby_score,
        preference_score = excluded.preference_score,
        verification_score = excluded.verification_score,
        asset_score = excluded.asset_score,
        score_tier = excluded.score_tier,
        detail_json = excluded.detail_json,
        calculated_at = datetime('now'),
        updated_at = datetime('now')
    `).run(
      userId, totalScore,
      groupScores.basic || 0,
      groupScores.career || 0,
      groupScores.hobby || 0,
      groupScores.preference || 0,
      groupScores.verification || 0,
      groupScores.asset || 0,
      tier,
      detailJson
    );
  } catch (e) {
    // user_scores 表可能不存在，尝试建表后重试
    if (e.message && e.message.includes('no such table')) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS user_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          total_score INTEGER DEFAULT 0,
          basic_score INTEGER DEFAULT 0,
          career_score INTEGER DEFAULT 0,
          hobby_score INTEGER DEFAULT 0,
          preference_score INTEGER DEFAULT 0,
          verification_score INTEGER DEFAULT 0,
          asset_score INTEGER DEFAULT 0,
          score_tier TEXT DEFAULT 'unrated',
          detail_json TEXT,
          calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      // 重试
      db.prepare(`
        INSERT INTO user_scores (user_id, total_score, basic_score, career_score,
          hobby_score, preference_score, verification_score, asset_score,
          score_tier, detail_json, calculated_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          total_score = excluded.total_score,
          basic_score = excluded.basic_score,
          career_score = excluded.career_score,
          hobby_score = excluded.hobby_score,
          preference_score = excluded.preference_score,
          verification_score = excluded.verification_score,
          asset_score = excluded.asset_score,
          score_tier = excluded.score_tier,
          detail_json = excluded.detail_json,
          calculated_at = datetime('now'),
          updated_at = datetime('now')
      `).run(
        userId, totalScore,
        groupScores.basic || 0,
        groupScores.career || 0,
        groupScores.hobby || 0,
        groupScores.preference || 0,
        groupScores.verification || 0,
        groupScores.asset || 0,
        tier,
        detailJson
      );
    } else {
      throw e;
    }
  }

  // 同步到 users 表
  try {
    db.prepare('UPDATE users SET profile_score = ?, score_tier = ? WHERE id = ?')
      .run(totalScore, tier, userId);
  } catch (e) {
    // users 表可能没有新列，忽略
    logger.debug('[scoreEngine] sync to users table skipped:', e.message);
  }

  logger.info(`[scoreEngine] 用户${userId}评分: ${totalScore}分 (${tier})`);
  return result;
}

/**
 * 获取用户评分（优先从缓存读取，不存在则计算）
 */
function getUserScore(db, userId) {
  try {
    const cached = db.prepare('SELECT * FROM user_scores WHERE user_id = ?').get(userId);
    if (cached) return cached;
  } catch (e) {
    // 表不存在
  }
  // 未缓存，计算并保存
  recalculateAndSave(db, userId);
  try {
    return db.prepare('SELECT * FROM user_scores WHERE user_id = ?').get(userId);
  } catch (e) {
    return null;
  }
}

/**
 * 获取评分规则列表
 */
function getRules(db) {
  try {
    const rules = db.prepare('SELECT * FROM score_rules WHERE status = ? ORDER BY sort_order').all('active');
    if (rules && rules.length > 0) return rules;
  } catch (e) {
    // 表不存在
  }
  return DEFAULT_RULES;
}

/**
 * 获取各维度总分配置
 */
function getGroupMaxScores() {
  const result = {};
  for (const group of GROUP_ORDER) {
    result[group] = DEFAULT_RULES
      .filter(r => r.field_group === group)
      .reduce((sum, r) => sum + r.max_score, 0);
  }
  return result;
}

module.exports = {
  DEFAULT_RULES,
  GROUP_ORDER,
  GROUP_LABELS,
  getTier,
  getTierLabel,
  calculateScore,
  recalculateAndSave,
  getUserScore,
  getRules,
  getGroupMaxScores,
};
