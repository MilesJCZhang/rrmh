# 人人媒好 - 后端API文档

## 目录
1. [服务站管理API](#服务站管理api)
2. [合伙人管理API](#合伙人管理api)
3. [提现管理API](#提现管理api)

---

## 服务站管理API

### 基础路径
`/api/stations`

### 数据表结构
```sql
CREATE TABLE stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  contact_phone VARCHAR(20),
  manager_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 1. 创建服务站
**POST** `/api/stations`

#### 请求体
```json
{
  "name": "服务站名称",
  "address": "详细地址",
  "contact_phone": "联系电话",
  "manager_id": 1,
  "description": "服务站描述"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "服务站名称",
    "address": "详细地址",
    "contact_phone": "联系电话",
    "manager_id": 1,
    "status": "active",
    "description": "服务站描述",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  },
  "message": "服务站创建成功"
}
```

---

### 2. 查询服务站列表
**GET** `/api/stations?page=1&limit=10&status=active&keyword=xxx`

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| status | String | 否 | 状态筛选：active/inactive |
| keyword | String | 否 | 关键词搜索（名称/地址） |

#### 响应
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "服务站名称",
        "address": "详细地址",
        "contact_phone": "联系电话",
        "manager_id": 1,
        "manager_name": "负责人姓名",
        "status": "active",
        "description": "服务站描述",
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

---

### 3. 查询服务站详情
**GET** `/api/stations/:id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 服务站ID |

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "服务站名称",
    "address": "详细地址",
    "contact_phone": "联系电话",
    "manager_id": 1,
    "manager_name": "负责人姓名",
    "manager_phone": "负责人电话",
    "status": "active",
    "description": "服务站描述",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### 4. 更新服务站
**PUT** `/api/stations/:id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 服务站ID |

#### 请求体
```json
{
  "name": "新名称",
  "address": "新地址",
  "contact_phone": "新电话",
  "manager_id": 2,
  "status": "inactive",
  "description": "新描述"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "新名称",
    "address": "新地址",
    "contact_phone": "新电话",
    "manager_id": 2,
    "status": "inactive",
    "description": "新描述",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-02T00:00:00.000Z"
  },
  "message": "服务站更新成功"
}
```

---

### 5. 删除服务站
**DELETE** `/api/stations/:id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 服务站ID |

#### 响应
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 6. 更新服务站状态
**PUT** `/api/stations/:id/status`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 服务站ID |

#### 请求体
```json
{
  "status": "active"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "active",
    "updated_at": "2026-01-02T00:00:00.000Z"
  },
  "message": "状态更新成功"
}
```

---

## 合伙人管理API

### 基础路径
`/api/partners`

### 数据表结构
```sql
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('creator', 'public_welfare')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  level INTEGER DEFAULT 1,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  referral_code VARCHAR(20),
  id_card VARCHAR(18),
  id_card_front VARCHAR(200),
  id_card_back VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE partner_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT DEFAULT 'referral',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE partner_referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL,
  referral_code VARCHAR(20),
  status TEXT DEFAULT 'pending',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 1. 申请成为合伙人
**POST** `/api/partners/apply`

#### 请求体
```json
{
  "user_id": 1,
  "type": "creator",
  "id_card": "身份证号",
  "id_card_front": "身份证正面照片URL",
  "id_card_back": "身份证反面照片URL"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "type": "creator",
    "status": "pending",
    "level": 1,
    "total_earnings": 0.00,
    "created_at": "2026-01-01T00:00:00.000Z"
  },
  "message": "申请提交成功，等待审核"
}
```

---

### 2. 查询我的合伙人信息
**GET** `/api/partners/my/:user_id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | Number | 是 | 用户ID |

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "type": "creator",
    "status": "approved",
    "level": 1,
    "total_earnings": 500.00,
    "referral_code": "REF123456",
    "total_referrals": 10,
    "completed_referrals": 5,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### 3. 查询合伙人列表（管理员）
**GET** `/api/partners?page=1&limit=10&status=pending&type=creator&keyword=xxx`

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| status | String | 否 | 状态：pending/approved/rejected |
| type | String | 否 | 类型：creator/public_welfare |
| keyword | String | 否 | 关键词搜索（昵称/手机号） |

