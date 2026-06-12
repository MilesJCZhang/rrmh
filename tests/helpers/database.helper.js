/**
 * 数据库辅助函数
 * 用于测试的数据库初始化和清理
 */

const Database = require('better-sqlite3');
const path = require('path');

/**
 * 创建内存数据库（用于测试）
 */
function createMemoryDatabase() {
  const db = new Database(':memory:');
  
  // 启用外键约束
  db.pragma('foreign_keys = ON');
  
  return db;
}

/**
 * 初始化测试数据库表结构
 */
function initTestDatabase(db) {
  // 创建 users 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE,
      nickname TEXT,
      avatar TEXT,
      phone TEXT,
      gender INTEGER,
      age INTEGER,
      role TEXT DEFAULT 'user',
      balance DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 stations 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      contact_phone TEXT,
      manager_id INTEGER,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  // 创建 partners 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      manager_id INTEGER,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      referral_code TEXT,
      id_card TEXT,
      id_card_front TEXT,
      id_card_back TEXT,
      total_earnings DECIMAL(10,2) DEFAULT 0,
      description TEXT,
      reject_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  // 创建 partner_referrals 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id)
    )
  `);

  // 创建 partner_earnings 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建 withdrawals 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      bank_account TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reject_reason TEXT,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建 referral_codes 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

/**
 * 插入测试数据
 */
function seedTestData(db) {
  // 插入测试用户
  const insertUser = db.prepare(`
    INSERT INTO users (nickname, phone, role, balance)
    VALUES (?, ?, ?, ?)
  `);

  const users = [
    ['管理员', '13800138000', 'admin', 0],
    ['测试用户1', '13800138001', 'user', 100.00],
    ['测试用户2', '13800138002', 'user', 50.00],
    ['合伙人1', '13800138003', 'partner', 200.00],
    ['合伙人2', '13800138004', 'partner', 150.00]
  ];

  for (const user of users) {
    try {
      insertUser.run(...user);
    } catch (e) {
      // 忽略重复数据
    }
  }

  // 插入测试服务站
  const insertStation = db.prepare(`
    INSERT INTO stations (name, address, contact_phone, manager_id, description, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const stations = [
    ['北京服务站', '北京市朝阳区', '010-12345678', 1, '首个服务站', 'active'],
    ['上海服务站', '上海市浦东区', '021-12345678', 2, '第二个服务站', 'active'],
    ['广州服务站', '广州市天河区', '020-12345678', null, '第三个服务站', 'inactive']
  ];

  for (const station of stations) {
    try {
      insertStation.run(...station);
    } catch (e) {
      // 忽略重复数据
    }
  }

  // 插入测试合伙人
  const insertPartner = db.prepare(`
    INSERT INTO partners (user_id, type, status, referral_code, total_earnings)
    VALUES (?, ?, ?, ?, ?)
  `);

  const partners = [
    [4, 'creator', 'approved', 'REF001', 500.00],
    [5, 'public_welfare', 'pending', null, 0]
  ];

  for (const partner of partners) {
    try {
      insertPartner.run(...partner);
    } catch (e) {
      // 忽略重复数据
    }
  }

  // 插入测试提现记录
  const insertWithdrawal = db.prepare(`
    INSERT INTO withdrawals (user_id, amount, bank_account, bank_name, account_holder, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const withdrawals = [
    [4, 100.00, '6222021234567890', '工商银行', '合伙人1', 'pending'],
    [4, 200.00, '6222021234567890', '工商银行', '合伙人1', 'approved'],
    [5, 50.00, '6222020987654321', '建设银行', '合伙人2', 'paid']
  ];

  for (const withdrawal of withdrawals) {
    try {
      insertWithdrawal.run(...withdrawal);
    } catch (e) {
      // 忽略重复数据
    }
  }
}

/**
 * 清理测试数据
 */
function cleanTestData(db) {
  db.exec(`
    DELETE FROM partner_earnings;
    DELETE FROM partner_referrals;
    DELETE FROM withdrawals;
    DELETE FROM partners;
    DELETE FROM stations;
    DELETE FROM referral_codes;
    DELETE FROM users;
  `);
}

module.exports = {
  createMemoryDatabase,
  initTestDatabase,
  seedTestData,
  cleanTestData
};
