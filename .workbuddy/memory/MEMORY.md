# 人人媒好小程序 - 项目记忆

## 项目基本信息
- AppID: `wx08bbe40b9429b9a4`，后端 API: `https://rrmhdate.cn`（服务器 `175.24.227.251`）
- PM2 进程名: `renrenmeihao-api`，代码目录: `/home/ubuntu/renrenmeihao-api`
- 本地小程序项目: `/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram`
- 后台管理项目: `/Volumes/User/MacBookAir/人人媒好/OKComputer_微信小程序后台设计/`
- 管理后台部署路径: `/var/www/admin/`（nginx alias，非 `/home/ubuntu/renrenmeihao-api/public/admin/`）
- 管理后台源码: `/home/ubuntu/renrenmeihao-api/admin-src/`
- 推荐官审核 API 路由: `/api/admin/officers` 和 `/api/admin/recommend-officers`（两个别名指向同一 controller）
- Activity.type 合法值: `salon`(默认) / `male_salon`(男推荐官主体沙龙) / `female_salon`(女推荐官主体沙龙)，VarChar(20)
- 推荐官沙龙审核流: pending → admin approve → 推荐官 publish
- 随行人员报名: 1-3人仅填姓名，占名额，事务保证原子性
- 取消报名后重新报名: join 接口先查 cancelled 记录，有则 update 恢复，无则 create（2026-05-29 修复唯一约束冲突）
- admin 路由文件: `/home/ubuntu/renrenmeihao-api/src/routes/admin.ts`（含 officers 别名路由）
- admin-users 路由文件: `/home/ubuntu/renrenmeihao-api/src/routes/admin-users.ts`（已删除 officers 段，避免与 admin.ts 冲突）

## 服务器关键信息
- MySQL: `renrenmeihao`，用户 `root`，密码 `Rrmh@2026`
- 微信 AppSecret: `e82e162f75485575dfbd9392c1e83ecf`（已写入服务端 `.env`）
- nginx 代理: `/admin-api/` → `localhost:3001`；`/v1/` 和 `/api/` 代理到对应端口
- `WECHAT_APPID` 和 `WECHAT_SECRET` 已配置在 `/home/ubuntu/renrenmeihao-api/.env`

## 分润规则 v5.1 摘要
| 身份 | 入驻费 | 推荐建档收益 | 其他收益 |
|------|--------|-------------|---------|
| 公益推荐官 | 免费 | 99元/人（永久） | — |
| 联创推荐官 | 399元 | 99元/人 | 推荐联创② 399元、推荐社区服务站专属 10%沉淀 |
| 社区服务站 | 免费审核 | 99元/人 | 推荐联创② 399元、本社区沉淀 10% |
| 专业推荐官 | 3999元 | 99元/人 | 推荐联创② 399元、推荐城市② 10000元+3%沉淀 |
| 城市合伙人 | 10000元 | 99元/人 | 推荐联创② 399元、本区域沉淀 70%、承办沙龙 200元/人 |
- 提现手续费统一 13%，会员建档 199元/人
- 角色 key（不带 `user/` 前缀）: `user` / `public_matchmaker` / `partner_matchmaker` / `professional_recommender` / `community_station` / `city_franchisee` / `admin`
- `users.role` 字段类型: `VarChar(50)`（已同步到数据库，可容纳 `professional_recommender` 24字符）

## 前端架构约定
- 所有请求走 `services/` 层，不直接调 `request()`；环境开关在 `utils/config.js`
- `services/api.js` 统一管理所有 API 路径
- 认证统一走 `services/auth.service.js`，禁止直接读 `globalData` 或 `Storage`
- Mock 数据在 service 文件 `_MOCK` 常量中，由 `DEV_MOCK_DATA` 开关控制

## 后台管理端（renrenmeihao-api）
### 已完成
- ✅ Phase 1: 管理员管理（CRUD + 重置密码 + 本人改密）
- ✅ Phase 2: 用户管理（列表+过滤+详情+状态+推荐链）
- ✅ Decimal 类型修复（activityService / recommendService / walletService）
- ✅ Prisma schema `@map` 修复（createdAt/updatedAt → created_at/updated_at）

