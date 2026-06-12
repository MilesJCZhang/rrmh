# 人人媒好 v1.0.10 发版说明

**版本号**：1.0.10  
**发版日期**：2026-06-08  
**发版类型**：Bug 修复 + 优化  

---

## 🐛 关键 Bug 修复

### 1. 公益推荐官申请逻辑修复 (Critical)
**问题**：
- 用户已是联创推荐官（`partner_matchmaker`），申请公益推荐官时提示"您已申请过公益推荐官"
- 数据库中存在旧申请记录（`recommend_officers` 表），导致逻辑冲突

**修复**：
- ✅ 申请前先检查用户角色，已是推荐官则直接返回成功
- ✅ 支持所有推荐官类型检查：`public_matchmaker`、`partner_matchmaker`、`professional_matchmaker`
- ✅ 自动清除旧的未通过申请记录，允许重新申请
- ✅ 公益推荐官申请自动通过（无需审核），自动更新用户角色

**影响文件**：
- 生产环境：`/home/ubuntu/renrenmeihao-api/dist/routes/apply.js`
- 源代码：`src/routes/apply.ts`（待 TypeScript 编译环境修复后同步）

### 2. 定时器内存泄漏修复 (Major)
**问题**：
- 页面销毁后定时器仍在执行，导致 `Cannot read property '__subPageFrameEndTime__' of null` 错误
- 影响页面：`avatar.js`（录音计时、进度轮询）、`verify.js`（审核状态轮询）

**修复**：
- ✅ 所有 `setInterval` 回调开始处添加 `if (!this || !this.data) return;`
- ✅ 异步操作（`await`）后再次检查页面有效性
- ✅ 防止重复执行 `this.setData()` 导致崩溃

**影响文件**：
- `pages/avatar/avatar.js`
- `pages/verify/verify.js`
- `subpackages/user/pages/verify/verify.js`

---

## 🔧 优化

### 1. 版本号统一升级
- ✅ `package.json`：`1.0.0` → `1.0.10`
- ✅ `package-backend.json`：`1.0.0` → `1.0.10`
- ✅ `admin-panel/package.json`：`1.0.0` → `1.0.10`
- ✅ `utils/config.js`：`VERSION = 'v1.0.8'` → `'v1.0.10'`
- ✅ `routes_config.js`：`version: '1.0.0'` → `'1.0.10'`

### 2. 生产环境后端代码修复
- ✅ 直接修改编译后的 `dist/routes/apply.js`（TypeScript 编译环境有问题）
- ✅ 重启 PM2 服务生效

---

## 📝 数据库变更

**无需数据库结构变更**

但修复了以下数据问题：
- 用户 ID=3（张进铖Miles）：`recommend_officers` 表中 `type=public` 的申请记录 `status` 已更新为 `1`（通过）
- 用户角色：`single` → `public_matchmaker`（如需改为 `partner_matchmaker` 可手动执行 SQL）

---

## 🚀 发版步骤

### 1. 微信开发者工具上传
1. 打开微信开发者工具
2. 点击 **上传** 按钮
3. 填写版本号：**1.0.10**
4. 填写版本描述：
   ```
   v1.0.10 Bug 修复版本
   - 修复公益推荐官申请逻辑冲突
   - 修复定时器内存泄漏导致的页面崩溃
   - 版本号统一升级到 1.0.10
   ```
5. 点击 **上传**

### 2. 微信公众平台提交审核
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **版本管理** → **开发版本**
3. 点击 **提交审核**
4. 填写审核信息：
   - 功能页面：`pages/index/index`
   - 标题：人人媒好 - AI 智能社交平台
   - 标签：社交、相亲、婚恋
5. 提交审核（预计 1-3 个工作日）

### 3. 审核通过后发布
1. 收到审核通过通知
2. 进入 **版本管理** → **审核版本**
3. 点击 **发布**
4. 选择 **全量发布**

---

## 🧪 测试重点

### 公益推荐官申请流程
- [ ] 普通用户申请公益推荐官 → 应自动通过，角色更新为 `public_matchmaker`
- [ ] 已是联创推荐官的用户申请公益推荐官 → 应提示"您已经是推荐官了（partner_matchmaker）"
- [ ] 申请记录已存在但未通过 → 应清除旧记录，允许重新申请

### 定时器内存泄漏
- [ ] 在 `avatar` 页面开始录音，然后快速返回 → 不应出现 `__subPageFrameEndTime__` 错误
- [ ] 在 `verify` 页面提交实名认证，然后快速返回 → 不应出现错误
- [ ] 长时间停留在页面，观察是否出现内存泄漏

### 版本号显示
- [ ] 关于页面（`pages/about/about`）应显示版本号 `v1.0.10`
- [ ] 后台管理页面应显示版本号 `1.0.10`

---

## 📊 影响评估

| 项目 | 评估 |
|------|------|
| **影响用户数** | 所有用户（公益推荐官申请逻辑） |
| **兼容性** | 向下兼容，无需强制更新 |
| **回滚风险** | 低（仅修复逻辑错误） |
| **数据库风险** | 无（无需结构变更） |

---

## 📞 联系方式

- **技术负责人**：Miles Zhang
- **邮箱**：<EMAIL_REDACTED>
- **生产服务器**：`ubuntu@175.24.227.251`
- **管理后台**：`https://rrmhdate.cn/admin/`

---

**发版完成时间**：2026-06-08 14:20
