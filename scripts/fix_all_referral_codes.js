/**
 * fix_all_referral_codes.js - 统一修正全部用户推荐码
 *
 * 目标：
 * 1. 修正不符合五类前缀规则（GYRG/LCRG/ZYRG/SQZD/CSHH）的推荐码
 * 2. 为没有推荐码的用户生成合规推荐码
 * 3. 确保 users.referral_code 与 referral_codes 表数据一致
 *
 * 使用方式：node fix_all_referral_codes.js
 *
 * 前缀规则（与 routes_referral-codes.js 一致）：
 *   GYRG = 公益推荐官, LCRG = 联创推荐官, ZYRG = 专业推荐官,
 *   SQZD = 社区服务站, CSHH = 城市合伙人
 */

const Database = require('better-sqlite3');
const path = require('path');

// ========== 配置 ==========
const DB_PATH = path.join(__dirname, '..', 'renrenmei.db');

// 五类身份 → 推荐码前缀 映射
// 支持新旧两套角色命名（旧: creator / 新: partner_matchmaker 等同义）
const ROLE_PREFIX_MAP = {
  // 新命名（用户端角色值）
  'public_matchmaker': 'GYRG',          // 公益推荐官
  'partner_matchmaker': 'LCRG',          // 联创推荐官
  'professional_recommender': 'ZYRG',    // 专业推荐官
  'community_station': 'SQZD',           // 社区服务站
  'city_franchisee': 'CSHH',             // 城市合伙人
  // 旧命名（referral_codes.code_type / 历史遗留）
  'creator': 'LCRG',                     // 联创推荐官（旧）
  'public_welfare': 'GYRG',              // 公益推荐官（旧）
  'professional': 'ZYRG',                // 专业推荐官（旧）
  'city_partner': 'CSHH',                // 城市合伙人（旧）
};

// 角色 → referral_codes.code_type 映射
const ROLE_CODE_TYPE_MAP = {
  'public_matchmaker': 'public_welfare',
  'partner_matchmaker': 'creator',
  'professional_recommender': 'professional',
  'community_station': 'community_station',
  'city_franchisee': 'city_partner',
  // 旧角色映射（自身即 code_type）
  'creator': 'creator',
  'public_welfare': 'public_welfare',
  'professional': 'professional',
  'city_partner': 'city_partner',
};

// 合规前缀列表（用于验证）
const VALID_PREFIXES = ['GYRG', 'LCRG', 'ZYRG', 'SQZD', 'CSHH'];

// ========== 工具函数 ==========

/**
 * 判断推荐码是否符合五类前缀规则
 */
function isValidCode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length !== 8) return false;
  return VALID_PREFIXES.some(p => code.startsWith(p));
}

/**
 * 判断推荐码的前缀是否匹配用户角色
 * 例如：public_matchmaker 应该用 GYRG 而非 LCRG
 */
function doesPrefixMatchRole(code, role) {
  if (!code || !role) return true; // 不明确时不报错
  const effectiveRole = (role || '').split(',').map(r => r.trim()).find(r => r !== 'user' && ROLE_PREFIX_MAP[r]) || role;
  const expectedPrefix = ROLE_PREFIX_MAP[effectiveRole];
  if (!expectedPrefix) return true; // 无法确定期望前缀时不报错
  return code.startsWith(expectedPrefix);
}

/**
 * 获取角色对应的推荐码前缀
 * 支持逗号分隔的多角色（如 "user,public_matchmaker"），取最高级别角色
 */
function getPrefixForRole(role) {
  // 多角色处理：取第一个非 'user' 的角色
  const roles = (role || '').split(',').map(r => r.trim());
  for (const r of roles) {
    if (ROLE_PREFIX_MAP[r]) {
      return ROLE_PREFIX_MAP[r];
    }
  }
  // 默认返回 GYRG（让所有用户都有基本推荐资格）
  return 'GYRG';
}

/**
 * 获取角色对应的 code_type
 */