### 路由注册状态（`src/index.ts`）
- `/api/auth/*` `/api/admin/*` ✅
- `/v1/auth/*` → miniAuth.ts（wechat-login 已修复，调用微信 jscode2session）
- `/v1/config/public-map` ❌ 缺失（commissionRules.js 依赖）
- `/v1/stats/overview` ❌ 缺失（首页 stats 依赖）

## 待修复
1. **`/v1/config/public-map` 404** → 新建 `src/routes/config.ts`，返回公开配置
2. **`/v1/stats/overview` 404** → 在合适路由中新增 stats overview 接口

## 内容安全审核
- 小程序端: `utils/contentModeration.js`，接入 `serverCheckText` (scene 1/2/4)
- 服务端: `src/routes/moderation.ts`，路由 `/v1/moderation/*`
- 降级策略: access_token 失败时放行

## 注意事项
- 服务器操作必须 SSH: `ssh ubuntu@175.24.227.251`
- 微信开发者工具 `.!XXXXX!filename` 报错 = IDE 缓存，清除缓存重启
- 255.255.255.0/24 是示例，实际服务器 IP: 175.24.227.251
- **NODE_ENV 必须为 production**：`.env` 中 `NODE_ENV=production`，`index.ts` 中已删除 `process.env.NODE_ENV = "development"` 强制设置（2026-05-29 修复）

---

## 身份同步逻辑固化（2026-05-20 验证通过，禁止破坏）

### 服务端（已部署，`/home/ubuntu/renrenmeihao-api/src/`）

| 文件 | 关键逻辑 |
|------|----------|
| `routes/miniAuth.ts` | 微信登录时通过 `referrerId` 查推荐码，`CODE_TYPE_TO_ROLE` 值**不带** `user/` 前缀 |
| `routes/user.ts` | 保存微信号时：先合并占位用户 → 403 检查排除 `openid: { not: null }` → 身份同步优先用 `referrerId: userId` 查 |
| `prisma/schema.prisma` | `User.role` = `VarChar(50)`，`Admin.role` = `VarChar(50)`，已 `db push` 同步 |

### 前端（已保存，本地小程序项目）

| 文件 | 关键逻辑 |
|------|----------|
| `services/auth.service.js` | `setUserRole()`/`getUserRole()` 读写时自动去掉 `user/` 前缀；`setUserInfo()` 同步更新 `user_role` 缓存 |
| `pages/mine/mine.js` | 实际运行的"我的"页面；角色映射 key = `city_franchisee`（带 e） |
| `pages/profile/profile.js` | `request()` 已提取 data，`res` 本身就是 data 对象，不要用 `res.data` |

### 数据库约定
- `users.role` 存储值不含 `user/` 前缀
- 合法值: `user` / `public_matchmaker` / `partner_matchmaker` / `professional_recommender` / `community_station` / `city_franchisee` / `admin`
- `VarChar(50)` 足够容纳最长值 `professional_recommender`（24字符）

---

## 自我推荐机制（2026-05-26 已部署，禁止回退）

### 核心原则
推荐官可以将自己的推荐码绑定给自己（以单身会员建档），但**佣金为 0**。

### 已修改的服务端文件
| 文件 | 变更 |
|------|------|
| `routes/referral.ts` | 删除2处硬阻断（原行115-117 + 原行142-144） |
| `services/recommendService.ts` | 硬阻断替换为 `isSelfReferral` 判断，自推荐时 `reward=0, passiveRate=null` |
| `routes/user.ts` | `rb > 0 && rb !== userId` → `rb > 0` |
| `routes/miniAuth.ts` | `rid && rid !== user.id` → `rid` |

### 安全机制
- 佣金归零由 `recommendService.ts` 保证（`reward: 0`）
- `payment.ts` 中 `self_register` 场景已处理（审计日志，无佣金）
- 推荐记录仍然创建（referrerId === userId 可审计），但 `grantRecommendReward()` 将发放 0 元