#### 响应
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "nickname": "用户昵称",
        "phone": "手机号",
        "avatar": "头像URL",
        "type": "creator",
        "status": "pending",
        "level": 1,
        "total_earnings": 0.00,
        "referral_code": null,
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

---

### 4. 查询合伙人详情（管理员）
**GET** `/api/partners/:id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 合伙人ID |

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "nickname": "用户昵称",
    "phone": "手机号",
    "avatar": "头像URL",
    "gender": "男",
    "age": 25,
    "type": "creator",
    "status": "approved",
    "level": 1,
    "total_earnings": 500.00,
    "referral_code": "REF123456",
    "id_card": "身份证号",
    "id_card_front": "身份证正面URL",
    "id_card_back": "身份证反面URL",
    "referral_code_info": {...},
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-02T00:00:00.000Z"
  }
}
```

---

### 5. 更新合伙人信息（管理员）
**PUT** `/api/partners/:id`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 合伙人ID |

#### 请求体
```json
{
  "type": "public_welfare",
  "level": 2,
  "status": "approved",
  "total_earnings": 1000.00
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "public_welfare",
    "level": 2,
    "status": "approved",
    "total_earnings": 1000.00,
    "updated_at": "2026-01-02T00:00:00.000Z"
  },
  "message": "合伙人信息更新成功"
}
```

---

### 6. 审核合伙人（管理员）
**PUT** `/api/partners/:id/approve`

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 合伙人ID |

#### 请求体
```json
{
  "status": "approved",
  "reject_reason": "拒绝原因（仅当status为rejected时需要）"
}
```

#### 响应
```json
{
  "success": true,
  "message": "审核通过"
}
```

---

### 7. 查询合伙人收益（管理员）
**GET** `/api/partners/:id/earnings?start_date=2026-01-01&end_date=2026-12-31&page=1&limit=20`

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_date | String | 否 | 开始日期 |
| end_date | String | 否 | 结束日期 |
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认20 |

#### 响应
```json
{
  "success": true,
  "data": {
    "total_amount": 5000.00,
    "total_count": 50,
    "items": [
      {
        "id": 1,
        "partner_id": 1,
        "user_id": 2,
        "user_name": "被推荐用户",
        "user_phone": "手机号",
        "order_id": 100,
        "amount": 100.00,
        "type": "referral",
        "description": "推荐奖励",
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20
  }
}
```

---

### 8. 查询合伙人推荐记录（管理员）
**GET** `/api/partners/:id/referrals?page=1&limit=10&status=completed`

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| status | String | 否 | 状态：pending/completed/expired |

