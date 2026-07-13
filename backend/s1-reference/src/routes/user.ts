import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

/**
 * PUT /v1/user/profile/update
 * 更新用户资料（注册/编辑资料时调用）
 *
 * 前端 register.js 发送的字段（camelCase）：
 *   nickname, gender, age, birthDate, height, education, maritalStatus, childrenStatus,
 *   smoking, drinking, sportHabit, dietHabit, petHabit,
 *   intro, locationCity, locationDistrict, occupation, income,
 *   housingStatus, carStatus,
 *   expectGender, expectAgeMin, expectAgeMax,
 *   expectHeightMin, expectHeightMax, expectEducation, expectIncome, expectMaritalStatus,
 *   id_card_front_image, id_card_back_image,
 *   property_images, vehicle_images, bank_deposit_proof, insurance_proof, finance_proof
 *
 * Prisma User 模型字段（snake_case）：
 *   nickname, gender, age, birth_date, height, education, marital_status, children_status,
 *   smoking, drinking, sport_habit, diet_habit, pet_habit,
 *   intro, location_city, location_district, occupation, income,
 *   housing_status, car_status,
 *   expect_gender, expect_age_min, expect_age_max,
 *   expect_height_min, expect_height_max, expect_education, expect_income, expect_marital_status,
 *   id_card_front_image, id_card_back_image,
 *   property_images, vehicle_images, bank_deposit_proof, insurance_proof, finance_proof
 */
router.put('/profile/update', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return error(res, '用户未登录', 401);
    }

    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return error(res, '没有需要更新的字段', 400);
    }

    // camelCase -> snake_case 字段名映射
    const fieldMapping: Record<string, string> = {
      birthDate: 'birth_date',
      maritalStatus: 'marital_status',
      childrenStatus: 'children_status',
      sportHabit: 'sport_habit',
      dietHabit: 'diet_habit',
      petHabit: 'pet_habit',
      locationCity: 'location_city',
      locationDistrict: 'location_district',
      housingStatus: 'housing_status',
      carStatus: 'car_status',
      expectGender: 'expect_gender',
      expectAgeMin: 'expect_age_min',
      expectAgeMax: 'expect_age_max',
      expectHeightMin: 'expect_height_min',
      expectHeightMax: 'expect_height_max',
      expectEducation: 'expect_education',
      expectIncome: 'expect_income',
      expectMaritalStatus: 'expect_marital_status',
      idCardFrontImage: 'id_card_front_image',
      idCardBackImage: 'id_card_back_image',
      propertyImages: 'property_images',
      vehicleImages: 'vehicle_images',
      bankDepositProof: 'bank_deposit_proof',
      insuranceProof: 'insurance_proof',
      financeProof: 'finance_proof',
    };

    // 构建 Prisma update 数据（只保留 Prisma 模型已有的字段）
    const updateData: any = {};
    const receivedFields: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const prismaField = fieldMapping[key] || key;
      updateData[prismaField] = value;
      receivedFields.push(`${key} -> ${prismaField}`);
    }

    console.log(`[user/profile/update] 用户${userId} 更新字段:`, receivedFields);

    if (Object.keys(updateData).length === 0) {
      return error(res, '没有需要更新的字段', 400);
    }

    // 执行更新
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log(`[user/profile/update] 用户${userId} 更新成功, score_tier=${updatedUser.score_tier}`);

    return success(res, {
      id: updatedUser.id,
      nickname: updatedUser.nickname,
      profileScore: updatedUser.profile_score || 0,
      scoreTier: updatedUser.score_tier || 'unrated',
    }, '更新成功');

  } catch (err: any) {
    console.error('[user/profile/update] 错误详情:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    });
    // 返回详细错误，便于前端调试
    return res.status(500).json({
      code: -1,
      message: '更新失败',
      error: err.message || String(err),
      ...(err.meta && { meta: err.meta }),
    });
  }
});

/**
 * GET /v1/user/profile
 * 获取当前登录用户的完整资料
 */
router.get('/profile', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return error(res, '用户未登录', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return error(res, '用户不存在', 404);
    }

    return success(res, user, '获取成功');
  } catch (err: any) {
    console.error('[user/profile] 错误详情:', err);
    return error(res, err.message || '获取失败', 500);
  }
});

export default router;
