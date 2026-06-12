---
name: 推荐官工作台功能升级
overview: 基于现有 matchmaker-workbench 页面扩展，新增四大分类数据看板（联创推荐官/公益推荐官/已注册会员/未注册访客），新增搜索、展开明细、下拉刷新、上拉加载更多功能，后端需新建访客追踪机制。
---

`、`<tech><![CDATA[`、`<todolist>` 等标签。

注意：由于用户需求是扩展现有页面（而非全新UI设计），且现有页面已有完整样式，根据规则不需要输出 `<design>` 标签（不是创建全新UI或显著翻新UI）。

现在输出完整计划：```xml
<plan_result>
<req>

## 产品概述

在现有推荐官工作台（matchmaker-workbench）基础上扩展功能，新增专属数据看板，自动统计通过本人专属码/链接引流的全部人员，分类展示累计人数与人员明细，帮助推荐官直观掌握团队及流量资源。

## 核心功能

1. **功能入口**：人人媒好小程序 → 【我的】→【推荐官工作台】；权限：所有推荐官（public_matchmaker、partner_matchmaker、city_franchisee、professional_recommender、community_station）有此权限，普通会员及访客无。
2. **全局搜索框**：支持按姓名检索人员数据。
3. **累计联创推荐官模块**：统计通过本人渠道入驻、缴纳399元的人员；展示累计总人数 + 点击查看明细（姓名、入驻时间、状态）。
4. **累计公益推荐官模块**：统计通过本人渠道免费注册、开通公益推荐官身份的人员；展示累计总人数 + 点击查看明细（姓名、注册时间）。
5. **累计已注册单身会员模块**：统计通过本人渠道进入，完成资料填写、正式注册的单身用户；展示累计总人数 + 点击查看明细。
6. **累计未注册访客模块**：统计扫码/点击链接进入小程序，但未完成注册（未支付199元建档）的访客；展示累计总人数 + 明细（访客昵称、到访时间）。
7. **通用交互规则**：

- 每个分类模块均为「总数+明细列表」组合形式，点击即可展开查看名单
- 数据实时自动更新，所有数据仅本人可见，保护隐私
- 无对应数据时，页面显示「暂无对应人员数据」
- 支持下拉刷新、上拉加载更多

8. **身份权限**：联创推荐官、公益推荐官可正常查看全部四类数据及明细；普通单身会员、未注册用户无该页面访问权限。

## 技术栈

- 前端框架：微信小程序（WXML + WXSS + JS）
- 后端API：Node.js + Express（基于现有 `api.js` 端点体系）
- 数据库：MySQL（基于现有表结构扩展）
- 服务层：现有 `referral.service.js`、`income.service.js` 扩展

## 实施方案

### 一、数据库层变更（后端）

#### 1. 新建 `visitor_logs` 表（访客追踪机制）

```sql
CREATE TABLE IF NOT EXISTS visitor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL COMMENT '推荐官用户ID',
    referrer_code TEXT NOT NULL COMMENT '推荐码',
    visitor_openid TEXT NOT NULL COMMENT '访客openid',
    visitor_nickname TEXT COMMENT '访客昵称',
    visit_time TEXT DEFAULT CURRENT_TIMESTAMP COMMENT '到访时间',
    reg_status TEXT DEFAULT 'pending' COMMENT '注册状态：pending/registered',
    visitor_avatar TEXT COMMENT '访客头像',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id)
);
CREATE INDEX idx_visitor_referrer ON visitor_logs(referrer_id);
CREATE INDEX idx_visitor_openid ON visitor_logs(visitor_openid);
CREATE INDEX idx_visitor_status ON visitor_logs(reg_status);
```

#### 2. 扩展现有表（如需）

- `users` 表已有 `referral_code` 字段（用于关联推荐关系）
- `orders` 表用于判定是否缴费（199元会员建档、399元联创推荐官）
- `referral_relationships` 表已有推荐关系链

### 二、后端API层新增

#### 1. 在 `api.js` 中新增端点

```javascript
// 推荐官工作台数据看板
WORKBENCH: {
    STATS:      '/v1/referral/workbench-stats',      // GET 四大分类统计数据
    DETAIL:     '/v1/referral/workbench-detail',     // GET 分类明细列表（分页、搜索）
    VISITOR_LOG: '/v1/referral/visitor-log',        // POST 记录访客到访
    VISITOR_UPDATE: '/v1/referral/visitor-update',  // PUT 更新访客注册状态
}
```

#### 2. 后端接口逻辑（`referral.service.js` 或新增 `workbench.service.js`）

**`GET /v1/referral/workbench-stats`**：

- 入参：`referrer_id`（从 token 中获取，无需前端传递）
- 出参：

```
{
  "code": 200,
  "data": {
    "partner_matchmaker_count": 5,
    "public_matchmaker_count": 12,
    "registered_member_count": 36,
    "visitor_count": 120
  }
}
```

- 数据统计逻辑：
- **联创推荐官**：通过 `referral_relationships` 表找到 `referrer_id` 下的 `referee_id`，再关联 `users` 表和 `orders` 表，筛选 `role = 'partner_matchmaker'` 且存在 `type='partner_matchmaker'` 的已支付订单。
- **公益推荐官**：通过 `referral_relationships` 表找到 `referrer_id` 下的 `referee_id`，关联 `users` 表，筛选 `role = 'public_matchmaker'`。
- **已注册单身会员**：通过 `referral_relationships` 表找到 `referrer_id` 下的 `referee_id`，关联 `users` 表，筛选 `role = 'user'` 且 `has_profile = true`（已完成资料填写）。
- **未注册访客**：从 `visitor_logs` 表查询 `referrer_id` 下的记录，筛选 `reg_status = 'pending'`。

**`GET /v1/referral/workbench-detail`**：

- 入参：`type`（partner_matchmaker/public_matchmaker/registered_member/visitor）、`page`、`page_size`、`keyword`（选填，按姓名搜索）
- 出参：对应分类的明细列表，支持分页。

**`POST /v1/referral/visitor-log`**：

- 用途：在小程序入口（首页、扫码落地页）记录访客到访行为。
- 逻辑：当用户通过推荐码/链接进入小程序时，检查是否已有注册记录，若无则在 `visitor_logs` 表中插入记录。

**`PUT /v1/referral/visitor-update`**：

- 用途：当访客完成注册后，更新 `visitor_logs` 表中的 `reg_status` 为 `registered`，避免重复统计。

### 三、前端服务层扩展

#### 1. 扩展 `referral.service.js`

新增以下方法：

```javascript
// 获取工作台统计数据
function getWorkbenchStats() { ... }

// 获取工作台明细列表（分页、搜索）
function getWorkbenchDetail(params) { ... }

// 记录访客到访
function logVisitor(data) { ... }
```

#### 2. 扩展 `income.service.js`（如需）

如需复用现有数据流模式，可在 `income.service.js` 中新增 `loadWorkbenchData()` 方法，并发请求统计数据和首屏明细数据。

### 四、前端页面层扩展

#### 1. 修改 `matchmaker-workbench.wxml`

在现有内容上方（hero-card 下方、stats-section 上方）新增：

- **搜索框**：使用 `