# 人人媒好 · 同城兴趣社交 / 相亲撮合小程序

> 仓库维护说明（技术栈与目录结构，对应 `技术栈与目录结构分析.md` 的落地整改结果）。

## 一、三端架构

```
用户端小程序（微信原生 WXML/JS）
   │  HTTPS /v1/*
   ▼
后端 API ── 本地开发态 S2：Node + Express 5 + better-sqlite3（backend/s2/，renrenmei.db）
          └─ 生产态 S1：TypeScript + Prisma + MySQL（服务器 /home/ubuntu/renrenmeihao-api/，源码见 backend/s1-reference 回拉清单）
管理后台（React 18 + AntD 5 + TS，admin-panel/）→ 同源 /v1/admin/* 与 /api/admin/*
```

## 二、目录结构（整改后）

```
miniprogram/
├── app.js / app.json / app.wxss      小程序入口、全局配置、国风样式系统
├── project.config.json               开发者工具配置（appid: wx08bbe40b9429b9a4）
├── package.json                    小程序元信息 + S2 后端依赖；scripts.server = node backend/s2/server.js
├── pages/                         主包页面（app.json 注册 9 个）+ 保守保留的 matchmaker/、user/
├── subpackages/                   6 个分包：activity / matchmaker / partner / social / user / premium
├── components/                    自定义组件（privacy-popup / score-bar）
├── services/                     前端服务层（api.js 为 API 端点注册表；index.js 统一出口）
├── utils/                       工具函数（config.js 配置中心 / request.js 双模式网络层 / 角色与业务工具）
├── constants/roles.js           七级角色体系（前后端共用）
├── backend/
│   ├── s2/                    本地开发后端（server.js + routes_*.js + config.js + auth-middleware.js + commission_engine.js）
│   └── s1-reference/          S1 生产后端 TS 参考片段 + 回拉清单 README.md
├── admin-panel/                 管理后台（React + AntD + TS + CRA）
├── scripts/                    Python/Shell/JS 运维与 DB 维护脚本（deploy/ fix/）
├── database/                   migrations/ 14 个 MySQL 迁移 + adhoc/ 散落 SQL
├── docs/                      架构/部署/接口文档 + history/ 过程文档 + reference/ 原始数据 + deliverables/
└── _archive/                 已归档的废弃代码与临时文件（不入库，可本地恢复）
```

## 三、版本基线（升级依据）

| 组件 | 版本 | 说明 |
|------|------|------|
| 小程序 | v1.0.24 | 基础库 libVersion 3.15.1 |
| 管理后台 | v1.0.10 | React 18 + Ant Design 5 + TypeScript 4.9 + CRA 5 |
| 后端 S2（本地） | Node ≥ 14 | Express 5.2 + better-sqlite3 12（SQLite 文件 renrenmei.db） |
| 后端 S1（生产） | — | TypeScript + Prisma + MySQL（renrenmeihao 库，PM2 端口 3001） |
| 样式库 | weui-miniprogram 1.2.3 | 叠加自研国风设计令牌（app.wxss） |

> CRA 5 已步入维护模式；小程序基础库升级前需在 `utils/request.js` 增加 SDKVersion 检测，避免新 API 在低版本静默失效。

## 四、本地开发

- 小程序：用微信开发者工具打开本目录，`utils/config.js` 中 `ENV='dev'` 指向本地 `http://<局域网IP>:3000`。
- 本地后端：`npm install` 后 `npm run server`（即 `node backend/s2/server.js`，监听 3000，库文件 `renrenmei.db` 位于仓库根目录）。
- 管理后台：`cd admin-panel && npm install && npm start`（CRA 开发服务器）。

## 五、工程约定（务必遵守）

1. **API 端点集中**：所有 `/v1/*` 路径只定义在 `services/api.js`，页面/服务层禁止硬编码（后端改路径只改此文件）。
2. **配置中心化**：环境、API 地址、功能开关、版本号统一在 `utils/config.js`。
3. **角色体系**：七级角色与推荐码前缀定义在 `constants/roles.js`，前后端共用。
4. **后端双轨**：S2 为开发态（功能更全，含微信支付/推荐绑定）；S1 为生产态。**任何接口改动先在 S2 验证，再同步 S1**，并在 PR 描述标注“已同步 S1”。
5. **Prisma 约定**：字段用 snake_case（`created_at`/`updated_at`）；`user_referrals` 等未建模表用 `prisma.$executeRawUnsafe`。
6. **_archive/ 与 *.db 不入库**：本地开发库与归档文件已在 `.gitignore` 排除。

## 六、已知待办（不在本次整改范围）

- `pages/payment/success.js` 存在两处死链接：`/pages/matchmaker/appointment/appointment`、`/pages/user/invoice/invoice`（目标页面不存在）。
- `pages/reunion/reunion.js` 等存在 `/subpackages/social/subpackages/social/...` 重复前缀，导航会失败，需修正为单前缀。
- S1 完整 TypeScript 源码尚未纳入版本管理，需按 `backend/s1-reference/README.md` 手动从服务器回拉。
