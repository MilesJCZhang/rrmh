# 推荐码管理功能使用指南

## 📋 功能概述

已完成的推荐码管理功能包括：
1. ✅ 推荐码生成（联创推荐官 + 公益推荐官）
2. ✅ 推荐关系网络配置
3. ✅ 数据库导入（SQLite）
4. ✅ 管理后台页面

---

## 🚀 快速开始

### 1. 生成推荐码

```bash
# 生成联创推荐码（10个）
cd "/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram"
node generate_referral_codes_file.js

# 生成公益推荐码（5个）
node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const jsonPath = path.join(__dirname, 'referral_codes.json');
let codes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

for (let i = 0; i < 5; i++) {
  let code = 'GYRG' + crypto.randomBytes(2).toString('hex').toUpperCase();
  codes.push({
    code: code,
    code_type: 'public_welfare',
    type_name: '公益推荐官',
    status: 'active',
    use_count: 0,
    max_uses: 0,
    batch_id: 'BATCH_' + Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: null,
    referrer_id: null,
    referrer_name: null
  });
  console.log('✅ ' + code);
}

fs.writeFileSync(jsonPath, JSON.stringify(codes, null, 2), 'utf8');
console.log('✅ 已生成5个公益推荐码');
"
```

---

### 2. 导入数据库

```bash
# 使用 SQLite（无需安装 MySQL）
cd "/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram"
node import_referral_codes_sqlite.js
```

---

### 3. 配置推荐关系

```bash
# 建立推荐码相互推荐关系
node setup_referral_network.js
```

---

## 📱 在微信开发者工具中访问

### 方式1：通过"我的"页面（管理员）

1. 确保用户 ID = 1（管理员）
2. 打开"我的"页面
3. 滚动到最下方
4. 点击 **"🎫 推荐码管理"**

### 方式2：直接访问 URL

在微信开发者工具中，按 `Ctrl+Shift+P`（Mac：`Cmd+Shift+P`），输入：

```
/pages/admin/referral-codes/referral-codes
```

或修改 `app.json` 的 `pages` 数组，把管理页面放到第一个：

```json
"pages": [
  "pages/admin/referral-codes/referral-codes",  // 临时放到第一个
  "pages/index/index",
  ...
]
```

---

## 📊 数据库文件

使用 SQLite 后，数据库文件位于：
```
/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/renrenmei.db
```

### 查看数据库

推荐使用 **DB Browser for SQLite**（免费）：
1. 下载：https://sqlitebrowser.org/
2. 打开 `renrenmei.db`
3. 浏览数据表 `referral_codes`

---

## 📂 文件清单

```
miniprogram/
├── referral_codes.json                # 推荐码数据（15个）
├── referral_network.json             # 推荐关系网络
├── mock_users.json                  # 模拟用户
├── renrenmei.db                    # SQLite 数据库
│
├── generate_referral_codes_file.js  # 生成推荐码脚本
├── import_referral_codes_sqlite.js # 导入数据库脚本
├── setup_referral_network.js       # 配置推荐关系脚本
│
└── pages/admin/referral-codes/    # 管理后台页面
    ├── referral-codes.js           # 页面逻辑
    ├── referral-codes.wxml         # 页面模板
    ├── referral-codes.wxss         # 页面样式
    └── referral-codes.json         # 页面配置
```

---

## 💡 提示

1. **推荐码格式**：
   - 联创推荐官：`LCRGxxxx`（如 `LCRG789D`）
   - 公益推荐官：`GYRGxxxx`（如 `GYRG8C31`）

2. **推荐关系**：
   - 已配置 10 个用户循环推荐
   - 张三 → 李四 → 王五 → ... → 张三

3. **管理员权限**：
   - 当前判断：`userInfo.id === 1`
   - 可修改 `pages/mine/mine.js` 的 `isAdmin` 逻辑

---

## 🔧 自定义配置

### 修改管理员判断逻辑

编辑 `pages/mine/mine.js` 第 152-164 行：

```javascript
// 原代码
isAdmin: (userInfo && (userInfo.id === 1 || (userRole && userRole.includes('admin')))),

// 改为：允许所有已登录用户访问
isAdmin: !isGuest,

// 或改为：允许推荐官访问
isAdmin: isMatchmaker,
```

---

## 📞 技术支持

如遇到问题，请检查：
1. 页面是否已注册到 `app.json`
2. 数据库文件是否存在
3. 管理员权限是否正确配置

---

**🎉 推荐码管理功能已完成！**
