#!/bin/bash
cd /Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/admin-panel
echo "Starting build at $(date)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Free memory: $(node -e 'console.log(Math.round(require("os").freemem()/1024/1024) + "MB")')"

# 设置环境变量以加速构建
export NODE_OPTIONS="--max-old-space-size=8192"
export GENERATE_SOURCEMAP=false
export DISABLE_ESLINT_PLUGIN=true

# 删除旧的build目录
rm -rf build

# 运行构建
npx react-scripts build 2>&1 | tee /tmp/build_final.log

# 检查构建结果
if [ -f "build/index.html" ]; then
  echo "Build completed successfully at $(date)"
  ls -lh build/index.html
  ls -lh build/static/js/*.js | head -5
else
  echo "Build failed or incomplete at $(date)"
fi
