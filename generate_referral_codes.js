/**
 * generate_referral_codes.js - 一键生成推荐码脚本
 * 使用方法：node generate_referral_codes.js
 */

const { getPool } = require('./config');
const crypto = require('crypto');

// ========== 配置参数 ==========
const GENERATE_COUNT = 10;  // 生成数量
const CODE_TYPE = 'creator'; // 类型：creator 或 public_welfare
// ==================================================

async function main() {
  let connection;
  
  try {
    console.log('🔗 连接数据库...');
    const pool = await getPool();
    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功\n');

    // 1. 创建表（如果不存在）
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
        INDEX idx_code (code),
        INDEX idx_type (code_type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ 表 referral_codes 已就绪\n');

    // 2. 生成推荐码
    console.log(`🎲 开始生成 ${GENERATE_COUNT} 个推荐码（类型：${CODE_TYPE}）...\n`);
    
    const generatedCodes = [];
    const batchId = `BATCH_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    for (let i = 0; i < GENERATE_COUNT; i++) {
      let code = '';
      let isUnique = false;
      let attempts = 0;

      // 生成唯一推荐码
      while (!isUnique && attempts < 10) {
        const prefix = CODE_TYPE === 'creator' ? 'LCRG' : 'GYRG';
        const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
        code = `${prefix}${randomSuffix}`;

        // 检查唯一性
        const [existing] = await connection.execute(
          'SELECT id FROM referral_codes WHERE code = ?',
          [code]
        );

        if (existing.length === 0) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        console.warn(`⚠️  第 ${i + 1} 个推荐码生成失败（重试次数过多）`);
        continue;
      }

      // 插入数据库
      await connection.execute(
        `INSERT INTO referral_codes (code, code_type, batch_id, status)
         VALUES (?, ?, ?, 'active')`,
        [code, CODE_TYPE, batchId]
      );

      generatedCodes.push(code);
      console.log(`  ${i + 1}. ✅ ${code}`);
    }

    console.log(`\n🎉 成功生成 ${generatedCodes.length} 个推荐码！`);
    console.log(`📦 批次号：${batchId}\n`);

    // 3. 显示所有推荐码
    console.log('╔══════════════════════════════════════╗');
    console.log('║          生成的推荐码列表              ║');
    console.log('╠══════════════════════════════════════╣');
    generatedCodes.forEach((code, index) => {
      console.log(`║ ${(index + 1).toString().padStart(2, ' ')}. ${code}                    ║`);
    });
    console.log('╚══════════════════════════════════════╝\n');

    // 4. 验证结果
    const [totalCodes] = await connection.execute(
      'SELECT COUNT(*) as total FROM referral_codes'
    );
    console.log(`📊 数据库中共有 ${totalCodes[0].total} 个推荐码`);

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
