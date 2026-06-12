# 人人媒好小程序 上线审核全面评估报告

> 审核时间：2026-05-01  
> 审核范围：小程序前端代码、配置、合规、内容安全  
> 审核结论：**可提交审核，有 3 项必须修复、6 项建议优化**

---

## 一、审核总览

| 维度 | 结论 | 关键风险 |
|------|------|---------|
| 环境配置 | ✅ 正常 | DEV_MODE=false, DEV_MOCK_DATA=false |
| 页面结构 | ⚠️ 有问题 | 存在未使用页面和重复路径 |
| 内容安全 | ✅ 基本完善 | 图片审核接入未完成 |
| 隐私合规 | ✅ 完善 | 隐私政策、协议页完整 |
| 支付合规 | ✅ 正常 | 微信支付流程规范 |
| 用户协议 | ✅ 完整 | 5 类角色协议全覆盖 |
| 敏感词 | ✅ 已清理 | 婚恋/相亲等词已替换 |
| API 安全 | ✅ 正常 | token 鉴权完整 |
| 上线开关 | ✅ 已关闭 | config.js 均已关闭 |

---

## 二、必须修复（M级 — 影响审核通过）

### M1 ⛔ app.json 注册了不存在的页面路径

以下页面在 `app.json` 中注册，但**实际目录未找到对应文件**，会导致编译失败或上线被拒：

```
pages/reunion/reunion
pages/reunion/reunion-profile
pages/reunion/reunion-chat
pages/group/group
pages/franchisee/online/apply
pages/cooperation/intro/intro
pages/cooperation/partners/partners
pages/cooperation/apply/apply
pages/customer-service/customer-service
pages/user/user/user
pages/user/profile/profile
pages/user/orders/orders
pages/user/membership/membership
pages/matchmaker/list/list
pages/matchmaker/detail/detail
pages/payment/success/success
pages/payment/fail/fail
pages/payment/refund/refund
```

**修复方案**：检查上述路径是否存在，不存在则从 `app.json` 的 `pages` 数组移除，或补齐对应页面文件（空壳页面即可）。

---

### M2 ⚠️ project.config.json 中 urlCheck=false

```json
"urlCheck": false,
```

该设置在开发环境禁用域名校验。**上线前必须将其改为 `true`** 或删除该字段，同时在微信公众平台将 `https://rrmhdate.cn` 配置到合法域名白名单中。

**需在微信公众平台 → 开发设置 → 服务器域名 中配置：**
- request 合法域名：`https://rrmhdate.cn`
- uploadFile 合法域名：`https://rrmhdate.cn`
- downloadFile 合法域名：`https://rrmhdate.cn`（如有）

---

### M3 ⚠️ register.js 头像上传缺少内容安全检测

`pages/register/register.js` 的 `onAvatarUpload()` 直接上传头像，**未经过图片安全检测**：

```js
// 当前代码（register.js:206-223）
async onAvatarUpload() {
  const uploaded = await uploadFile(tempFile, 'avatar');  // ← 直接上传，无审核
  this.setData({ 'form.avatar': uploaded.url });
}
```

**修复方案**：在 `uploadFile` 前调用 `serverCheckImageUpload(tempFile, token)`，检测通过再上传。

---

## 三、建议优化（S级 — 不影响通过，但影响用户体验和运营）

### S1 salon.js 封面图上传入口未实现

`salon.js` 的 `formData.cover` 字段有定义，但 **WXML 中没有封面图上传 UI**。城市合伙人创建沙龙时没有封面图入口。

**建议**：在创建表单中加入封面图上传组件，并调用 `serverCheckImageUpload` 进行审核。

---

### S2 profile.js 头像上传逻辑待完成

`pages/profile/profile.js` 头像上传功能已部分实现（`onChooseAvatar`、`serverCheckImageUpload` 已引入），但 `hasNewAvatar` 判断逻辑存在问题——使用 `wxfile://` 前缀判断，而微信临时文件在模拟器中可能以 `http://tmp/` 开头，导致判断失效，头像不上传但显示 "上传失败"。

