#!/bin/bash
# 部署脚本：管理后台上线 (admin-panel build)
# 生产服务器：ubuntu@175.24.227.251
# 管理后台目录：/var/www/renrenmei/admin/
#
# 用法：
#   ./deploy_admin_panel.sh          # 构建+部署+验证
#   ./deploy_admin_panel.sh --build  # 仅构建（不部署）
#   ./deploy_admin_panel.sh --check   # 检查本地与服务器版本差异

set -e

SERVER="ubuntu@175.24.227.251"
REMOTE_ADMIN_DIR="/var/www/renrenmei/admin"
LOCAL_ADMIN="/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/admin-panel"
BUILD_JS="main.f8862820.js"  # 当前构建文件名，部署时自动更新

# ============================================================
# 1. 构建
# ============================================================
do_build() {
  echo "===== 构建管理后台 ====="
  cd "$LOCAL_ADMIN"

  # 检查未提交更改
  if [ -n "$(git status --porcelain admin-panel/src/)" ]; then
    echo "[提示] 有未提交的更改，自动提交..."
    git add admin-panel/src/ admin-panel/package.json admin-panel/package-lock.json
    git commit -m "chore(admin): 预部署提交 - $(date '+%Y-%m-%d %H:%M')
Co-Authored-By: Claude <noreply@anthropic.com>"
  fi

  npm run build
  echo "构建完成"
}

# ============================================================
# 2. 部署
# ============================================================
do_deploy() {
  echo "===== 部署到服务器 ====="

  # 获取当前构建的 JS 文件名
  NEW_BUILD=$(ls "$LOCAL_ADMIN/build/static/js/main.*.js" 2>/dev/null | head -1)
  if [ -z "$NEW_BUILD" ]; then
    echo "[错误] 未找到构建文件，请先运行构建"
    exit 1
  fi
  NEW_BUILD_NAME=$(basename "$NEW_BUILD")
  echo "构建文件：$NEW_BUILD_NAME"

  # 清理服务器旧构建（保留 index.html）
  echo "[1/3] 清理服务器旧构建..."
  ssh "$SERVER" "rm -f $REMOTE_ADMIN_DIR/static/js/main.*.js $REMOTE_ADMIN_DIR/static/js/main.*.js.map $REMOTE_ADMIN_DIR/static/js/main.*.js.LICENSE.txt 2>/dev/null || true"

  # 上传新构建
  echo "[2/3] 上传构建到服务器..."
  scp -r "$LOCAL_ADMIN/build/." "$SERVER:$REMOTE_ADMIN_DIR/"

  # 验证
  echo "[3/3] 验证部署..."
  STATUS=$(ssh "$SERVER" "curl -s -o /dev/null -w '%{http_code}' https://rrmhdate.cn/admin/")
  SERVER_JS=$(ssh "$SERVER" "ls $REMOTE_ADMIN_DIR/static/js/main.*.js 2>/dev/null | xargs basename 2>/dev/null || echo '未找到'")

  echo ""
  echo "===== 部署结果 ====="
  echo "服务器 JS：$SERVER_JS"
  echo "HTTP 状态：$STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "✅ 部署成功"
  else
    echo "⚠️  HTTP 状态码: $STATUS（预期 200）"
  fi
  echo "访问地址：https://rrmhdate.cn/admin/"
}

# ============================================================
# 3. 检查版本差异
# ============================================================
do_check() {
  echo "===== 检查本地与服务器版本差异 ====="

  LOCAL_JS=$(ls "$LOCAL_ADMIN/build/static/js/main.*.js" 2>/dev/null | xargs basename 2>/dev/null || echo '未构建')
  SERVER_JS=$(ssh "$SERVER" "ls $REMOTE_ADMIN_DIR/static/js/main.*.js 2>/dev/null | xargs basename 2>/dev/null || echo '未部署'")
  LOCAL_GIT=$(git log -1 --oneline admin-panel/ 2>/dev/null | cut -d' ' -f1)
  SERVER_GIT="无法获取"

  # 检查未提交更改
  UNCOMMITTED=$(git status --porcelain admin-panel/src/ 2>/dev/null | wc -l | tr -d ' ')

  echo ""
  echo "本地构建：  $LOCAL_JS"
  echo "服务器构建： $SERVER_JS"
  echo "本地最新提交：$LOCAL_GIT"
  echo "未提交文件： $UNCOMMITTED 个"
  echo ""

  if [ "$LOCAL_JS" != "$SERVER_JS" ]; then
    echo "⚠️  版本不同步，需要部署"
  else
    echo "✅ 版本已同步"
  fi

  if [ "$UNCOMMITTED" != "0" ]; then
    echo "⚠️  有 $UNCOMMITTED 个文件未提交"
  fi
}

# ============================================================
# 主逻辑
# ============================================================
case "${1:-}" in
  --check)
    do_check
    ;;
  --build)
    do_build
    ;;
  *)
    do_build
    do_deploy
    ;;
esac