function getCodeTypeForRole(role) {
  const roles = (role || '').split(',').map(r => r.trim());
  for (const r of roles) {
    if (ROLE_CODE_TYPE_MAP[r]) {
      return ROLE_CODE_TYPE_MAP[r];
    }
  }
  return 'public_welfare';
}

/**
 * 校验推荐码前缀是否与code_type匹配
 * 用于在生成后校验，避免前缀与类型不匹配
 */
function doesCodeMatchType(code, codeType) {
  const prefixToType = {
    'GYRG': 'public_welfare',
    'LCRG': 'creator',
    'ZYRG': 'professional',
    'SQZD': 'community_station',
    'CSHH': 'city_partner',
  };
  for (const [prefix, expectedType] of Object.entries(prefixToType)) {
    if (code.startsWith(prefix)) {
      return codeType === expectedType;
    }
  }
  return true; // 无法识别前缀时不报错
}

/**
 * 生成唯一且不重复的推荐码
 */
function generateUniqueCode(db, role) {
  const prefix = getPrefixForRole(role);
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = prefix + suffix;

    // 双重检查：referral_codes 表和 users 表都不存在
    const existsInCodes = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
    const existsInUsers = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
    if (!existsInCodes && !existsInUsers) {
      return code;
    }
  }

  // 极端情况：加时间戳后缀
  const fallbackCode = prefix + Date.now().toString(36).slice(-4).toUpperCase();
  return fallbackCode;
}

/**
 * 将推荐码写入 referral_codes 表和 users 表
 */
function saveReferralCode(db, userId, code, role) {
  const codeType = getCodeTypeForRole(role);

  // 先检查是否已存在
  const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
  if (!existing) {
    db.prepare(`
      INSERT INTO referral_codes (code, code_type, referrer_id, status, created_by, use_count, max_uses, created_at)
      VALUES (?, ?, ?, 'active', ?, 0, 0, datetime('now'))
    `).run(code, codeType, userId, userId);
  }

  // 更新用户表（users 表没有 updated_at 列，仅更新 referral_code）
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?')
    .run(code, userId);
}

// ========== 主逻辑 ==========

