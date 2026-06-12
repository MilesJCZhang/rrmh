/**
 * ReferralCodeService.js - 推荐码业务逻辑
 * 处理推荐码的生成、验证、绑定等操作
 */

const { getPool } = require('../config');

class ReferralCodeService {
  /**
   * 生成推荐码
   * @param {string} type - 类型：creator 或 public_welfare
   * @param {number} count - 生成数量
   * @param {object} options - 可选参数
   * @returns {object} 生成结果
   */
  static async generateCode(type, count, options = {}) {
    const pool = await getPool();
    const codes = [];

    try {
      for (let i = 0; i < count; i++) {
        const code = this.generateCodeString(type);
        const maxUses = options.max_uses || 0;
        const batchId = options.batch_id || null;
        const createdBy = options.created_by || null;

        await pool.execute(
          `INSERT INTO referral_codes (code, type, max_uses, batch_id, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [code, type, maxUses, batchId, createdBy]
        );

        codes.push({
          code,
          type,
          max_uses: maxUses,
          batch_id: batchId,
        });
      }

      return {
        success: true,
        data: { codes, count: codes.length },
        message: `成功生成 ${codes.length} 个推荐码`,
      };
    } catch (error) {
      console.error('[ReferralCodeService] generateCode Error:', error);
      return {
        success: false,
        data: null,
        message: '生成推荐码失败：' + error.message,
      };
    }
  }

  /**
   * 验证推荐码
   * @param {string} code - 推荐码
   * @returns {object} 验证结果
   */
  static async verifyCode(code) {
    const pool = await getPool();

    try {
      const [rows] = await pool.execute(
        `SELECT rc.*, u.nickname as referrer_name
         FROM referral_codes rc
         LEFT JOIN users u ON rc.referrer_id = u.id
         WHERE rc.code = ? AND rc.status = 'active'`,
        [code]
      );

      if (rows.length === 0) {
        return {
          valid: false,
          data: null,
          message: '推荐码不存在或已失效',
        };
      }

      const codeInfo = rows[0];

      // 检查使用次数
      if (codeInfo.max_uses > 0 && codeInfo.used_count >= codeInfo.max_uses) {
        return {
          valid: false,
          data: null,
          message: '推荐码已达到使用次数上限',
        };
      }

      // 获取类型名称
      const typeNames = {
        creator: '创作者推荐',
        public_welfare: '公益推荐',
      };

      return {
        valid: true,
        data: {
          code: codeInfo.code,
          type: codeInfo.type,
          type_name: typeNames[codeInfo.type] || codeInfo.type,
          referrer_id: codeInfo.referrer_id,
          referrer_name: codeInfo.referrer_name,
          max_uses: codeInfo.max_uses,
          used_count: codeInfo.used_count,
        },
        message: '推荐码有效',
      };
    } catch (error) {
      console.error('[ReferralCodeService] verifyCode Error:', error);
      return {
        valid: false,
        data: null,
        message: '验证推荐码失败：' + error.message,
      };
    }
  }

  /**
   * 绑定推荐码到用户
   * @param {string} code - 推荐码
   * @param {number} userId - 用户ID
   * @returns {object} 绑定结果
   */
  static async bindCode(code, userId) {
    const pool = await getPool();

    try {
      // 验证推荐码
      const verifyResult = await this.verifyCode(code);
      if (!verifyResult.valid) {
        return {
          success: false,
          data: null,
          message: verifyResult.message,
        };
      }

      // 检查用户是否已经绑定过推荐码
      const [existingReferrals] = await pool.execute(
        'SELECT id FROM user_referrals WHERE referee_id = ?',
        [userId]
      );

      if (existingReferrals.length > 0) {
        return {
          success: false,
          data: null,
          message: '您已经绑定过推荐码，不能重复绑定',
        };
      }

      const codeInfo = verifyResult.data;

      // 不能绑定自己的推荐码
      if (codeInfo.referrer_id === userId) {
        return {
          success: false,
          data: null,
          message: '不能绑定自己的推荐码',
        };
      }

      // 开始事务
      await pool.execute('START TRANSACTION');

      try {
        // 创建绑定关系
        await pool.execute(
          `INSERT INTO user_referrals (referrer_id, referee_id, referral_code, created_at)
           VALUES (?, ?, ?, NOW())`,
          [codeInfo.referrer_id, userId, code]
        );

        // 更新推荐码使用次数
        await pool.execute(
          'UPDATE referral_codes SET used_count = used_count + 1 WHERE code = ?',
          [code]
        );

        // 如果是创作者推荐码，更新referrer_id
        if (codeInfo.referrer_id) {
          await pool.execute(
            'UPDATE referral_codes SET referrer_id = ? WHERE code = ?',
            [codeInfo.referrer_id, code]
          );
        }

        await pool.execute('COMMIT');

        return {
          success: true,
          data: {
            bound: true,
            referrer_id: codeInfo.referrer_id,
            referrer_name: codeInfo.referrer_name,
            code: code,
          },
          message: '推荐码绑定成功',
        };
      } catch (error) {
        await pool.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('[ReferralCodeService] bindCode Error:', error);
      return {
        success: false,
        data: null,
        message: '绑定推荐码失败：' + error.message,
      };
    }
  }

  /**
   * 获取推荐码详情
   * @param {string} code - 推荐码
   * @returns {object|null} 推荐码详情
   */
  static async getCodeInfo(code) {
    const pool = await getPool();

    try {
      const [rows] = await pool.execute(
        `SELECT rc.*, u.nickname as referrer_name, u.phone as referrer_phone
         FROM referral_codes rc
         LEFT JOIN users u ON rc.referrer_id = u.id
         WHERE rc.code = ?`,
        [code]
      );

      if (rows.length === 0) {
        return null;
      }

      const codeInfo = rows[0];

      // 获取使用该推荐码的用户列表
      const [referees] = await pool.execute(
        `SELECT ur.referee_id, u.nickname, u.phone, ur.created_at
         FROM user_referrals ur
         LEFT JOIN users u ON ur.referee_id = u.id
         WHERE ur.referral_code = ?`,
        [code]
      );

      return {
        code: codeInfo.code,
        type: codeInfo.type,
        status: codeInfo.status,
        max_uses: codeInfo.max_uses,
        used_count: codeInfo.used_count,
        referrer_id: codeInfo.referrer_id,
        referrer_name: codeInfo.referrer_name,
        referrer_phone: codeInfo.referrer_phone,
        batch_id: codeInfo.batch_id,
        created_at: codeInfo.created_at,
        referees: referees,
      };
    } catch (error) {
      console.error('[ReferralCodeService] getCodeInfo Error:', error);
      return null;
    }
  }

  /**
   * 生成推荐码字符串
   * @param {string} type - 类型
   * @returns {string} 推荐码
   */
  static generateCodeString(type) {
    const prefix = type === 'creator' ? 'LCRG' : 'LCPW';
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4位随机数
    return `${prefix}${randomNum}`;
  }

  /**
   * 获取用户的推荐关系
   * @param {number} userId - 用户ID
   * @returns {object} 推荐关系
   */
  static async getUserReferralInfo(userId) {
    const pool = await getPool();

    try {
      // 获取用户作为推荐人的记录
      const [referrals] = await pool.execute(
        `SELECT ur.*, u.nickname as referee_name, u.phone as referee_phone
         FROM user_referrals ur
         LEFT JOIN users u ON ur.referee_id = u.id
         WHERE ur.referrer_id = ?`,
        [userId]
      );

      // 获取用户作为被推荐人的记录
      const [refereeInfo] = await pool.execute(
        `SELECT ur.*, u.nickname as referrer_name, u.phone as referrer_phone
         FROM user_referrals ur
         LEFT JOIN users u ON ur.referrer_id = u.id
         WHERE ur.referee_id = ?`,
        [userId]
      );

      return {
        as_referrer: referrals,
        as_referee: refereeInfo[0] || null,
      };
    } catch (error) {
      console.error('[ReferralCodeService] getUserReferralInfo Error:', error);
      return {
        as_referrer: [],
        as_referee: null,
      };
    }
  }
}

module.exports = ReferralCodeService;
