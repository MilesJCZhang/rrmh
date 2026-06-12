# 人人媒好小程序 - 版本更新日志

## v1.0.10 (2026-06-08)

### 🐛 Bug 修复

#### 公益推荐官申请逻辑修复 (Critical)
- **问题**：公益推荐官申请提示"您已申请过"，但用户角色已是联创推荐官，逻辑冲突
- **修复**：
  - 申请前先检查用户是否已是任何类型推荐官（`public_matchmaker`、`partner_matchmaker`、`professional_matchmaker`）
  - 如果是推荐官，直接返回成功，不再报错
  - 清除旧的未通过申请记录，允许重新申请
  - 公益推荐官申请自动通过（无需审核），自动更新用户角色

#### 定时器内存泄漏修复
- **问题**：页面销毁后定时器仍在执行，导致 `Cannot read property '__subPageFrameEndTime__' of null` 错误
- **修复**：
  - `pages/avatar/avatar.js`：`_startRecordTimer()` 和 `_startProgressPolling()` 添加页面有效性检查
  - `pages/verify/verify.js`：`_startPolling()` 添加页面有效性检查
  - `subpackages/user/pages/verify/verify.js`：同上修复

### 🔧 优化
- 生产环境后端代码直接修复（TypeScript 编译环境有问题，直接修改 `dist/routes/apply.js`）
- 数据库查询优化：用户角色检查优先于申请记录检查

---

## v1.0.9 (2026-05-31)

### 🐛 重大 Bug 修复

#### 推荐码生成规则统一 (Critical)
- **问题**：小程序端支付回调生成的推荐码是 8 位纯随机码（如 `KWMJ8GG7`、`QMUCFK4G`），与后台分配的 5 类前缀规则不一致
- **根因**：`payment.ts` 支付回调中使用 `crypto.randomBytes(4).toString('hex')` 生成纯随机码，无前缀规则
- **修复**：
  - `payment.ts`：支付回调生成推荐码改为带前缀规则（与后台 `admin-referral.ts`、`recommendOfficerController.ts` 一致）
  - 前缀规则：`GYRG`(公益)、`LCRG`(联创)、`ZYRG`(专业)、`SQZD`(社区)、`CSHH`(城市合伙人)
- **数据修复**：批量修复数据库中 20 条不符合前缀规则的推荐码
  - 涉及用户：5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 37, 59, 62, 66, 76, 81, 97, 102, 103, 105, 106, 107, 108, 109

#### 推荐奖励配置动态化
- **问题**：`recommendService.ts` 中推荐奖励金额硬编码，且数值错误（`franchisee: 9999` 应为 `10000`）
- **修复**：改为从 `configs` 表动态读取配置
  - `recommend_single_reward` = 99
  - `recommend_matchmaker_reward` = 399 (专业推荐官)
  - `recommend_station_reward` = 3999 (社区驿站)
  - `recommend_franchisee_reward` = 10000 (城市合伙人)
  - `recommend_franchisee_passive_rate` = 0.03 (3% 被动提成)

---

### ✨ 功能改进

#### 后台管理端
1. **推荐官管理页面** (`Officers.tsx`)
   - 新增「推荐官类别」列，插入在"推荐官信息"和"推广码"之间
   - 不同类别用不同颜色 Tag 区分（公益=金色、联创=蓝色、专业=紫色、社区=绿色、城市=红色）
   - 导出 CSV 功能修复（原按钮只是刷新，现已实现真正的 CSV 导出）
   - CSV 导出新增「推荐官类别」列

2. **推荐码管理页面** (`admin-referral.ts`)
   - 后台分配推荐码逻辑修复：付费角色（联创/专业/社区/城市合伙人）默认只绑定推荐码不激活
   - 新增 `paid` 参数：管理员勾选"确认已收款"后才完整激活角色 + 生成推荐码
   - 公益推荐官：免支付直接激活

3. **401 错误处理** (`request.ts`)
   - 新增 401 自动跳转登录页逻辑
   - JWT token 过期时自动清除本地存储并跳转登录

---

### 📋 完整更新内容清单

| 文件 | 修改内容 |
|------|----------|
| `src/routes/payment.ts` | 推荐码生成规则统一为前缀+4位随机 |
| `src/services/recommendService.ts` | 推荐奖励从数据库动态读取 |
| `src/routes/admin-referral.ts` | 付费角色需确认收款才激活 |
| `admin-src/src/pages/users/Officers.tsx` | 新增推荐官类别列 + 导出功能修复 |
| `admin-src/src/pages/referral-codes/index.tsx` | "确认已收款"开关 |
| `admin-src/src/utils/request.ts` | 401 自动跳转登录页 |
| **数据库** | 修复 20+ 条推荐码为合规格式 |

---

### 🚀 部署记录

**后端部署**：
```bash
scp payment.ts ubuntu@175.24.227.251:/home/ubuntu/renrenmeihao-api/src/routes/
scp recommendService.ts ubuntu@175.24.227.251:/home/ubuntu/renrenmeihao-api/src/services/
pm2 restart renrenmeihao-api --update-env
```

**管理后台部署**：
```bash
cd /home/ubuntu/renrenmeihao-api/admin-src
npm run build
sudo cp -r dist/* /var/www/admin/
```

---

### 📝 升级注意事项

1. **数据库配置检查**：确认 `configs` 表有以下配置：
   ```sql
   INSERT INTO configs (key, value) VALUES
     ('recommend_single_reward', '99'),
     ('recommend_matchmaker_reward', '399'),
     ('recommend_station_reward', '3999'),
     ('recommend_franchisee_reward', '10000'),
     ('recommend_franchisee_passive_rate', '0.03')
   ON DUPLICATE KEY UPDATE value=VALUES(value);
   ```

2. **旧数据兼容**：已修复数据库中所有不合规推荐码，无需额外迁移

3. **JWT 过期处理**：前端已加 401 自动跳转，用户无需手动重新登录

---

## v1.0.8 (2026-05-30)

### ✨ 功能新增
- 首页宫格布局调整：将「男推荐官主体沙龙」「女推荐官沙龙」移入四宫格
- 四宫格变六宫格：公益推荐官 → 联创推荐官 → 男推荐官沙龙 → 女推荐官沙龙 → 城市合伙人 → 社区服务站

---

## v1.0.7 (2026-05-29)

### 🐛 Bug 修复
- 取消报名后重新报名：join 接口先查 cancelled 记录，有则 update 恢复，无则 create（修复唯一约束冲突）
- `NODE_ENV` 强制设置修复：删除 `index.ts` 中的 `process.env.NODE_ENV = "development"` 强制设置

### 📋 架构优化
- Prisma schema `@map` 修复：`createdAt`/`updatedAt` → `created_at`/`updated_at`
- Decimal 类型修复：`activityService` / `recommendService` / `walletService`

---

## v1.0.0 (2026-05-20)

### 🎉 首次发布
- 微信登录 + 身份识别
- 推荐码系统（5 类推荐官）
- 实名认证（百度 AI）
- 支付系统（微信支付）
- 后台管理系统（Ant Design Pro）
- 活动报名系统
- 分润规则 v5.1
