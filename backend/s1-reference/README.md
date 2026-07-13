# S1 生产后端源码回纳入库（手动执行清单）

本目录仅存放本地已有的 S1 TypeScript 参考片段（`src/routes/user.ts`、`src/services/score.service.ts`、`salon_config_routes.ts`）。**完整的生产后端源码仍在服务器上，尚未纳入版本管理**，这是风险 1 的根因。

> ⚠️ 以下操作会读取生产服务器文件，请由负责人手动执行，**不要自动 SSH / 不要改写生产运行态**。执行前请确保已对生产 `dist/` 与数据库做过备份。

## 服务器信息（来自 MEMORY）
- 主机：`ubuntu@175.24.227.251`
- 生产后端目录：`/home/ubuntu/renrenmeihao-api/`
- 技术栈：TypeScript + Prisma + MySQL（`renrenmeihao`），PM2 管理 `renrenmeihao-api`，端口 3001
- Nginx：`https://rrmhdate.cn`，`/v1/*`、`/api/*` → 3001

## 步骤（在本地终端逐条执行）
1. SSH 登录生产服务器：
   ```bash
   ssh ubuntu@175.24.227.251
   ```
2. 在服务器上打包完整源码（排除 node_modules 与已编译的 dist）：
   ```bash
   cd /home/ubuntu
   tar czf renrenmeihao-api-src.tar.gz --exclude=node_modules --exclude=dist renrenmeihao-api
   ```
3. 退出 SSH，把包拉回本地并解压到本仓库：
   ```bash
   scp ubuntu@175.24.227.251:/home/ubuntu/renrenmeihao-api-src.tar.gz .
   mkdir -p backend/s1
   tar xzf renrenmeihao-api-src.tar.gz -C backend/s1 --strip-components=1
   rm renrenmeihao-api-src.tar.gz
   ```
4. 确认 `backend/s1/` 包含 `src/`、`prisma/`、`package.json`、`ecosystem.config.js` 等，且 `.gitignore` 已忽略 `node_modules/`、`dist/`。
5. 将本目录（`backend/s1-reference/`）下仅作参考的旧片段删除，统一以 `backend/s1/` 为唯一真相源。
6. 提交：`git add backend/s1 && git commit -m "chore: 纳入生产后端 S1 完整 TypeScript 源码"`

## 与 S2 的关系
- `backend/s2/`（见 relocate 任务）是本地开发态（JS + Express + SQLite），功能更全（含微信支付、推荐绑定等）。
- 任何接口改动：**先在 S2 验证，再同步到 S1**，并在 PR 描述标注“已同步 S1”。
- S1 缺 `user_referrals` 等表，未建模部分用 `prisma.$executeRawUnsafe` 操作（沿用 MEMORY 约定）。
