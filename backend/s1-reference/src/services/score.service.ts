import prisma from '../models/prisma';

// ========== 评分规则定义 ==========
// 与 utils/scoreHelper.js 和 utils/scoreEngine.js 同步
const SCORE_RULES = [
  // 基础信息 (40分)
  { field_key: 'avatar', field_group: 'basic', field_label: '头像', max_score: 8 },
  { field_key: 'nickname', field_group: 'basic', field_label: '昵称', max_score: 5 },
  { field_key: 'gender', field_group: 'basic', field_label: '性别', max_score: 3 },
  { field_key: 'birthYear', field_group: 'basic', field_label: '出生年份', max_score: 3 },
  { field_key: 'city', field_group: 'basic', field_label: '城市', max_score: 3 },
  { field_key: 'phone', field_group: 'basic', field_label: '手机号', max_score: 3 },
  { field_key: 'wechatAccount', field_group: 'basic', field_label: '微信号', max_score: 3 },
  { field_key: 'education', field_group: 'basic', field_label: '学历', max_score: 4 },
  { field_key: 'marital_status', field_group: 'basic', field_label: '婚姻状态', max_score: 3 },
  { field_key: 'intro', field_group: 'basic', field_label: '自我介绍', max_score: 5 },
  // 职业收入 (15分)
  { field_key: 'occupation', field_group: 'career', field_label: '职业', max_score: 5 },
  { field_key: 'income', field_group: 'career', field_label: '收入', max_score: 5 },
  { field_key: 'has_property', field_group: 'career', field_label: '房产', max_score: 3 },
  { field_key: 'has_car', field_group: 'career', field_label: '车辆', max_score: 2 },
  // 兴趣爱好 (15分)
  { field_key: 'health_tags', field_group: 'hobby', field_label: '健康标签', max_score: 5 },
  { field_key: 'sleep_habit', field_group: 'hobby', field_label: '作息习惯', max_score: 3 },
  { field_key: 'sport_habit', field_group: 'hobby', field_label: '运动习惯', max_score: 3 },
  { field_key: 'diet_tags', field_group: 'hobby', field_label: '饮食偏好', max_score: 2 },
  { field_key: 'smoking', field_group: 'hobby', field_label: '抽烟', max_score: 1 },
  { field_key: 'drinking', field_group: 'hobby', field_label: '饮酒', max_score: 1 },
  // 择偶需求 (10分)
  { field_key: 'expect_age_min', field_group: 'preference', field_label: '期望年龄', max_score: 3 },
  { field_key: 'expect_education', field_group: 'preference', field_label: '期望学历', max_score: 2 },
  { field_key: 'expect_income', field_group: 'preference', field_label: '期望收入', max_score: 2 },
  { field_key: 'marriage_expect', field_group: 'preference', field_label: '感情态度', max_score: 3 },
  // 认证 (12分)
  { field_key: 'idVerification', field_group: 'verification', field_label: '身份证验证', max_score: 5 },
  { field_key: 'faceAuth', field_group: 'verification', field_label: '人脸认证', max_score: 7 },
  // 资产 (8分)
  { field_key: 'propertyProof', field_group: 'asset', field_label: '房产证明', max_score: 3 },
  { field_key: 'vehicleProof', field_group: 'asset', field_label: '车辆证明', max_score: 2 },
  { field_key: 'bankDepositProof', field_group: 'asset', field_label: '银行存款', max_score: 2 },
  { field_key: 'insuranceProof', field_group: 'asset', field_label: '保险证明', max_score: 1 },
];

const GROUP_ORDER = ['basic', 'career', 'hobby', 'preference', 'verification', 'asset'];
const GROUP_LABELS: Record<string, string> = {
  basic: '基础信息', career: '职业收入', hobby: '兴趣爱好',
  preference: '择偶需求', verification: '认证', asset: '资产',
};

const TIER_LABELS: Record<string, string> = {
  gold: '优质', silver: '良好', bronze: '基础', unrated: '未建档',
};

function getTier(score: number): string {
  if (score >= 80) return 'gold';
  if (score >= 60) return 'silver';
  if (score > 0) return 'bronze';
  return 'unrated';
}

