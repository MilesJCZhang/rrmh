/**
 * config.js - 数据库配置
 * 使用 better-sqlite3 提供数据库连接
 */

const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'renrenmei.db');

// 创建数据库连接
let db;

function getDB() {
  if (!db) {
    db = new Database(dbPath);
    console.log(`[DB] 数据库连接成功: ${dbPath}`);
  }
  return db;
}

/**
 * 获取数据库连接（兼容 mysql 的 pool 接口）
 * @returns {Object} 包含 query 方法的对象
 */
async function getPool() {
  const database = getDB();
  
  // 返回一个兼容 mysql pool 接口的对象
  return {
    execute: (sql, params = []) => {
      try {
        const stmt = database.prepare(sql);
        
        // 判断是查询还是修改操作
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const rows = stmt.all(...params);
          return [rows, []];
        } else {
          const result = stmt.run(...params);
          return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }, []];
        }
      } catch (err) {
        console.error('[DB] 执行SQL失败:', err.message);
        throw err;
      }
    }
  };
}

module.exports = {
  getPool,
  getDB,
};
