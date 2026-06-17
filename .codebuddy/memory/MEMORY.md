# 长期记忆

## 项目信息
- 项目名称：人人媒好相亲小程序
- 工作空间：`/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram`
- 技术栈：微信小程序（WXML + WXSS + JS）、Node.js + Express、MySQL

## 用户偏好
- 用户希望功能升级基于现有页面扩展，而非新建独立页面（除非必要）
- 用户关注数据隐私，要求所有数据仅本人可见

## 生产服务器关键信息（2026-06-17 更新）
- 服务器：ubuntu@175.24.227.251
- 后端服务：renrenmeihao-api，PM2 管理，端口 3001
- 数据库：MySQL `renrenmeihao`，用户 root，密码 Rrmh@2026
- 关键路径：后端 `/home/ubuntu/renrenmeihao-api/`，管理后台 `/var/www/admin/`
- Nginx：rrmhdate.cn → 443 端口，管理后台 SPA `/admin/`，API `/api/*`→3001，`/v1/*`→3001
- 管理后台 API 路径：`/v1/admin/*` 和 `/admin-api/*`（Nginx rewrite → `/api/admin/*`）均可
- PM2 重启 1344 次（含全部 rebuild 重启），当前稳定运行 26 分钟无异常

## Prisma 模型名注意事项（关键！）
- 数据库表 `activities` / `activity_registrations`（**不是** `salon` / `salonGroupMember`）
- 数据库表 `referral_codes`（字段 referrerId，**不是** owner_id）
- 推荐关系表 `user_referrals` **不在 Prisma schema 中**，使用 `$executeRawUnsafe` 操作
- **node_modules 已修复**（2026-06-17 08:30）：`rm -rf node_modules && npm install`，`npx tsc` 可正常编译
- dist 和 src 已双向同步（所有补丁已编译到 dist）
- `exceljs` 已安装（沙龙导出依赖）

## 项目约定
- 前端服务层统一在 `/services/` 目录下扩展，不直接在页面中调用 `request()`
- 后端API端点统一在 `/services/api.js` 中定义，页面/服务层禁止硬编码路径
- 数据库表名使用复数形式（如 `visitor_logs`），字段名使用下划线分隔（如 `referrer_id`）
- 前端分页参数默认每页10条记录（`PAGE_SIZE = 10`）
- 后端接口需做好权限校验，从 token 中获取用户ID，只能查询自己的数据

## 关键注意事项
- **Prisma 字段命名**：Schema 使用 `created_at` / `updated_at`（snake_case）作为 Prisma Client 字段名，非 `createdAt` / `updatedAt`（camelCase）。所有 Prisma 查询必须用 snake_case 字段名。已有 18 个 dist 文件因此被批量修复过。
- **Raw SQL 列名**：数据库列名统一用 `updated_at`（snake_case），所有 raw SQL 中的 `updatedAt = NOW()` 需写成 `updated_at = NOW()`
- `recommendCode` / `recommendedBy` / `createdBy` 等是合法的 camelCase Prisma 字段

## 架构关键事实（2026-06-17 更新）

### 后端服务现状
- **S1（线上生产）**：renrenmeihao-api，端口 3001，MySQL `renrenmeihao`，Prisma ORM，TypeScript，PM2 管理。路径 `/home/ubuntu/renrenmeihao-api/dist/`。运行状态：在线（pid 1279477，重启 1131 次不稳定）。
- **S2（本地开发）**：`miniprogram/server.js`，端口 3000，SQLite `renrenmei.db`，better-sqlite3 裸 SQL，JavaScript。未部署到服务器。功能比 S1 更完整（含微信支付、推荐绑定、身份升级、手机号绑定）。
- **S3（已废弃）**：`/var/www/renrenmei/server/routes/`，18 个路由文件，5月后不再维护。

### S2 独有但 S1 缺失的核心功能
1. 微信支付完整集成（下单/回调/签名验证/佣金触发）
2. 微信登录 + 推荐关系绑定（wechat-login / bind-phone）
3. 付费后身份自动升级 + 推荐码生成
4. 匹配推荐（matchmaker）、会员建档（member）
5. user_referrals 表（推荐关系链，MySQL 完全缺失）

### 管理后台现状
- **A1（唯一生产）**：React 18 + CRA + Ant Design 5，`/var/www/admin/`，`main.dc719cf7.js`（1.9MB），16 个页面 26 条路由。访问 URL：`https://rrmhdate.cn/admin/`
- **A3/A4/A5/A6**：已于 2026-06-17 全部归档隔离至 `_archived/` ✅

### MySQL 关键表（33张）
用户/推荐/沙龙/支付/佣金/验资/评分等均已建表。缺失：`user_referrals`（推荐关系）、`commission_failures`（佣金失败记录）、`apply_records`（角色申请）。

### Nginx 路由
- `/admin/*` → `/var/www/admin/`（管理后台 SPA）
- `/admin-api/*` → rewrite `/api/admin/*` → proxy 3001
- `/v1/*` + `/api/*` → proxy 3001

### 输出文档
- 完整整合方案：`多套后端管理后台全面整合方案.md`（含盘点表、风险分析、两套方案、分步操作流程、统一开发规范）

## 已完成工作
- 2026-06-11：推荐码系统统一修复
  - 修正 `ReferralCodeService.js` 支持全部5类身份前缀（LCRG/GYRG/ZYRG/SQZD/CSHH）
  - 创建 `routes_apply.js` 实现公益推荐官申请+自动生成带身份前缀推荐码
  - 修复 `apply.js` 中 `await request()` 缺少 `const res=` 赋值的 Bug（两处文件）
  - 运行 `fix_all_referral_codes.js` 将全部5个用户推荐码统一为8位前缀格式
  - 修复 `routes_admin_users.js` 查询缺少 `referral_code` 字段的问题
  - 已有用户推荐码：不合规的仅修正格式，不改变归属关系；缺失的自动生成
- 2026-06-02：推荐官工作台功能升级（前端改造完成，后端待实施）
  - 扩展 `api.js` 和 `referral.service.js`
  - 修改 `matchmaker-workbench` 页面（WXML/JS/WXSS）
  - 创建 `visitor_logs` 表SQL脚本
- 2026-06-03：沙龙系统扩容（27人封顶 + 每周限制 + 性别专场）
  - 后端 `routes_salon.js`：重写容量校验（每周1次/性别校验/27人封顶/随行资料）
  - 数据库迁移：4个SQL文件（002~005）
  - 前端 `salon-list`：头部徽章 `6人`→动态 `{{totalCap}}人`，卡片名额动态渲染
  - 前端 `salon-detail`：规格卡片/进度条/文案均支持性别型沙龙和27人封顶
  - 新增 `routes_salon_export.js`：Excel导出+海报生成接口
  - 角色白名单：`partner_matchmaker/community_station/city_franchisee/professional_recommender`

## 待办事项
- 后端开发者需实现4个新API接口（`/v1/referral/workbench-stats`、`/v1/referral/workbench-detail`、`/v1/referral/visitor-log`、`/v1/referral/visitor-update`）
- 执行数据库脚本创建 `visitor_logs` 表
- 前端开发者需在小程序入口页面和注册完成后的回调中调用新增的服务方法
- 测试四大分类数据看板功能（搜索、展开/收起、分页加载、下拉刷新等）
