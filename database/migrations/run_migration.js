#!/usr/bin/env node
// 数据库迁移执行脚本 - 通过 better-sqlite3 执行 SQL
// 用法：node run_migration.js [数据库路径] [SQL文件路径]
// 示例：node run_migration.js ./renrenmei.db ./007_ensure_score_tables.sql

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const args = process.argv.slice(2);
const dbPath = args[0];
const sqlFile = args[1];

if (!dbPath || !sqlFile) {
  console.error('用法: node run_migration.js [数据库路径] [SQL文件路径]');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`数据库文件不存在: ${dbPath}`);
  process.exit(1);
}
if (!fs.existsSync(sqlFile)) {
  console.error(`SQL 文件不存在: ${sqlFile}`);
  process.exit(1);
}

console.log(`数据库: ${dbPath}`);
console.log(`SQL 文件: ${sqlFile}\n`);

const db = Database(dbPath);
const sql = fs.readFileSync(sqlFile, 'utf8');

// 按分号拆分为独立语句，过滤注释和空行
const rawParts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

const statements = [];
for (const part of rawParts) {
  const lines = part.split('\n').filter(l => !l.trim().startsWith('--'));
  const cleaned = lines.join('\n').trim();
  if (cleaned.length > 0) {
    statements.push(cleaned);
  }
}

console.log(`共 ${statements.length} 条 SQL 语句待执行...\n`);

let ok = 0, skip = 0, fail = 0;

for (const stmt of statements) {
  try {
    db.exec(stmt + ';');
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
    console.log(`✓ ${preview}...`);
    ok++;
  } catch (err) {
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
    if (err.message.includes('already exists')) {
      console.log(`⊘ 已存在，跳过: ${preview}...`);
      skip++;
    } else {
      console.error(`✗ 错误: ${err.message}`);
      console.error(`  语句: ${preview}...`);
      fail++;
    }
  }
}

console.log(`\n完成: ${ok} 成功, ${skip} 跳过, ${fail} 失败`);
db.close();
if (fail > 0) process.exit(1);
