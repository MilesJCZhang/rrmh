// server/models/ReferralCode.js - 推荐码数据模型
// 映射 referral_codes 表

const db = require('../config/database'); // 假设已有数据库连接配置

class ReferralCode {
  /**
   * 根据推荐码查询
   * @param {string} code - 推荐码
   * @returns {Promise<Object|null>}
   */
  static async findByCode(code) {
    const sql = 'SELECT * FROM referral_codes WHERE code = ? LIMIT 1';
    const [rows] = await db.execute(sql, [code.toUpperCase()]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建推荐码
   * @param {Object} data - 推荐码数据
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const {
      code,
      code_type,
      referrer_id = null,
      max_uses = 0,
      batch_id = null,
      notes = '',
    } = data;

    const sql = `
      INSERT INTO referral_codes (code, code_type, referrer_id, max_uses, batch_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const [result] = await db.execute(sql, [
      code.toUpperCase(),
      code_type,
      referrer_id,
      max_uses,
      batch_id,
      notes,
    ]);

    return { id: result.insertId, code, code_type };
  }

  /**
   * 增加使用次数（事务内使用，需配合 SELECT ... FOR UPDATE）
   * @param {string} code - 推荐码
   * @param {number} userId - 绑定用户ID
   * @returns {Promise<boolean>}
   */
  static async incrementUseCount(code, userId) {
    const sql = `
      UPDATE referral_codes 
      SET use_count = use_count + 1,
          last_used_at = NOW(),
          last_bound_user_id = ?,
          last_bound_at = NOW()
      WHERE code = ?
    `;
    
    const [result] = await db.execute(sql, [userId, code.toUpperCase()]);
    return result.affectedRows > 0;
  }

  /**
   * 更新推荐码状态
   * @param {string} code - 推荐码
   * @param {string} status - 新状态
   * @returns {Promise<boolean>}
   */
  static async updateStatus(code, status) {
    const sql = 'UPDATE referral_codes SET status = ?, updated_at = NOW() WHERE code = ?';
    const [result] = await db.execute(sql, [status, code.toUpperCase()]);
    return result.affectedRows > 0;
  }

  /**
   * 检查推荐码是否可用
   * @param {Object} codeRecord - 推荐码记录
   * @returns {boolean}
   */
  static isValid(codeRecord) {
    if (!codeRecord) return false;
    if (codeRecord.status !== 'active') return false;
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) return false;
    if (codeRecord.max_uses > 0 && codeRecord.use_count >= codeRecord.max_uses) return false;
    return true;
  }

  /**
   * 根据批次号查询
   * @param {string} batchId - 批次号
   * @returns {Promise<Array>}
   */
  static async findByBatchId(batchId) {
    const sql = 'SELECT * FROM referral_codes WHERE batch_id = ? ORDER BY created_at DESC';
    const [rows] = await db.execute(sql, [batchId]);
    return rows;
  }
}

module.exports = ReferralCode;
