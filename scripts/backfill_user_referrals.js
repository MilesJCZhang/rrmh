/**
 * backfill_user_referrals.js
 * 
 * 历史数据补写脚本：将 referral_relationships 中已存在的推荐关系
 * 翻译为用户级关系写入 user_referrals 表
 * 
 * 用法：node scripts/backfill_user_referrals.js
 * 
 * 注意：本脚本适用于 SQLite 版本。生产环境 MySQL 版本见对应 SQL 脚本。
 */

const path = require('path');
const fs = require('fs');

// 查找数据库文件
const DB_PATHS = [
  path.join(__dirname, '..', 'renrenmeihao.db'),
  path.join(__dirname, '..', 'database', 'renrenmeihao.db'),
  path.join(__dirname, '..', 'miniprogram.db'),
];

let dbPath = null;
for (const p of DB_PATHS) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('未找到数据库文件，请手动指定 dbPath');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);

console.log('数据库路径:', dbPath);

// 确保 user_referrals 表存在
db.exec(`
  CREATE TABLE IF NOT EXISTS user_referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    referrer_id INTEGER NOT NULL,
    referral_code TEXT,
    bind_time TEXT,
    is_locked INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id)
  )
`);
console.log('✓ user_referrals 表已确认');

// 查询所有 referral_relationships 记录，关联 referral_codes 获取双方 user_id
const relationships = db.prepare(`
  SELECT 
    rr.referrer_code,
    rr.referred_code,
    rr.created_at as rel_created_at,
    rc_referee.referrer_id as referred_user_id,
    rc_referrer.referrer_id as referrer_user_id
  FROM referral_relationships rr
  LEFT JOIN referral_codes rc_referee ON rc_referee.code = rr.referred_code
  LEFT JOIN referral_codes rc_referrer ON rc_referrer.code = rr.referrer_code
`).all();

console.log(`共发现 ${relationships.length} 条 referral_relationships 记录`);

let synced = 0;
let skipped = 0;
let failed = 0;

const insertUr = db.prepare(`
  INSERT OR IGNORE INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
  VALUES (?, ?, ?, ?, 1)
`);

const updateUser = db.prepare(`
  UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)
`);

for (const rel of relationships) {
  const { referrer_code, referred_code, rel_created_at, referred_user_id, referrer_user_id } = rel;

  if (!referred_user_id || !referrer_user_id) {
    console.log(`  ⏭ 跳过 [${referrer_code} → ${referred_code}]: 双方或一方未绑定用户`);
    skipped++;
    continue;
  }

  if (referred_user_id === referrer_user_id) {
    console.log(`  ⏭ 跳过 [${referrer_code} → ${referred_code}]: 自身绑定， user_id=${referred_user_id}`);
    skipped++;
    continue;
  }

  try {
    const bindTime = rel_created_at || new Date().toISOString();
    const result = insertUr.run(referred_user_id, referrer_user_id, referred_code, bindTime);

    if (result.changes > 0) {
      // 新插入成功，同时更新 users.referrer_id
      updateUser.run(referrer_user_id, referred_user_id);
      console.log(`  ✓ 已同步: user ${referred_user_id} → ${referrer_user_id} (推荐码: ${referrer_code}→${referred_code})`);
      synced++;
    } else {
      console.log(`  ⏭ 已存在: user ${referred_user_id} 的推荐关系已存在，跳过`);
      skipped++;
    }
  } catch (e) {
    console.error(`  ✗ 失败: ${referrer_code}→${referred_code}: ${e.message}`);
    failed++;
  }
}

console.log('\n===== 补写完成 =====');
console.log(`  同步: ${synced}`);
console.log(`  跳过: ${skipped}`);
console.log(`  失败: ${failed}`);

db.close();
