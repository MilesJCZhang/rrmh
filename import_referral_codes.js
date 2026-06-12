/**
 * import_referral_codes.js - 将 referral_codes.json 导入数据库
 * 使用方法：node import_referral_codes.js
 */

const { getPool } = require('./config');
const fs = require('fs');
const path = require('path');

async function main() {
  let connection;
  
  try {
    console.log('📂 读取推荐码文件...');
    const jsonPath = path.join(__dirname, 'referral_codes.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ 文件不存在：', jsonPath);
      console.error('💡 请先运行 node generate_referral_codes_file.js 生成推荐码');
      process.exit(1);
    }
    
    const codes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ 读取到 ${codes.length} 个推荐码\n`);
    
    console.log('🔗 连接数据库...');
    const pool = await getPool();
    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功\n');
    
    // 创建表（如果不存在）
    console.log('📋 检查/创建数据库表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        code_type ENUM('creator', 'public_welfare') NOT NULL,
        referrer_id INT DEFAULT NULL,
        referrer_name VARCHAR(100) DEFAULT NULL,
        status ENUM('active', 'inactive', 'depleted', 'expired') DEFAULT 'active',
        use_count INT DEFAULT 0,
        max_uses INT DEFAULT 0,
        expires_at DATETIME DEFAULT NULL,
        batch_id VARCHAR(50) DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_used_at DATETIME DEFAULT NULL,
        last_bound_user_id INT DEFAULT NULL,
        last_bound_at DATETIME DEFAULT NULL,
        UNIQUE INDEX idx_code (code),
        INDEX idx_type (code_type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ 表 referral_codes 已就绪\n');
    
    // 导入数据
    console.log('📥 开始导入推荐码...\n');
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const item of codes) {
      try {
        await connection.execute(`
          INSERT IGNORE INTO referral_codes 
          (code, code_type, status, use_count, max_uses, batch_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.code,
          item.code_type,
          item.status,
          item.use_count,
          item.max_uses,
          item.batch_id,
          item.created_at,
          item.updated_at
        ]);
        importedCount++;
        console.log(`  ✅ ${item.code} (${item.code_type})`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          skippedCount++;
          console.log(`  ⚠️  ${item.code} 已存在，跳过`);
        } else {
          console.error(`  ❌ ${item.code} 导入失败：`, err.message);
        }
      }
    }
    
    console.log(`\n🎉 导入完成！`);
    console.log(`  ✅ 成功导入：${importedCount} 个`);
    console.log(`  ⚠️  跳过重复：${skippedCount} 个`);
    
    // 验证结果
    const [total] = await connection.execute('SELECT COUNT(*) as total FROM referral_codes');
    console.log(`\n📊 数据库中共有 ${total[0].total} 个推荐码`);
    
  } catch (error) {
    console.error('❌ 错误：', error.message);
    console.error('详细错误：', error);
  } finally {
    if (connection) {
      connection.release();
      console.log('\n🔌 数据库连接已释放');
    }
    process.exit(0);
  }
}

main();