function isFieldFilled(fieldKey: string, userData: any, memberData: any | null): boolean {
  // 先从 userData 取，再从 memberData (single_members) 取
  let val = userData?.[fieldKey];
  if (val === undefined || val === null) {
    val = memberData?.[fieldKey];
  }

  // 特殊映射
  switch (fieldKey) {
    case 'idVerification':
      return !!(memberData?.idCardFrontUrl || userData?.id_card_front_image) &&
             !!(memberData?.idCardBackUrl || userData?.id_card_back_image);
    case 'faceAuth':
      return (userData?.face_auth_status || 'none') === 'approved';
    case 'propertyProof':
      return !!(memberData?.propertyImages && memberData.propertyImages !== '[]') ||
             !!(userData?.property_images && userData.property_images !== '[]');
    case 'vehicleProof':
      return !!(memberData?.vehicleImages && memberData.vehicleImages !== '[]') ||
             !!(userData?.vehicle_images && userData.vehicle_images !== '[]');
    case 'bankDepositProof':
      return !!(memberData?.bankDepositProof || userData?.bank_deposit_proof);
    case 'insuranceProof':
      return !!(memberData?.insuranceProof || userData?.insurance_proof);
    case 'has_property':
      return !!(val && val !== '0' && val !== '否');
    case 'has_car':
      return !!(val && val !== '0' && val !== '否');
  }

  if (val === undefined || val === null || val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

export interface ScoreResult {
  totalScore: number;
  tier: string;
  tierLabel: string;
  groupScores: Record<string, number>;
  detail: Record<string, { label: string; maxScore: number; earnedScore: number; filled: boolean }>;
  missingFields: { key: string; label: string; maxScore: number }[];
}

export async function calculateAndSaveScore(userId: number): Promise<ScoreResult> {
  const [user, member] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.single_members.findUnique({ where: { userId } }),
  ]);

  if (!user) {
    return {
      totalScore: 0, tier: 'unrated', tierLabel: '未建档',
      groupScores: {}, detail: {}, missingFields: [],
    };
  }

  const memberData = member ? {
    ...member,
    intro: member.description,
    marital_status: member.marriage,
    birthYear: member.birthYear,
    education: member.education,
    occupation: member.occupation,
    income: member.income,
    has_property: member.hasProperty === '是' ? 1 : 0,
    has_car: member.hasCar === '是' ? 1 : 0,
    id_card_front_image: member.idCardFrontUrl,
    id_card_back_image: member.idCardBackUrl,
  } : null;

  const userData = {
    avatar: user.avatar,
    nickname: user.nickname,
    gender: user.gender,
    birthYear: user.birthDate?.getFullYear(),
    city: user.city,
    phone: user.phone,
    wechatAccount: user.wechatAccount,
    education: user.education,
    marital_status: user.marital_status,
    intro: user.intro,
    occupation: user.occupation,
    income: user.income,
    has_property: user.has_property,
    has_car: user.has_car,
    health_tags: user.health_tags,
    sleep_habit: user.sleep_habit,
    sport_habit: user.sport_habit,
    diet_tags: user.diet_tags,
    smoking: user.smoking,
    drinking: user.drinking,
    expect_age_min: user.expect_age_min,
    expect_age_max: user.expect_age_max,
    expect_education: user.expect_education,
    expect_income: user.expect_income,
    marriage_expect: user.marriage_expect,
  };

  const detail: Record<string, any> = {};
  const groupScores: Record<string, number> = {};
  let totalScore = 0;

  for (const group of GROUP_ORDER) {
    let groupTotal = 0;
    const groupRules = SCORE_RULES.filter(r => r.field_group === group);
    for (const rule of groupRules) {
      const filled = isFieldFilled(rule.field_key, userData, memberData);
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

  totalScore = Math.min(totalScore, 100);
  const tier = getTier(totalScore);

  // 保存到 users 表
  await prisma.users.update({
    where: { id: userId },
    data: { profile_score: totalScore, score_tier: tier },
  });

  // 也保存到 user_scores 表
  try {
    const detailJson = JSON.stringify(
      Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, v.earnedScore]))
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO user_scores (user_id, total_score, basic_score, career_score,
        hobby_score, preference_score, verification_score, asset_score,
        score_tier, detail_json, calculated_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score),
        basic_score = VALUES(basic_score),
        career_score = VALUES(career_score),
        hobby_score = VALUES(hobby_score),
        preference_score = VALUES(preference_score),
        verification_score = VALUES(verification_score),
        asset_score = VALUES(asset_score),
        score_tier = VALUES(score_tier),
        detail_json = VALUES(detail_json),
        calculated_at = NOW(),
        updated_at = NOW()
    `, userId, totalScore,
      groupScores.basic || 0, groupScores.career || 0,
      groupScores.hobby || 0, groupScores.preference || 0,
      groupScores.verification || 0, groupScores.asset || 0,
      tier, detailJson
    );
  } catch (e: any) {
    console.error('[score.service] save to user_scores failed:', e.message);
  }

  // 构建缺失字段
  const missingFields = Object.entries(detail)
    .filter(([, v]) => !v.filled)
    .map(([k, v]) => ({ key: k, label: v.label, maxScore: v.maxScore }));

  console.log(`[score.service] 用户${userId}评分: ${totalScore}分 (${tier})`);

  return {
    totalScore,
    tier,
    tierLabel: TIER_LABELS[tier] || '未知',
    groupScores,
    detail,
    missingFields,
  };
}
