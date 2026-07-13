#!/bin/bash
# 部署脚本：修复推荐码绑定/会员身份等问题
# 生产服务器：ubuntu@175.24.227.251
# 部署日期：2026-07-06

set -e

SERVER="ubuntu@175.24.227.251"
REMOTE_SERVER_DIR="/var/www/renrenmei/server"
LOCAL_DIR="/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram"
REMOTE_TMP="~/tmp_deploy"

echo "===== 开始部署：修复推荐码绑定/会员身份等问题 ====="

# 需要部署的文件列表
FILES=(
  "routes_auth.js"
  "routes_payment.js"
  "routes_matchmaker.js"
  "routes_user.js"
  "utils/referral.js"
  "utils/verification.js"
  "utils/config.js"
  "app.js"
  "package.json"
  "package-backend.json"
)

echo "[1/3] 上传修复文件..."
for file in "${FILES[@]}"; do
  echo "  上传 $file..."
  scp "$LOCAL_DIR/$file" "$SERVER:$REMOTE_TMP/"
done

echo "[2/3] 在生产服务器上部署文件..."
ssh "$SERVER" << 'ENDSSH'
set -e
cd /var/www/renrenmei/server
echo "备份数据库..."
sudo cp renrenmei.db renrenmei.db.backup.$(date +%Y%m%d_%H%M%S)

echo "部署文件（使用 sudo）..."
for file in routes_auth.js routes_payment.js routes_matchmaker.js routes_user.js utils/referral.js utils/verification.js utils/config.js app.js package.json package-backend.json; do
  if [ -f $HOME/tmp_deploy/$file ]; then
    sudo cp $HOME/tmp_deploy/$file ./$file
    echo "  已部署 $file"
  fi
done

echo "清理临时文件..."
rm -rf $HOME/tmp_deploy
echo "部署完成。"
ENDSSH

echo "[3/3] 重启后端服务..."
ssh "$SERVER" << 'ENDSSH'
cd /var/www/renrenmei/server
echo "重启 Node.js 服务..."
sudo pm2 restart all || (sudo pkill -f "node.*server.js" && sleep 2 && sudo nohup node server.js > /var/log/renrenmei.log 2>&1 &)
sleep 3
echo "服务重启完成。"
ENDSSH

echo "===== 部署完成 ====="
echo "请测试：推荐码绑定、会员建档等功能"
