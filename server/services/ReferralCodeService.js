// server/services/ReferralCodeService.js - 推荐码业务逻辑
// 封装推荐码相关业务逻辑，包含事务控制

const ReferralCode = require('../models/ReferralCode');
const db = require('../config/database');

class ReferralCodeService {
  /**
   * 验证推荐码有效性
   * @param {string} code - 推荐码
   * @returns {Promise<Object>} {valid: boolean, data: Object, message: string}
   */
  static async verifyCode(code) {
    try {
      if (!code || code.trim() === '') {
        return { valid: false, data: null, message: '推荐码不能为空' };
      }

      const codeRecord = await ReferralCode.findByCode(code);
      
      if (!codeRecord) {
        return { valid: false, data: null, message: '推荐码不存在' };
      }

      if (!ReferralCode.isValid(codeRecord)) {
        let message = '推荐码无效';
        if (codeRecord.status !== 'active') {
          message = `推荐码已${codeRecord.status === 'inactive' ? '停用' : codeRecord.status === 'expired' ? '过期' : '用完'}`;
        } else if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
          message = '推荐码已过期';
        } else if (codeRecord.max_uses > 0 && codeRecord.use_count >= codeRecord.max_uses) {
          message = '推荐码已达到使用次数上限';
        }
        return { valid: false, data: null, message };
      }

      const typeNameMap = {
        'creator': '联创推荐官',
        'public_welfare': '公益推荐官',
        'professional': '专业推荐官',
        'community_station': '社区服务站',
        'city_partner': '城市合伙人',
      };

      return {
        valid: true,
        data: {
          code: codeRecord.code,
          type: codeRecord.code_type,
          type_name: typeNameMap[codeRecord.code_type] || '推荐官',
          referrer_id: codeRecord.referrer_id,
          referrer_name: '', // 需要从用户表联查，这里先返回空
          use_count: codeRecord.use_count,
          max_uses: codeRecord.max_uses,
          status: codeRecord.status,
        },
        message: '推荐码有效',
      };
    } catch (error) {
      console.error('[ReferralCodeService.verifyCode] Error:', error);
      return { valid: false, data: null, message: '验证推荐码时发生错误' };
    }
  }

  /**
   * 绑定推荐码到用户（使用事务 + 行级锁）
   * @param {string} code - 推荐码
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} {success: boolean, data: Object, message: string}
   */
  static async bindCode(code, userId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // 1. 查询推荐码并加行级锁（防止并发）
      const [rows] = await connection.execute(
        'SELECT * FROM referral_codes WHERE code = ? FOR UPDATE',
        [code.toUpperCase()]
      );

      if (rows.length === 0) {
        await connection.rollback();
        return { success: false, data: null, message: '推荐码不存在' };
      }

      const codeRecord = rows[0];

      // 2. 验证推荐码状态
      if (!ReferralCode.isValid(codeRecord)) {
        await connection.rollback();
        let message = '推荐码无效';
        if (codeRecord.status !== 'active') {
          message = `推荐码已${codeRecord.status === 'inactive' ? '停用' : codeRecord.status === 'expired' ? '过期' : '用完'}`;
        }
        return { success: false, data: null, message };
      }

      // 3. 增加使用次数
      await connection.execute(
        `UPDATE referral_codes 
         SET use_count = use_count + 1,
             last_used_at = NOW(),
             last_bound_user_id = ?,
             last_bound_at = NOW()
         WHERE code = ?`,
        [userId, code.toUpperCase()]
      );

      // 4. 记录推荐关系（假设有 user_referrals 表）
      // 如果不存在此表，可以注释掉或创建
      try {
        await connection.execute(
          `INSERT INTO user_referrals (user_id, referrer_id, bind_type, code, created_at)
           VALUES (?, ?, 'code', ?, NOW())`,
          [userId, codeRecord.referrer_id || 0, code.toUpperCase()]
        );
      } catch (err) {
        // 如果 user_referrals 表不存在，忽略错误（表会在后续迁移中创建）
        console.warn('[ReferralCodeService.bindCode] user_referrals table may not exist:', err.message);
      }

      // 5. 如果达到最大使用次数，更新状态为 depleted
      if (codeRecord.max_uses > 0) {
        const [updatedRows] = await connection.execute(
          'SELECT use_count, max_uses FROM referral_codes WHERE code = ?',
          [code.toUpperCase()]
        );
        
        if (updatedRows.length > 0 && updatedRows[0].use_count >= updatedRows[0].max_uses) {
          await connection.execute(
            'UPDATE referral_codes SET status = ? WHERE code = ?',
            ['depleted', code.toUpperCase()]
          );
        }
      }

      await connection.commit();

      return {
        success: true,
        data: {
          bound: true,
          referrer_id: codeRecord.referrer_id,
          code: codeRecord.code,
          type: codeRecord.code_type,
        },
        message: '绑定成功',
      };
    } catch (error) {
      await connection.rollback();
      console.error('[ReferralCodeService.bindCode] Error:', error);
      return { success: false, data: null, message: '绑定推荐码时发生错误' };
    } finally {
      connection.release();
    }
  }

  /**
   * 生成推荐码（管理后台）
   * @param {string} type - 类型：creator/public_welfare
   * @param {number} count - 生成数量
   * @param {Object} options - 可选参数
   * @param {number} options.max_uses - 最大使用次数（0=无限制）
   * @param {string} options.batch_id - 批次号
   * @param {number} options.created_by - 创建者管理员ID
   * @returns {Promise<Object>} {success: boolean, data: Array, message: string}
   */
  static async generateCode(type, count, options = {}) {
    try {
      const { max_uses = 0, batch_id = null, created_by = null, referrer_id = null } = options;

      // 验证类型（五类身份）
      const allowedTypes = ['creator', 'public_welfare', 'professional', 'community_station', 'city_partner'];
      if (!allowedTypes.includes(type)) {
        return { success: false, data: null, message: '推荐码类型无效' };
      }

      // 生成批次号（如果未提供）
      const finalBatchId = batch_id || `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const generatedCodes = [];

      for (let i = 0; i < count; i++) {
        // 生成唯一推荐码
        let code = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
          const prefixMap = {
            'creator': 'LCRG',
            'public_welfare': 'GYRG',
            'professional': 'ZYRG',
            'community_station': 'SQZD',
            'city_partner': 'CSHH',
          };
          const prefix = prefixMap[type] || 'GYRG';
          const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
          code = `${prefix}${randomSuffix}`;

          const existing = await ReferralCode.findByCode(code);
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          console.warn(`[ReferralCodeService.generateCode] Failed to generate unique code after 10 attempts, skiping index ${i}`);
          continue;
        }

        // 创建推荐码
        const result = await ReferralCode.create({
          code,
          code_type: type,
          referrer_id,  // 添加 referrer_id 支持
          max_uses,
          batch_id: finalBatchId,
          created_by,
        });

        generatedCodes.push({
          code: result.code,
          type: result.code_type,
          max_uses,
          batch_id: finalBatchId,
          referrer_id,  // 返回 referrer_id
        });
      }

      return {
        success: true,
        data: {
          codes: generatedCodes,
          count: generatedCodes.length,
          batch_id: finalBatchId,
        },
        message: `成功生成 ${generatedCodes.length} 个推荐码`,
      };
    } catch (error) {
      console.error('[ReferralCodeService.generateCode] Error:', error);
      return { success: false, data: null, message: '生成推荐码时发生错误' };
    }
  }

  /**
   * 查询推荐码详情
   * @param {string} code - 推荐码
   * @returns {Promise<Object|null>}
   */
  static async getCodeInfo(code) {
    try {
      const codeRecord = await ReferralCode.findByCode(code);
      
      if (!codeRecord) {
        return null;
      }

      const typeNameMap = {
        'creator': '联创推荐官',
        'public_welfare': '公益推荐官',
        'professional': '专业推荐官',
        'community_station': '社区服务站',
        'city_partner': '城市合伙人',
      };

      return {
        code: codeRecord.code,
        type: codeRecord.code_type,
        type_name: typeNameMap[codeRecord.code_type] || '推荐官',
        referrer_id: codeRecord.referrer_id,
        status: codeRecord.status,
        use_count: codeRecord.use_count,
        max_uses: codeRecord.max_uses,
        created_at: codeRecord.created_at,
        expires_at: codeRecord.expires_at,
        last_used_at: codeRecord.last_used_at,
        batch_id: codeRecord.batch_id,
      };
    } catch (error) {
      console.error('[ReferralCodeService.getCodeInfo] Error:', error);
      return null;
    }
  }
}

module.exports = ReferralCodeService;
