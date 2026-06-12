# 人人媒好 v1.0.5 发版说明

发版日期：2026-05-24
版本号：1.0.5

---

## 🐛 Bug 修复

### 1. 修复支付下单 500 错误
- **现象**：用户支付时提示"支付下单失败: undefined"
- **根因**：`xmlToJson()` 函数未正确处理微信支付 XML 响应的外层 `<xml>...</xml>` 包裹标签，导致解析失败
- **修复**：重写 `xmlToJson()`，先剥离外层标签再解析内部字段；同时修复 Prisma Decimal 类型转数字的问题

### 2. 修复退款接口 404 错误
- **现象**：申请退款时提示 404
- **根因**：前端传递的是 `item.id`（数据库主键），但后端路由 `/refund/:orderNo` 期望的是订单号（如 `PAYxxx`）
- **修复**：前端 WXML 和 JS 改为传递 `item.orderNo`

### 3. 修复支付回调未升级用户角色（重要）
- **现象**：用户支付 399 元联创推荐官费用后，角色仍为普通用户，未获得推荐官权限，推荐码也未自动创建
- **根因**：微信支付回调 `/notify` 路由只更新了支付状态，未处理角色升级和推荐码创建逻辑
- **修复**：回调中根据 `payment.type` 自动映射用户角色，并为有推荐资格的角色自动生成推荐码

### 4. 修复访客扫码推荐官二维码提示"二维码内容为空"
- **根因**：
  - 后端 `/miniapp-qrcode` 接口返回的是假数据，未真正调用微信 API 生成小程序码
  - 前端 `app.js` 的 `_handleScene` 只处理 URL 参数格式的 scene，不处理纯邀请码格式
- **修复**：
  - 后端新增 `getWechatAccessToken()` 和 `generateMiniAppQrcode()`，真实调用微信 `wxa/getwxacodeunlimit` API
  - 前端 `_handleScene` 新增：当 scene 不含 `=` 时当作纯邀请码处理

### 5. 修复访客扫码后提示"绑定失败，请重试"
- **根因**：后端缺少 `POST /v1/user/referral/verify` 接口，前端调用失败
- **修复**：新增该接口，支持同时查询 `User` 表和 `ReferralCode` 表的推荐码

---

## ✨ 新增功能

### 1. 支付成功自动升级角色 + 自动创建推荐码
支付回调现在会自动：
- 根据支付类型（`partner_upgrade` / `professional_upgrade` 等）映射用户角色
- 为有推荐资格的角色（联创推荐官、专业推荐官、社区服务站、城市合伙人）自动生成推荐码并写入数据库

**类型映射表：**
| 支付类型 | 升级后角色 |
|---------|-----------|
| `partner_upgrade` | `partner_matchmaker`（联创推荐官） |
| `professional_upgrade` | `professional_recommender`（专业推荐官） |
| `community_upgrade` | `community_station`（社区服务站） |
| `city_upgrade` | `city_franchisee`（城市合伙人） |
| `membership` | `member`（会员） |

### 2. 真实微信小程序码生成
推荐官"生成小程序码"功能现在调用微信官方 API 生成真实可扫码的小程序码（之前是假图片）。

---

## 🔧 后端 API 变更

### 新增接口
| 接口 | 方法 | 说明 |
|------|------|------|
| `/v1/user/referral/verify` | POST | 验证推荐码有效性（供前端绑定推荐关系前调用） |

### 修复接口
| 接口 | 问题 | 状态 |
|------|------|------|
| `/v1/payment/create` | 500 错误（xmlToJson 解析失败） | ✅ 已修复 |
| `/v1/payment/refund/:orderNo` | 404（前端传参错误） | ✅ 已修复 |
| `/v1/payment/notify` | 支付成功未升级角色 | ✅ 已修复 |

---

## 📱 前端文件变更

| 文件 | 变更说明 |
|------|----------|
| `app.js` | `_handleScene` 支持纯邀请码格式 scene |
| `pages/user/orders/orders.wxml` | 退款按钮 `data-id` → `data-order-no` |
| `pages/user/orders/orders.js` | `onRefund` 读取 `dataset.orderNo` |
| `utils/referral.js` | `verifyCode()` 调用新增的 `/referral/verify` 接口 |

---

## 🗄️ 数据库变更

无 schema 变更，但 `/notify` 回调逻辑变更会影响以下表的数据写入：
- `users.role`：支付成功后自动更新
- `users.recommendCode`：有推荐资格的角色自动填入
- `referral_codes`：自动插入新推荐码记录

---

## 📋 发版核查清单

- [x] 后端 `npx tsc` 编译 0 错误
- [x] PM2 进程 `renrenmeihao-api` 已重启（pid: 767678）
- [x] 前端代码已同步到本地小程序项目
- [ ] 微信开发者工具上传代码，填写版本号 **1.0.5**
- [ ] 在微信开放平台提交审核
- [ ] 审核通过后发布线上版本
- [ ] 发布后验证支付全流程（下单 → 支付 → 角色升级 → 推荐码生成）
- [ ] 验证退款流程

---

## 📞 技术支持

如有问题，请联系开发者。
