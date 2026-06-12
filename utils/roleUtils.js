/**
 * utils/roleUtils.js - 角色计算工具
 *
 * 角色计算规则（优先级从高到低）：
 * 1. 从 referral_codes 表查询：用户的推荐码类型决定角色
 * 2. 从 users.role 字段获取：兼容逗号分隔的多角色
 * 3. 从 partners/stations 表补充角色
 */

const ROLE_CODE_TYPE_MAP = {
  'public_welfare': 'public_matchmaker',
  'creator': 'partner_matchmaker',
  'professional': 'professional_recommender',
  'community_station': 'community_station',
  'city_partner': 'city_franchisee',
};

/**
 * 执行数据库查询（兼容 SQLite 和 MySQL）
 * @param {Object} db - 数据库连接
 * @param {string} sql - SQL 查询
 * @param {Array} params - 查询参数
 * @returns {Array} 查询结果数组
 */
function queryDB(db, sql, params) {
  try {
    // 尝试 SQLite 语法 (better-sqlite3)
    if (typeof db.prepare === 'function') {
      const stmt = db.prepare(sql);
      return stmt.all(...(params || []));
    }
  } catch (e) {
    // SQLite 失败，尝试 MySQL 语法
  }

  try {
    // 尝试 MySQL 语法 (mysql2 pool)
    if (typeof db.execute === 'function') {
      const [rows] = db.execute(sql, params || []);
      return rows || [];
    }
  } catch (e) {
    // MySQL 也失败
  }

  return [];
}

/**
 * 执行数据库查询（获取单行，兼容 SQLite 和 MySQL）
 * @param {Object} db - 数据库连接
 * @param {string} sql - SQL 查询
 * @param {Array} params - 查询参数
 * @returns {Object|null} 查询结果
 */
function queryDBGet(db, sql, params) {
  try {
    // 尝试 SQLite 语法
    if (typeof db.prepare === 'function') {
      const stmt = db.prepare(sql);
      return stmt.get(...(params || []));
    }
  } catch (e) {
    // SQLite 失败
  }

  try {
    // 尝试 MySQL 语法
    if (typeof db.execute === 'function') {
      const [rows] = db.execute(sql, params || []);
      return rows && rows[0] ? rows[0] : null;
    }
  } catch (e) {
    // MySQL 也失败
  }

  return null;
}

/**
 * 计算用户的所有角色
 * @param {Object} db - 数据库连接（better-sqlite3 或 mysql2 pool）
 * @param {Object} user - 用户对象
 * @returns {Array} 角色列表
 */
function calculateUserRoles(db, user) {
  const roleList = [];

  // 1. 从 referral_codes 表查询（主要来源，最高优先级）
  // 推荐码类型（codeType）对应用户角色
  try {
    const referralRows = queryDB(db,
      'SELECT codeType, code_type FROM referral_codes WHERE referrerId = ? OR referrer_id = ?',
      [user.id, user.id]
    );

    for (const row of referralRows) {
      const codeType = row.codeType || row.code_type;
      const role = ROLE_CODE_TYPE_MAP[codeType];
      if (role && !roleList.includes(role)) {
        roleList.push(role);
      }
    }
  } catch (e) {
    // referral_codes 表可能不存在，忽略错误
  }

  // 2. 从 users.role 字段获取（兼容逗号分隔的多角色存储）
  if (user.role) {
    if (user.role.includes(',')) {
      const roles = user.role.split(',').map(r => r.trim()).filter(Boolean);
      for (const r of roles) {
        if (!roleList.includes(r)) {
          roleList.push(r);
        }
      }
    } else {
      if (!roleList.includes(user.role)) {
        roleList.push(user.role);
      }
    }
  }

  // 3. 从 partners 表补充角色
  try {
    const partner = queryDBGet(db,
      'SELECT * FROM partners WHERE user_id = ?',
      [user.id]
    );
    if (partner) {
      if (partner.type === 'creator' && !roleList.includes('partner_matchmaker')) {
        roleList.push('partner_matchmaker');
      } else if (partner.type === 'public_welfare' && !roleList.includes('public_matchmaker')) {
        roleList.push('public_matchmaker');
      }
    }
  } catch (e) {
    // partners 表可能不存在，忽略错误
  }

  // 4. 从 stations 表补充角色（作为站长）
  try {
    const station = queryDBGet(db,
      'SELECT * FROM stations WHERE manager_id = ?',
      [user.id]
    );
    if (station && !roleList.includes('community_station')) {
      roleList.push('community_station');
    }
  } catch (e) {
    // stations 表可能不存在，忽略错误
  }

  // 5. 如果没有任何角色，添加默认角色
  if (roleList.length === 0) {
    roleList.push('user');
  }

  // 去重并返回
  return [...new Set(roleList)];
}

module.exports = {
  calculateUserRoles,
  ROLE_CODE_TYPE_MAP,
};