#### 响应
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "partner_id": 1,
        "referred_user_id": 2,
        "referred_user_name": "被推荐用户",
        "referred_user_phone": "手机号",
        "referred_user_avatar": "头像URL",
        "referral_code": "REF123456",
        "status": "completed",
        "completed_at": "2026-01-02T00:00:00.000Z",
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 30,
    "page": 1,
    "limit": 10
  }
}
```

---

## 提现管理API

### 基础路径
- 用户端：`/api/withdrawals`
- 管理端：`/api/withdrawals/admin/*`

### 数据表结构
```sql
CREATE TABLE withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'paid')),
  bank_account VARCHAR(50),
  bank_name VARCHAR(100),
  account_holder VARCHAR(50),
  reject_reason VARCHAR(500),
  processed_at DATETIME,
  processor_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 1. 申请提现（用户端）
**POST** `/api/withdrawals`

#### Headers
```
user-id: 1
```

#### 请求体
```json
{
  "amount": 100.00,
  "bank_account": "银行卡号",
  "bank_name": "开户行",
  "account_holder": "开户人"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "amount": 100.00,
    "status": "pending",
    "bank_account": "银行卡号",
    "bank_name": "开户行",
    "account_holder": "开户人",
    "created_at": "2026-01-01T00:00:00.000Z"
  },
  "message": "提现申请提交成功，等待审核"
}
```

---

### 2. 查询我的提现记录（用户端）
**GET** `/api/withdrawals/my?page=1&limit=10&status=pending`

#### Headers
```
user-id: 1
```

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| status | String | 否 | 状态筛选 |

#### 响应
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "amount": 100.00,
        "status": "pending",
        "bank_account": "银行卡号",
        "bank_name": "开户行",
        "account_holder": "开户人",
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 20,
    "page": 1,
    "limit": 10
  }
}
```

---

### 3. 查询提现详情（用户端）
**GET** `/api/withdrawals/:id`

#### Headers
```
user-id: 1
```

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 提现记录ID |

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "amount": 100.00,
    "status": "approved",
    "bank_account": "银行卡号",
    "bank_name": "开户行",
    "account_holder": "开户人",
    "processed_at": "2026-01-02T00:00:00.000Z",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-02T00:00:00.000Z"
  }
}
```

---

### 4. 取消提现申请（用户端）
**PUT** `/api/withdrawals/:id/cancel`

#### Headers
```
user-id: 1
```

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 提现记录ID |

#### 响应
```json
{
  "success": true,
  "message": "提现申请已取消"
}
```

---

### 5. 查询提现列表（管理员）
**GET** `/api/withdrawals/admin/list?page=1&limit=10&status=pending&user_id=1`

#### Headers
```
user-role: admin
```

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| status | String | 否 | 状态筛选 |
| user_id | Number | 否 | 用户ID筛选 |
| start_date | String | 否 | 开始日期 |
| end_date | String | 否 | 结束日期 |

#### 响应
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "nickname": "用户昵称",
        "phone": "手机号",
        "avatar": "头像URL",
        "amount": 100.00,
        "status": "pending",
        "bank_account": "银行卡号",
        "bank_name": "开户行",
        "account_holder": "开户人",
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

---

### 6. 审核提现申请（管理员）
**PUT** `/api/withdrawals/admin/:id/approve`

#### Headers
```
user-role: admin
```

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 提现记录ID |

#### 请求体
```json
{
  "status": "approved",
  "reject_reason": "拒绝原因（仅当status为rejected时需要）"
}
```

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "approved",
    "processed_at": "2026-01-02T00:00:00.000Z",
    "updated_at": "2026-01-02T00:00:00.000Z"
  },
  "message": "审核通过"
}
```

---

### 7. 标记已打款（管理员）
**PUT** `/api/withdrawals/admin/:id/mark-paid`

#### Headers
```
user-role: admin
```

#### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | Number | 是 | 提现记录ID |

#### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "paid",
    "processed_at": "2026-01-03T00:00:00.000Z",
    "updated_at": "2026-01-03T00:00:00.000Z"
  },
  "message": "标记成功，提现已打款"
}
```

---

### 8. 获取提现统计（管理员）
**GET** `/api/withdrawals/admin/stats?start_date=2026-01-01&end_date=2026-12-31`

#### Headers
```
user-role: admin
```

#### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_date | String | 否 | 开始日期 |
| end_date | String | 否 | 结束日期 |

#### 响应
```json
{
  "success": true,
  "data": {
    "total_count": 100,
    "pending_count": 20,
    "approved_count": 30,
    "rejected_count": 10,
    "paid_count": 40,
    "total_paid_amount": 50000.00
  }
}
```

---

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权，请先登录 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 注意事项

1. **认证**：部分接口需要在Header中传递 `user-id` 或 `user-role`
2. **权限**：管理员接口需要 `user-role: admin`
3. **数据库**：使用SQLite，注意并发写入限制
4. **金额字段**：使用DECIMAL(10,2)存储，单位为元
5. **时间戳**：使用ISO 8601格式（YYYY-MM-DDTHH:mm:ss.sssZ）

---

## 测试建议

### 使用curl测试

```bash
# 1. 创建服务站
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{"name":"测试服务站","address":"测试地址","contact_phone":"13800138000"}'

# 2. 查询服务站列表
curl http://localhost:3000/api/stations?page=1&limit=10

# 3. 申请成为合伙人
curl -X POST http://localhost:3000/api/partners/apply \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"type":"creator"}'

# 4. 申请提现
curl -X POST http://localhost:3000/api/withdrawals \
  -H "Content-Type: application/json" \
  -H "user-id: 1" \
  -d '{"amount":100,"bank_account":"1234567890","bank_name":"测试银行","account_holder":"测试用户"}'
```

---

**文档版本**: v1.0  
**最后更新**: 2026-01-01  
**维护者**: 人人媒好开发团队
