# 推荐码系统 - SQL 执行说明

## 概述
本文件说明如何执行 `create_referral_codes.sql` 来创建推荐码表并插入初始数据。

## 执行步骤

### 1. 确认数据库连接
确保已配置数据库连接，环境变量或配置文件包含：
- `DB_HOST` - 数据库主机地址
- `DB_PORT` - 数据库端口（默认 3306）
- `DB_USER` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
- `DB_NAME` - 数据库名称

### 2. 执行 SQL 文件

#### 方法一：命令行执行（推荐）
```bash
# 进入 SQL 文件所在目录
cd "/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram"

# 执行 SQL 文件
mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < create_referral_codes.sql
```

#### 方法二：通过 MySQL 客户端执行
1. 打开 MySQL 客户端（如 Navicat、MySQL Workbench、phpMyAdmin）
2. 选择目标数据库
3. 打开 `create_referral_codes.sql` 文件
4. 执行整个 SQL 脚本

#### 方法三：通过后端接口执行（如果有）
如果后端提供了数据库迁移接口，可以通过 API 调用执行。

### 3. 验证数据
执行成功后，运行以下 SQL 验证数据：
```sql
-- 查看所有推荐码
SELECT * FROM referral_codes ORDER BY code_type, code;

-- 预期结果：
-- 联创推荐官推荐码：LCRG001 ~ LCRG005
-- 公益推荐官推荐码：GYRG001 ~ GYRG005
```

## 推荐码说明

### 联创推荐官推荐码（Creator Referral Codes）
- 格式：`LCRG001` ~ `LCRG005`
- 类型：`creator`
- 使用次数：无限制（`max_uses = 0`）
- 状态：激活（`active`）

### 公益推荐官推荐码（Public Welfare Referral Codes）
- 格式：`GYRG001` ~ `GYRG005`
- 类型：`public_welfare`
- 使用次数：无限制（`max_uses = 0`）
- 状态：激活（`active`）

## 后续操作

### 关联推荐官用户ID
推荐码创建后，`referrer_id` 字段为 NULL。需要将其关联到实际的推荐官用户：

```sql
-- 示例：将 LCRG001 分配给用户ID 1001
UPDATE referral_codes
SET referrer_id = 1001, updated_at = NOW()
WHERE code = 'LCRG001';
```

### 修改使用次数限制
如果需要限制推荐码使用次数：

```sql
-- 示例：设置 LCRG001 最多使用 100 次
UPDATE referral_codes
SET max_uses = 100
WHERE code = 'LCRG001';
```

### 停用推荐码
如果需要停用某个推荐码：

```sql
-- 示例：停用 LCRG001
UPDATE referral_codes
SET status = 'inactive'
WHERE code = 'LCRG001';
```

## 故障排查

### 问题1：表已存在
**错误信息**：`Table 'referral_codes' already exists`

**解决方法**：
```sql
-- 删除已存在的表（谨慎操作！）
DROP TABLE IF EXISTS referral_codes;

-- 重新执行 SQL 文件
```

### 问题2：推荐码已存在
**错误信息**：`Duplicate entry 'LCRG001' for key 'uk_code'`

**解决方法**：
```sql
-- 清空表数据后重新插入
TRUNCATE TABLE referral_codes;

-- 重新执行 INSERT 语句
```

## 测试验证

### 1. 验证推荐码（通过API）
```bash
# 测试联创推荐码
curl -X POST http://localhost:3000/api/referral-codes/verify \
  -H "Content-Type: application/json" \
  -d '{"code": "LCRG001"}'
```

**预期返回**：
```json
{
  "code": 0,
  "data": {
    "valid": true,
    "code": "LCRG001",
    "code_type": "creator",
    "referrer_id": null,
    "referrer_name": "联创推荐官001",
    "message": "推荐码有效"
  }
}
```

### 2. 绑定推荐关系（通过API）
```bash
# 先验证推荐码获取 referrer_id，然后绑定
curl -X POST http://localhost:3000/referral/bind \
  -H "Content-Type: application/json" \
  -d '{"referral_code": "LCRG001", "bind_time": "2024-01-01 12:00:00"}'
```

## 注意事项
1. **备份数据库**：执行前请备份现有数据
2. **推荐官关联**：推荐码必须关联 `referrer_id` 才能正常使用
3. **前端集成**：执行 SQL 后，需要启动后端服务并测试前端功能
4. **生产环境**：生产环境执行前请在测试环境验证

## 联系人
如有问题，请联系后端开发团队。
