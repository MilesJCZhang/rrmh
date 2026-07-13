---
name: admin-dashboard-member-stats
overview: 梳理管理后台仪表盘统计数据，将会员建档（付费会员）与推荐官统计彻底分离，新增"付费会员数"指标，确保业绩数据统计中会员建档只包含付费会员。
todos:
  - id: add-backend-sql
    content: 修改 routes_admin.js：在 dashboard/stats 接口中新增 paidMembers 和 referrerCount 两个 SQL 查询字段，包裹 try/catch 以兼容表缺失
    status: pending
  - id: fix-routes-stats
    content: 修改 routes_stats.js：新增 paidMembers 查询，将 totalMembers 从 totalOrders 修正为实际付费会员数，并补充 referrerCount 字段
    status: pending
  - id: update-dashboard-frontend
    content: 修改 Dashboard/index.tsx：扩展 DashboardStats 接口、更新 fetchStats 取值、在 statCards 末尾追加"付费会员数"和"推荐官数"两张卡片、导入 IdcardOutlined 和 CrownOutlined 图标
    status: pending
    dependencies:
      - add-backend-sql
  - id: deploy-production
    content: 同步生产服务器：将 routes_admin.js 变更写入 dist/routes/admin.js，适配 Prisma 语法，PM2 重启服务
    status: pending
    dependencies:
      - update-dashboard-frontend
      - fix-routes-stats
---

## 需求概述

管理后台仪表盘数据梳理：将会员建档统计限定为仅含"付费会员"，与推荐官角色彻底解耦。

## 核心诉求

- 新增"付费会员数"指标：仅统计支付了 `single_registration`（会员建档费）的独立用户数，排除所有推荐官角色
- 新增"推荐官数"指标：单独统计持有推荐官角色的用户数（partner_matchmaker、professional_recommender、city_franchisee、community_station、public_matchmaker）
- 原有"总用户数"卡片保持不变（涵盖全部用户，含推荐官），通过新增两张独立卡片实现数据分层
- 修正 `routes_stats.js` 中 `totalMembers: totalOrders` 的误导性字段映射

## 涉及范围

- 后端 Dashboard 统计接口（`routes_admin.js`）
- 后端统计概览接口（`routes_stats.js`）
- 前端仪表盘页面（`admin-panel/src/pages/Dashboard/index.tsx`）
- 生产服务器同步部署（`dist/routes/admin.js`）

## 技术方案

### 1. 后端：routes_admin.js 新增统计字段

在 `/v1/admin/dashboard/stats` 接口中新增两个 SQL 查询：

**付费会员数（paidMembers）**：

```sql
SELECT COUNT(DISTINCT user_id) as count FROM orders 
WHERE type = 'single_registration' AND status = 'paid'
```

释义：统计支付过会员建档费（`single_registration`）的独立用户数。不涉及 role 过滤，因为 `single_registration` 作为订单类型本身已界定为"建档付费行为"。推荐官若误操作支付了建档费也会被计入，这是合理的——因为他们的确发生了建档付费行为。如需排除，可在 WHERE 条件中加子查询 `AND user_id NOT IN (SELECT id FROM users WHERE role IN (...referrer roles...))`，但当前方案按订单维度统计更清晰。

**推荐官数（referrerCount）**：

```sql
SELECT COUNT(*) as count FROM users 
WHERE role IN ('partner_matchmaker', 'professional_recommender', 'city_franchisee', 'community_station', 'public_matchmaker')
```

释义：所有持有推荐官角色的用户总数，用于与付费会员形成对照。

新增查询包裹在 try/catch 中，与现有 `totalOrders` 写法保持一致，确保 orders 表不存在时不会导致接口崩溃。

### 2. 前端：Dashboard/index.tsx 修改

**接口扩展**（第22-29行 `DashboardStats`）：

```typescript
interface DashboardStats {
  totalUsers: number;
  todayNewUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPartners: number;
  pendingWithdrawals: number;
  paidMembers: number;     // 新增
  referrerCount: number;   // 新增
}
```

**API 取值更新**（第87-94行 `fetchStats` 中 `setStats`）：

```typescript
paidMembers: d.paidMembers ?? 0,
referrerCount: d.referrerCount ?? 0,
```

**统计卡片新增**（第166-198行 `statCards` 数组末尾追加两张卡片）：

| 卡片 | label | 图标 | 渐变色方案 |
| --- | --- | --- | --- |
| 付费会员数 | `paidMembers` | `IdcardOutlined` | 蓝紫渐变 `linear-gradient(135deg, #a855f7 0%, #6366f1 100%)` |
| 推荐官数 | `referrerCount` | `CrownOutlined` | 琥珀渐变 `linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)` |


每张卡片沿用现有 `StatCardConfig` 结构，含 icon、bgGradient、iconBg（半透明白）、iconColor（白色）、textColor（白色）。

**图标导入补充**（第7-12行 `@ant-design/icons` 导入）：

```typescript
IdcardOutlined, CrownOutlined
```

需在已有 icons 解构中追加这两个图标名。

### 3. 后端：routes_stats.js 修正

第73行 `totalMembers: totalOrders` 是误导性映射。修改为：

```javascript
paidMembers: paidMembers,
totalMembers: paidMembers,
```

同时在该接口中新增 `paidMembers` 的 SQL 查询（与 `routes_admin.js` 相同的 DISTINCT 逻辑），以及 `referrerCount` 字段。新旧字段并行保留以兼容现有调用方。

### 4. 生产服务器同步

本地修改完成并验证后，将 `routes_admin.js` 的变更同步到生产服务器 `dist/routes/admin.js`。如生产环境使用 Prisma（MySQL），需将 SQLite 语法 `db.prepare(...).get()` 转换为 Prisma `$queryRaw` 或 `prisma.orders.groupBy` 写法。

### 技术决策说明

- **paidMembers 按订单而非 role 统计**：付费会员的界定标准是"是否支付了建档费"，而非"当前 role 是否为 user"。这避免了一个用户先支付建档费、后升级为推荐官时被错误排除的问题。
- **新增而非替换**：保留 `totalUsers`，新增 `paidMembers` 和 `referrerCount`，让管理员可以观察 `totalUsers ≈ paidMembers + referrerCount + 其他角色` 的数据关系，便于交叉校验。

## Agent Extensions

### MCP

- **filesystem**
- Purpose: 读取/修改本地文件 `routes_admin.js`、`routes_stats.js`、`admin-panel/src/pages/Dashboard/index.tsx`
- Expected outcome: 完成三个文件的精准编辑，新增 SQL 查询与前端统计卡片代码

### SubAgent

- **code-explorer**
- Purpose: 在生产部署阶段定位 `dist/routes/admin.js` 中对应的统计代码段，确认需要同步修改的内容
- Expected outcome: 找到生产构建产物中的等价代码位置，输出需修改的具体行号和当前内容