function main() {
  console.log('========================================');
  console.log('  统一修正全部用户推荐码');
  console.log('========================================\n');

  if (require.main !== module) {
    // 作为模块被导入时不执行
    return;
  }

  const db = new Database(DB_PATH);

  // 1. 检查 users 表是否有 referral_code 列
  const columns = db.prepare("PRAGMA table_info('users')").all();
  const hasReferralCode = columns.some(c => c.name === 'referral_code');
  if (!hasReferralCode) {
    console.log('⚠️  users 表缺少 referral_code 列，正在添加...');
    db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
    console.log('✅  referral_code 列添加成功\n');
  }

  // 2. 获取全部用户
  const users = db.prepare('SELECT id, role, referral_code FROM users ORDER BY id ASC').all();
  console.log(`共找到 ${users.length} 个用户\n`);

  // 3. 分类
  const stats = {
    total: users.length,
    alreadyValid: 0,    // 推荐码合规
    malformed: 0,       // 推荐码存在但不合规
    missing: 0,         // 无推荐码
    fixed: 0,           // 已修正
    generated: 0,       // 已生成
    skipped: 0,         // 跳过
  };

  console.log('--- 分类统计 ---');
  const validCount = users.filter(u => isValidCode(u.referral_code)).length;
  const mismatchCount = users.filter(u => isValidCode(u.referral_code) && !doesPrefixMatchRole(u.referral_code, u.role)).length;
  const invalidCount = users.filter(u => u.referral_code && !isValidCode(u.referral_code)).length;
  const missingCount = users.filter(u => !u.referral_code).length;
  console.log(`  合规推荐码: ${validCount}`);
  console.log(`  合规但前缀不匹配角色: ${mismatchCount}`);
  console.log(`  不合规推荐码: ${invalidCount}`);
  console.log(`  无推荐码: ${missingCount}`);
  console.log('');

  // 4. 事务处理（使用 if-else 链，避免 continue）
  const fixTransaction = db.transaction(() => {
    for (const user of users) {
      const { id, role, referral_code } = user;
      let handled = false;

      // 情况1：推荐码合规且前缀匹配角色 → 跳过
      if (isValidCode(referral_code) && doesPrefixMatchRole(referral_code, role)) {
        stats.alreadyValid++;
        handled = true;
      }
      // 情况1.5：推荐码合规但前缀不匹配角色 → 修正
      else if (isValidCode(referral_code) && !doesPrefixMatchRole(referral_code, role)) {
        const oldCode = referral_code;
        const newCode = generateUniqueCode(db, role);
        saveReferralCode(db, id, newCode, role);
        stats.malformed++;
        stats.fixed++;
        console.log(`  🔧 修正: 用户#${id} (${role}) ${oldCode} → ${newCode} (前缀不匹配)`);
        handled = true;
      }
      // 情况2：推荐码存在但不合规 → 修正
      else if (referral_code && !isValidCode(referral_code)) {
        const oldCode = referral_code;
        const newCode = generateUniqueCode(db, role);
        saveReferralCode(db, id, newCode, role);
        stats.malformed++;
        stats.fixed++;
        console.log(`  🔧 修正: 用户#${id} (${role}) ${oldCode} → ${newCode}`);
        handled = true;
      }
      // 情况3：无推荐码 → 生成
      else if (!referral_code) {
        const newCode = generateUniqueCode(db, role);
        saveReferralCode(db, id, newCode, role);
        stats.missing++;
        stats.generated++;
        console.log(`  ✨ 生成: 用户#${id} (${role}) → ${newCode}`);
        handled = true;
      }

      if (!handled) stats.skipped++;
    }
  });

  console.log('--- 开始处理 ---');
  fixTransaction();
  console.log('');

  // 5. 输出汇总
  console.log('========================================');
  console.log('  处理完成');
  console.log('========================================');
  console.log(`  总用户数:     ${stats.total}`);
  console.log(`  已合规:       ${stats.alreadyValid}`);
  console.log(`  已修正:       ${stats.fixed}`);
  console.log(`  已生成:       ${stats.generated}`);
  console.log(`  跳过:         ${stats.skipped}`);
  console.log(`  ─────────────────────────`);
  console.log(`  本次变更:     ${stats.fixed + stats.generated} 个`);
  console.log('========================================\n');

  // 6. 验证结果
  console.log('--- 验证推荐码合规性 ---');
  const afterUsers = db.prepare('SELECT id, role, referral_code FROM users ORDER BY id ASC').all();
  const invalidAfter = afterUsers.filter(u => u.referral_code && !isValidCode(u.referral_code));
  const nullAfter = afterUsers.filter(u => !u.referral_code);

  if (invalidAfter.length === 0 && nullAfter.length === 0) {
    console.log('✅ 全部用户推荐码合规！');
  } else {
    if (invalidAfter.length > 0) {
      console.log(`⚠️  仍有 ${invalidAfter.length} 个用户推荐码不合规：`);
      invalidAfter.forEach(u => console.log(`  用户#${u.id} (${u.role}): ${u.referral_code}`));
    }
    if (nullAfter.length > 0) {
      console.log(`⚠️  仍有 ${nullAfter.length} 个用户无推荐码`);
    }
  }

  db.close();
  console.log('\n数据库连接已关闭');
}

// 导出供其他模块使用
module.exports = {
  isValidCode,
  generateUniqueCode,
  saveReferralCode,
  getPrefixForRole,
  getCodeTypeForRole,
  VALID_PREFIXES,
  ROLE_PREFIX_MAP,
  ROLE_CODE_TYPE_MAP,
};

// 直接执行时运行 main
if (require.main === module) {
  main();
}
