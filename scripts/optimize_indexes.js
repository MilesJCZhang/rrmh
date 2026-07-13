/**
 * 数据库索引优化脚本
 * 运行: node optimize_indexes.js
 * 作用: 为常用查询添加缺失的索引
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'renrenmei.db'));
console.log('数据库连接成功\n');

let created = 0;
let skipped = 0;

function createIndex(name, table, columns) {
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`);
    console.log(`✓ 索引 ${name} (${columns}) 已创建`);
    created++;
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log(`- 索引 ${name} 已存在，跳过`);
      skipped++;
    } else {
      console.log(`✗ 创建索引 ${name} 失败: ${e.message}`);
    }
  }
}

console.log('=== 开始优化索引 ===\n');

// 1. stations表 - 按城市筛选是常用查询
createIndex('idx_stations_city', 'stations', 'city');
createIndex('idx_stations_created', 'stations', 'created_at DESC');

// 2. partners表 - 按创建时间排序、按状态+类型组合查询
createIndex('idx_partners_created', 'partners', 'created_at DESC');
createIndex('idx_partners_status_type', 'partners', 'status, type');

// 3. withdrawals表 - 组合查询优化
createIndex('idx_withdrawals_user_status', 'withdrawals', 'user_id, status');
createIndex('idx_withdrawals_status_created', 'withdrawals', 'status, created_at DESC');

// 4. partner_earnings表 - 组合查询
createIndex('idx_earnings_partner_created', 'partner_earnings', 'partner_id, created_at DESC');
createIndex('idx_earnings_user_created', 'partner_earnings', 'user_id, created_at DESC');

// 5. partner_referrals表 - 按状态查询
createIndex('idx_partner_referrals_status', 'partner_referrals', 'status');
createIndex('idx_partner_referrals_created', 'partner_referrals', 'created_at DESC');

console.log(`\n=== 优化完成 ===`);
console.log(`创建索引: ${created} 个`);
console.log(`跳过索引: ${skipped} 个`);

// 显示所有索引
console.log('\n=== 当前所有索引 ===');
const tables = ['stations', 'partners', 'withdrawals', 'partner_earnings', 'partner_referrals'];
tables.forEach(table => {
  try {
    const indexes = db.prepare(`PRAGMA index_list(${table})`).all();
    console.log(`\n${table} 表:`);
    indexes.forEach(idx => {
      const columns = db.prepare(`PRAGMA index_info(${idx.name})`).all();
      const colNames = columns.map(c => c.name || 'expr').join(', ');
      console.log(`  - ${idx.name} (${colNames})`);
    });
  } catch(e) {
    console.log(`表 ${table} 不存在或无法访问`);
  }
});

// 分析查询性能建议
console.log('\n=== 查询优化建议 ===');
console.log('1. 分页查询使用: SELECT * FROM table WHERE ... ORDER BY created_at DESC LIMIT ? OFFSET ?');
console.log('2. 统计查询使用: SELECT COUNT(*) FROM table WHERE ...');
console.log('3. 联表查询确保JOIN字段有索引');
console.log('4. 避免在索引字段上使用函数或计算');

db.close();
console.log('\n✅ 数据库连接已关闭');
