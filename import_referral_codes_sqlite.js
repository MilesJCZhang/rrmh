/**
 * import_referral_codes_sqlite.js - 使用 SQLite 导入推荐码
 * 无需安装 MySQL 服务器
 * 使用方法：node import_referral_codes_sqlite.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function main() {
  let db;
  
  try {
    console.log('📂 准备数据库...');
    
    // 创建/打开 SQLite 数据库
    const dbPath = path.join(__dirname, 'renrenmei.db');
    db = new Database(dbPath);
    console.log('✅ 数据库已打开：', dbPath, '\n');
    
    // 创建表
    console.log('📋 创建表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        code_type TEXT NOT NULL,
        referrer_id INTEGER,
        referrer_name TEXT,
        status TEXT DEFAULT 'active',
        use_count INTEGER DEFAULT 0,
        max_uses INTEGER DEFAULT 0,
        expires_at TEXT,
        batch_id TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT,
        last_bound_user_id INTEGER,
        last_bound_at TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_code ON referral_codes(code);
      CREATE INDEX IF NOT EXISTS idx_type ON referral_codes(code_type);
      CREATE INDEX IF NOT EXISTS idx_status ON referral_codes(status);
    `);
    console.log('✅ 表已就绪\n');
    
    // 读取推荐码
    console.log('📂 读取推荐码文件...');
    const jsonPath = path.join(__dirname, 'referral_codes.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ 文件不存在：', jsonPath);
      console.error('💡 请先运行 node generate_referral_codes_file.js');
      process.exit(1);
    }
    
    const codes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ 读取到 ${codes.length} 个推荐码\n`);
    
    // 导入数据
    console.log('📥 开始导入...\n');
    const insert = db.prepare(`
      INSERT OR IGNORE INTO referral_codes 
      (code, code_type, status, use_count, max_uses, batch_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((codes) => {
      for (const item of codes) {
        try {
          insert.run(
            item.code,
            item.code_type,
            item.status,
            item.use_count,
            item.max_uses,
            item.batch_id,
            item.created_at,
            item.updated_at
          );
        } catch (err) {
          // 忽略重复错误
        }
      }
    });
    
    transaction(codes);
    
    // 统计
    const count = db.prepare('SELECT COUNT(*) as total FROM referral_codes').get();
    const newCount = db.prepare("SELECT COUNT(*) as total FROM referral_codes WHERE created_at > datetime('now', '-1 hour')").get();
    
    console.log(`🎉 导入完成！`);
    console.log(`  ✅ 数据库共有：${count.total} 个推荐码`);
    
    // 显示前10个
    const allCodes = db.prepare('SELECT code, code_type, status FROM referral_codes LIMIT 10').all();
    console.log('\n📊 前10个推荐码：');
    console.log('═'.repeat(60));
    allCodes.forEach((c, i) => {
      const typeName = c.code_type === 'creator' ? '联创' : '公益';
      const statusName = c.status === 'active' ? '✅有效' : '❌无效';
      console.log(`  ${String(i + 1).padStart(2, ' ')}. ${c.code.padEnd(12, ' ')} [${typeName}] ${statusName}`);
    });
    console.log('═'.repeat(60));
    
    console.log('\n💡 提示：');
    console.log('  1. 数据库文件：', dbPath);
    console.log('  2. 可以使用 DB Browser for SQLite 打开查看');
    console.log('  3. 或修改后端使用 SQLite 替代 MySQL\n');
    
  } catch (error) {
    console.error('❌ 错误：', error.message);
    console.error('详细：', error);
  } finally {
    if (db) {
      db.close();
      console.log('🔌 数据库连接已关闭');
    }
    process.exit(0);
  }
}

main();
