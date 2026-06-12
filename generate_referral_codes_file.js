/**
 * generate_referral_codes_file.js - 生成推荐码（文件存储版）
 * 无需数据库，直接生成推荐码并保存到 JSON 文件
 * 使用方法：node generate_referral_codes_file.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========== 配置参数 ==========
const GENERATE_COUNT = 10;  // 生成数量
const CODE_TYPE = 'creator'; // 类型：creator 或 public_welfare
const OUTPUT_FILE = 'referral_codes.json'; // 输出文件
// ==================================================

function generateCode(type) {
  const prefix = type === 'creator' ? 'LCRG' : 'GYRG';
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}${randomSuffix}`;
}

function main() {
  try {
    console.log('🎲 开始生成推荐码...\n');
    
    // 读取现有推荐码（如果文件存在）
    let existingCodes = [];
    const outputPath = path.join(__dirname, OUTPUT_FILE);
    
    if (fs.existsSync(outputPath)) {
      const fileContent = fs.readFileSync(outputPath, 'utf8');
      existingCodes = JSON.parse(fileContent);
      console.log(`📂 已读取现有推荐码 ${existingCodes.length} 个\n`);
    }
    
    // 生成新推荐码
    const generatedCodes = [];
    const batchId = `BATCH_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < GENERATE_COUNT; i++) {
      let code = '';
      let isUnique = false;
      let attempts = 0;
      
      // 确保推荐码唯一
      while (!isUnique && attempts < 100) {
        code = generateCode(CODE_TYPE);
        
        // 检查是否重复（在现有列表和新生成的列表中）
        const allCodes = [...existingCodes.map(c => c.code), ...generatedCodes.map(c => c.code)];
        if (!allCodes.includes(code)) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) {
        console.warn(`⚠️  第 ${i + 1} 个推荐码生成失败（重试次数过多）`);
        continue;
      }
      
      const codeRecord = {
        code: code,
        code_type: CODE_TYPE,
        type_name: CODE_TYPE === 'creator' ? '联创推荐官' : '公益推荐官',
        status: 'active',
        use_count: 0,
        max_uses: 0,
        batch_id: batchId,
        created_at: timestamp,
        updated_at: timestamp,
        last_used_at: null,
        referrer_id: null,
        referrer_name: null,
      };
      
      generatedCodes.push(codeRecord);
      console.log(`  ${i + 1}. ✅ ${code}`);
    }
    
    // 合并并保存
    const allCodes = [...existingCodes, ...generatedCodes];
    fs.writeFileSync(outputPath, JSON.stringify(allCodes, null, 2), 'utf8');
    
    // 输出结果
    console.log(`\n🎉 成功生成 ${generatedCodes.length} 个推荐码！`);
    console.log(`📦 批次号：${batchId}`);
    console.log(`📄 已保存到：${outputPath}\n`);
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    生成的推荐码列表                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    generatedCodes.forEach((item, index) => {
      const line = `║ ${(index + 1).toString().padStart(2, ' ')}. ${item.code.padEnd(10, ' ')} (${item.type_name.padEnd(10, ' ')}) ║`;
      console.log(line);
    });
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 共有 ${allCodes.length} 个推荐码（含历史）`);
    console.log(`\n💡 提示：你可以将 referral_codes.json 导入数据库，或直接使用这些推荐码`);
    
  } catch (error) {
    console.error('❌ 错误：', error.message);
    process.exit(1);
  }
}

main();
