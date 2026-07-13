# /income/summary 接口部署指南

## 已完成的修改

### 1. 后端修改（本地路径：`/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/`）

#### 新建文件：`routes_income.js`
- 实现 `GET /income/summary` 接口
- 从 `commission_records` 表计算总收入（status = 'confirmed'）
- 从 `withdrawals` 表计算已提现和冻结中金额
- 返回格式：`{ withdrawable, total, withdrawn, frozen }`

#### 修改文件：`server.js`
- 在第92行后添加路由注册：
```javascript
// 12. 收入汇总路由（用户端）
try {
  app.use('/income', require('./routes_income'));
  console.log('[server] routes_income 加载成功');
} catch (e) {
  console.log('[server] routes_income 加载失败，跳过');
}
```

### 2. 前端修改（本地路径：`/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/pages/mine/mine.js`）

#### 修改函数：`loadPendingIncome()`
- 移除 DEV_MODE 下的提前返回逻辑
- 总是先尝试调用真实接口 `/income/summary`
- 接口失败时，DEV_MODE 下使用 mock 数据，生产环境静默失败

---

## 部署步骤

### 步骤1：上传后端文件到远程服务器

```bash
# SSH 登录到远程服务器
ssh ubuntu@175.24.227.251

# 进入后端项目目录
cd /home/ubuntu/renrenmeihao-api

# 创建 routes_income.js 文件（内容见下方）
# 或者使用 scp 从本地上传
```

**`routes_income.js` 完整内容**：
```javascript
/**
 * 收入汇总路由
 * 提供收入查询API
 * GET /income/summary - 获取收入汇总（用户端）
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');

const router = express.Router();

/**
 * 获取收入汇总（用户端）
 * GET /income/summary
 * 返回：总收入、已提现、冻结中、可提现
 */
router.get('/summary', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  
  try {
    // 1. 计算总收入（从 commission_records 表，已确认的佣金）
    const totalResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM commission_records 
      WHERE user_id = ? AND status = 'confirmed'
    `).get(user_id);
    
    // 2. 计算已提现金额（已审核通过或已支付的提现）
    const withdrawnResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM withdrawals 
      WHERE user_id = ? AND status IN ('approved', 'paid')
    `).get(user_id);
    
    // 3. 计算冻结中金额（待审核的提现申请）
    const frozenResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM withdrawals 
      WHERE user_id = ? AND status = 'pending'
    `).get(user_id);
    
    const total = totalResult.total || 0;
    const withdrawn = withdrawnResult.total || 0;
    const frozen = frozenResult.total || 0;
    const withdrawable = Math.max(total - withdrawn - frozen, 0);
    
    res.json({
      success: true,
      data: {
        withdrawable: parseFloat(withdrawable.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        withdrawn: parseFloat(withdrawn.toFixed(2)),
        frozen: parseFloat(frozen.toFixed(2))
      }
    });
  } catch (error) {
    console.error('[income] 查询汇总失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;
```

### 步骤2：修改远程服务器上的 `server.js`

在远程服务器上编辑 `/home/ubuntu/renrenmeihao-api/server.js`，在第92行后添加：

```javascript
// 12. 收入汇总路由（用户端）
try {
  app.use('/income', require('./routes_income'));
  console.log('[server] routes_income 加载成功');
} catch (e) {
  console.log('[server] routes_income 加载失败，跳过');
}
```

### 步骤3：重启 PM2 进程

```bash
# 重启后端服务
pm2 restart renrenmeihao-api

# 查看日志，确认启动成功
pm2 logs renrenmeihao-api --lines 50
```

### 步骤4：测试接口

```bash
# 本地测试（如果本地服务器运行）
curl http://localhost:3000/income/summary \
  -H "Authorization: Bearer <your_token>"

# 生产环境测试
curl https://rrmhdate.cn/income/summary \
  -H "Authorization: Bearer <your_token>"
```

### 步骤5：重新编译前端代码

在微信开发者工具中：
1. 点击「编译」按钮
2. 进入「我的」页面
3. 检查是否还能看到可提现金额（应该在接口成功后显示真实数据）

---

## 注意事项

1. **数据库表结构**：
   - `commission_records` 表必须存在，且包含 `user_id`, `amount`, `status` 字段
   - `withdrawals` 表必须存在，且包含 `user_id`, `amount`, `status` 字段

2. **状态码**：
   - `commission_records.status = 'confirmed'` 表示已确认的佣金（可提现）
   - `withdrawals.status` 可以是：`'pending'`, `'approved'`, `'rejected'`, `'paid'`

3. **认证中间件**：
   - 接口使用 `requireAuth` 中间件，需要在请求头中携带有效的 JWT token

4. **错误处理**：
   - 如果 `commission_records` 或 `withdrawals` 表不存在，接口会返回 500 错误
   - 建议在部署前先检查数据库结构

---

## 回滚方案

如果部署后出现问题，可以快速回滚：

```bash
# 1. 恢复 server.js（移除 routes_income 的注册）
# 2. 重启 PM2
pm2 restart renrenmeihao-api

# 3. 前端会自动降级到 mock 数据（DEV_MODE = true 时）
```

---

## 后续优化建议

1. **添加数据库索引**：
   ```sql
   CREATE INDEX idx_commission_records_user_status ON commission_records(user_id, status);
   CREATE INDEX idx_withdrawals_user_status ON withdrawals(user_id, status);
   ```

2. **添加缓存**：
   - 对收入汇总数据添加 Redis 缓存（TTL = 5分钟）
   - 减少数据库查询压力

3. **添加定时任务**：
   - 定期将 `commission_records.status = 'pending'` 更新为 `'confirmed'`
   - 例如：订单完成后7天自动确认佣金

4. **前端优化**：
   - 在「我的」页面添加下拉刷新功能
   - 让用户手动刷新收入数据