**建议**：改为判断 `avatar.startsWith('http://') === false && avatar !== ''` 或在 `onChooseAvatar` 时用独立 `isLocalAvatar` 标志。

---

### S3 partner-apply.js 中联创→专业路径说明有误

`partner-apply.js:120` 中 `note` 字段写的是：
```
'升级费 ¥3999 · 需先成为公益/联创推荐官'
```
但根据 MEMORY.md 分润规则 v5.1，**所有身份均可升级专业推荐官**，无需先成为公益/联创。建议修正提示文案。

---

### S4 tabBar 中 "AI推荐官" 文字存在合规隐患

`app.json` tabBar 第2项文字为 **"AI推荐官"**，微信可能认为"推荐官"与交友/婚介关联，建议改为 **"AI推荐"** 或 **"推荐"**。

---

### S5 app.json 权限说明文案过于模糊

```json
"scope.userLocation": { "desc": "用于推荐附近的社区活动和圈友" }
```

微信审核对位置权限描述要求明确。建议改为：
```
"用于查找您附近的社区活动和同城会员，不会用于其他目的"
```

---

### S6 register.js 中手机号直接提交服务端存在隐私风险

`register.js` 直接收集手机号并提交到 `/user/profile/update`，但没有验证用户手机号归属（短信验证码）。若审核员关注隐私合规，可能被问询。建议后端加短信验证码流程或在隐私协议中明确说明用途。

---

## 四、内容安全审核完整性总结

| 场景 | 小程序端文本 | 服务端文本 | 图片安全 |
|------|:-----------:|:---------:|:-------:|
| 资料填写 (profile) | ✅ | ✅ | ⚠️ 接入未完成 |
| 会员建档 (register) | — | ✅ | ⚠️ 未接入 |
| AI分身生成 (avatar) | — | ✅ | — |
| 私信消息 (chat) | ✅ | ✅ | — |
| 约见申请 (chat) | ✅ | ✅ | — |
| 沙龙创建 (salon) | ✅ | ✅ | ⚠️ 未有封面上传 |

---

## 五、上线前 Checklist

```
□ M1 清理 app.json 中不存在的页面路径
□ M2 微信公众平台配置合法域名，urlCheck 改为 true
□ M3 register.js 头像上传前加图片安全检测
□ S1 salon.js 补封面上传 UI + 图片审核
□ S2 profile.js 修复 hasNewAvatar 判断逻辑
□ S3 修正专业推荐官升级说明文案
□ S4 tabBar "AI推荐官" 改为 "AI推荐"
□ S5 优化位置权限说明文案
□ 确认服务器 WECHAT_APP_SECRET 已配置（✅ 已配置）
□ 确认 ENV='prod' / DEV_MODE=false / DEV_MOCK_DATA=false（✅ 已确认）
```

---

## 六、高优先级修复代码示例

### M3 register.js 头像安全检测修复

```js
// 在 onAvatarUpload 中，uploadFile 前加审核
const { serverCheckImageUpload } = require('../../utils/contentModeration');

async onAvatarUpload() {
  try {
    const res = await new Promise((resolve, reject) => {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'],
        sourceType: ['album', 'camera'], success: resolve, fail: reject });
    });
    const tempFile = res.tempFiles[0].tempFilePath;
    this.setData({ 'form.avatar': tempFile });

    // ✅ 图片安全检测
    const token = wx.getStorageSync('token') || '';
    const safeResult = await serverCheckImageUpload(tempFile, token);
    if (!safeResult.safe) {
      wx.showToast({ title: '头像图片不合规，请重新上传', icon: 'none' });
      this.setData({ 'form.avatar': '' });
      return;
    }

    const uploaded = await uploadFile(tempFile, 'avatar');
    this.setData({ 'form.avatar': uploaded.url });
  } catch (e) {}
},
```

---

*报告生成：2026-05-01 | 人人媒好小程序审核前自查*
