#!/bin/bash
# 部署脚本：修复 GET /v1/user/profile 500 错误
# 生产服务器：ubuntu@175.24.227.251
# 部署日期：2026-06-07

set -e

SERVER="ubuntu@175.24.227.251"
REMOTE_DIR="/var/www/miniprogram"  # 请根据实际生产目录修改
LOCAL_DIR="/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram"

echo "===== 开始部署：修复用户资料接口 500 错误 ====="

# 1. 上传修复后的 routes_user.js
echo "[1/4] 上传 routes_user.js..."
scp "$LOCAL_DIR/routes_user.js" "$SERVER:$REMOTE_DIR/routes_user.js"

# 2. 上传数据库迁移脚本
echo "[2/4] 上传数据库迁移脚本..."
scp "$LOCAL_DIR/database/migrations/007_ensure_score_tables.sql" "$SERVER:/tmp/007_ensure_score_tables.sql"

# 3. 在生产服务器上执行数据库迁移
echo "[3/4] 执行数据库迁移..."
ssh "$SERVER" << 'ENDSSH'
cd /var/www/miniprogram
echo "备份数据库..."
cp renrenmei.db renrenmei.db.backup.$(date +%Y%m%d_%H%M%S)

echo "执行评分系统表迁移..."
sqlite3 renrenmei.db < /tmp/007_ensure_score_tables.sql

echo "验证表是否创建成功..."
sqlite3 renrenmei.db ".tables" | grep -E "score_rules|user_scores|user_asset_verifications"
echo "数据库迁移完成。"
ENDSSH

# 4. 重启后端服务
echo "[4/4] 重启后端服务..."
ssh "$SERVER" << 'ENDSSH'
echo "重启 Node.js 服务..."
# 根据实际使用的进程管理工具选择命令
# pm2 方式：
pm2 restart all
# 或 forever 方式：
# forever restartall
# 或直接 kill 重启：
# pkill -f "node.*server.js" && cd /var/www/miniprogram && nohup node server.js &

echo "服务重启完成。"
ENDSSH

echo "===== 部署完成 ====="
echo "请检查：https://rrmhdate.cn/v1/user/profile"
