# 长期记忆

## 项目信息
- 项目名称：人人媒好相亲小程序
- 工作空间：`/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram`
- 技术栈：微信小程序（WXML + WXSS + JS）、Node.js + Express、MySQL

## 用户偏好
- 用户希望功能升级基于现有页面扩展，而非新建独立页面（除非必要）
- 用户关注数据隐私，要求所有数据仅本人可见
- 用户需要详细的技术实施计划和总结文档

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
