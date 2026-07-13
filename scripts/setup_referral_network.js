/**
 * setup_referral_network.js - 配置推荐码相互推荐关系
 * 
 * 功能：
 * 1. 将推荐码绑定到模拟用户
 * 2. 建立相互推荐关系（A推荐B，B推荐C...）
 * 3. 生成推荐关系网络
 * 
 * 使用方法：node setup_referral_network.js
 */

const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const CODES_FILE = path.join(__dirname, 'referral_codes.json');
const USERS_FILE = path.join(__dirname, 'mock_users.json');
const NETWORK_FILE = path.join(__dirname, 'referral_network.json');
// ==========================

/**
 * 生成模拟用户
 */
function generateMockUsers(count) {
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑一', '刘二'];
  const users = [];
  
  for (let i = 0; i < count; i++) {
    users.push({
      id: i + 1,
      nickname: names[i] || `用户${i + 1}`,
      phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      code: null, // 将绑定推荐码
    });
  }
  
  return users;
}

/**
 * 建立推荐关系网络
 * 模式：循环推荐（1→2→3→...→10→1）
 */
function buildReferralNetwork(users, codes) {
  const network = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const nextUser = users[(i + 1) % users.length]; // 循环推荐
    const code = codes[i % codes.length]; // 循环使用推荐码
    
    // 绑定推荐码到用户
    user.code = code.code;
    code.referrer_id = user.id;
    code.referrer_name = user.nickname;
    
    // 创建推荐关系
    network.push({
      referrer: {
        id: user.id,
        nickname: user.nickname,
        code: code.code,
      },
      referee: {
        id: nextUser.id,
        nickname: nextUser.nickname,
      },
      referral_code: code.code,
      created_at: new Date().toISOString(),
    });
  }
  
  return network;
}

/**
 * 主函数
 */
function main() {
  try {
    console.log('🚀 开始配置推荐码相互推荐关系...\n');
    
    // 1. 读取推荐码
    console.log('📂 读取推荐码...');
    if (!fs.existsSync(CODES_FILE)) {
      console.error('❌ 推荐码文件不存在，请先运行生成脚本');
      process.exit(1);
    }
    const codes = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    console.log(`✅ 读取到 ${codes.length} 个推荐码\n`);
    
    // 2. 生成模拟用户
    console.log('👥 生成模拟用户...');
    const userCount = Math.min(codes.length, 10); // 最多10个用户
    const users = generateMockUsers(userCount);
    console.log(`✅ 生成 ${users.length} 个模拟用户\n`);
    
    // 3. 建立推荐关系网络
    console.log('🕸️  建立推荐关系网络...');
    const network = buildReferralNetwork(users, codes);
    console.log(`✅ 建立了 ${network.length} 条推荐关系\n`);
    
    // 4. 保存结果
    console.log('💾 保存结果...');
    
    // 保存用户
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`  ✅ 用户数据已保存到：${USERS_FILE}`);
    
    // 保存推荐码（已更新referrer_id）
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2), 'utf8');
    console.log(`  ✅ 推荐码已更新并保存到：${CODES_FILE}`);
    
    // 保存推荐关系网络
    fs.writeFileSync(NETWORK_FILE, JSON.stringify(network, null, 2), 'utf8');
    console.log(`  ✅ 推荐关系已保存到：${NETWORK_FILE}`);
    
    // 5. 打印推荐关系图
    console.log('\n📊 推荐关系网络：');
    console.log('═'.repeat(60));
    network.forEach((rel, index) => {
      const line = `  ${String(index + 1).padStart(2, ' ')}. ${rel.referrer.nickname}(${rel.referrer.code}) → 推荐给 → ${rel.referee.nickname}`;
      console.log(line);
    });
    console.log('═'.repeat(60));
    
    console.log('\n🎉 配置完成！');
    console.log('\n💡 下一步：');
    console.log('  1. 将 mock_users.json 和 referral_codes.json 导入数据库');
    console.log('  2. 运行 node import_referral_codes.js 导入推荐码');
    console.log('  3. 在管理后台查看推荐关系\n');
    
  } catch (error) {
    console.error('❌ 错误：', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
