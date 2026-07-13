---
name: investigate-referral-chains-LCRG2BB5-LCRGZ4JD
overview: 通过 SSH 连接生产服务器，执行 8 组 SQL 查询和 6 项业务逻辑校验，彻底调查 LCRG2BB5 和 LCRGZ4JD 两个推荐码的推荐与被推荐关系链是否正确，包括码的归属、上游推荐人、下游被推荐人、跨表数据一致性、以及业务规则合规性。
todos:
  - id: validate-sql
    content: 使用 [skill:sql-queries] 优化并验证调查 SQL 查询语句的正确性
    status: pending
  - id: query-database
    content: 使用 [mcp:filesystem] 连接生产服务器 ubuntu@175.24.227.251，在 MySQL renrenmeihao 中执行全部 5 组调查 SQL，导出原始查询结果
    status: pending
    dependencies:
      - validate-sql
  - id: analyze-chain
    content: 使用 [subagent:research_subagent] 对原始数据进行分析：逐项校验上行关系、自身属性、下行关系、跨表一致性的 10 个维度，标记通过/异常项，生成结构化调查报告
    status: pending
    dependencies:
      - query-database
  - id: write-report
    content: 将调查报告写入工作目录，文件名 research_report_referral_chain_audit.md
    status: pending
    dependencies:
      - analyze-chain
---

## 调查目标

彻底调查推荐码 LCRG2BB5 和 LCRGZ4JD 的推荐与被推荐关系链是否正确，覆盖三个维度：

1. **上行关系**：这两个码的持有者通过谁的推荐码绑定？（查 user_referrals 和 users.referrer_id）
2. **自身属性**：码在 referral_codes 表中的记录是否完整正确？（code_type、status、referrer_id、use_count、max_uses）
3. **下行关系**：通过这两个码绑定了哪些用户？（查 user_referrals 中 referral_code 匹配记录 + 被推荐用户的角色/支付状态）
4. **跨表一致性**：referral_codes.use_count vs user_referrals 实际绑定数、users.referrer_id vs user_referrals 记录

## 已知背景

- LCRG2BB5 是靖鸿（ID=113）的 LCRG 推荐码，于 2026-06-21 数据修复时手动 INSERT 补建（因 payment.ts codeType 缺陷导致支付 399 元后未自动生成 LCRG 码，仅保留了原有的 GYRGEP1W 公益推荐码）。插入语句：INSERT referral_codes (code=LCRG2BB5, codeType=creator, referrerId=113)。
- LCRGZ4JD 背景未知，需全链路调查。
- 此前已发现跨表不一致问题：referral_relationships 与 users.recommendedBy 因 openid=NULL 占位账号不一致（已修复 9 条）。

## 调查方案

### 调查策略

采用**分层查询 + 逐项校验**策略，通过生产数据库的交叉比对验证推荐关系链的完整性和一致性。

### 调查维度与校验规则

| 维度 | 校验内容 | 预期规则 | 异常标志 |
| --- | --- | --- | --- |
| 上行关系 | user_referrals 表中持有者的 referrer_id | is_locked=1，有上级推荐人 | referrer_id=NULL 或无记录 |
| 上行关系 | users.referrer_id 字段 | 与 user_referrals.referrer_id 一致 | 两字段值不一致 |
| 自身属性 | referral_codes.code_type | LCRG 前缀码应为 'creator' | code_type 错误 |
| 自身属性 | referral_codes.status | 应为 'active' | 非 active |
| 自身属性 | referral_codes.referrer_id | 应指向有效用户 | referrer_id 对应的用户不存在 |
| 下行关系 | use_count vs 实际绑定数 | use_count = user_referrals 中该码绑定条数 | 数值不一致 |
| 下行关系 | 被推荐用户角色 | 应与实际角色一致 | 角色异常 |
| 下行关系 | 被推荐用户的 users.referrer_id | 应与码持有者 ID 一致 | 指向其他推荐人 |
| 下行关系 | 被推荐用户是否也锁定了推荐关系 | is_locked=1 | is_locked=0 |
| 跨表一致性 | users.referrer_id vs user_referrals | 所有相关用户两表一致 | 不一致 |


### 数据收集 SQL（在 MySQL renrenmeihao 执行）

**第一步：获取码的持有者信息**

```sql
SELECT rc.code, rc.code_type, rc.referrer_id, rc.status, rc.use_count, rc.max_uses, rc.created_at, rc.created_by, rc.last_bound_user_id, rc.last_bound_at, u.nickname, u.role, u.referrer_id as user_referrer_id, u.phone, u.created_at as user_created_at FROM referral_codes rc JOIN users u ON u.id = rc.referrer_id WHERE rc.code IN ('LCRG2BB5', 'LCRGZ4JD');
```

**第二步：上行关系 - 持有者绑定的推荐人**

```sql
SELECT ur.user_id, ur.referrer_id, ur.referral_code, ur.bind_time, ur.is_locked, u2.nickname as referrer_nickname, u2.role as referrer_role, rc2.code as referrer_own_code FROM user_referrals ur JOIN users u2 ON u2.id = ur.referrer_id LEFT JOIN referral_codes rc2 ON rc2.referrer_id = ur.referrer_id AND rc2.status = 'active' WHERE ur.user_id IN (SELECT referrer_id FROM referral_codes WHERE code IN ('LCRG2BB5', 'LCRGZ4JD'));
```

**第三步：下行关系 - 通过这两个码绑定的用户**

```sql
SELECT ur.user_id, ur.referrer_id, ur.referral_code, ur.bind_time, ur.is_locked, u.nickname, u.role, u.referrer_id as user_referrer_id, u.openid FROM user_referrals ur JOIN users u ON u.id = ur.user_id WHERE ur.referral_code IN ('LCRG2BB5', 'LCRGZ4JD') ORDER BY ur.bind_time;
```

**第四步：查询通过持有者 ID 绑定的所有用户（与第三步对比去重）**

```sql
SELECT ur.user_id, ur.referrer_id, ur.referral_code, ur.bind_time, ur.is_locked, u.nickname, u.role, u.openid FROM user_referrals ur JOIN users u ON u.id = ur.user_id WHERE ur.referrer_id IN (SELECT referrer_id FROM referral_codes WHERE code IN ('LCRG2BB5', 'LCRGZ4JD')) ORDER BY ur.bind_time;
```

**第五步：跨表一致性校验**

```sql
SELECT u.id, u.nickname, u.role, u.referrer_id as users_referrer_id, ur.referrer_id as ur_referrer_id, ur.referral_code, ur.is_locked, CASE WHEN u.referrer_id = ur.referrer_id THEN '一致' ELSE '不一致' END as consistency FROM users u LEFT JOIN user_referrals ur ON ur.user_id = u.id AND ur.is_locked = 1 WHERE u.id IN (SELECT referrer_id FROM referral_codes WHERE code IN ('LCRG2BB5', 'LCRGZ4JD')) OR u.id IN (SELECT user_id FROM user_referrals WHERE referrer_id IN (SELECT referrer_id FROM referral_codes WHERE code IN ('LCRG2BB5', 'LCRGZ4JD')));
```

## Agent Extensions

### MCP

- **filesystem**
- Purpose: 通过 SSH 访问生产服务器 ubuntu@175.24.227.251，在 MySQL 数据库 renrenmeihao 中执行调查 SQL 查询
- Expected outcome: 获取两个推荐码的完整关系链原始数据，包括持有者信息、上行推荐关系、下行被推荐用户列表、跨表一致性数据

### SubAgent

- **research_subagent**
- Purpose: 将 filesystem MCP 获取的原始数据进行对比分析，逐项校验 10 个校验维度，标记一致/不一致项，生成结构化调查报告
- Expected outcome: 输出包含校验结论、异常清单、修复建议的调查分析报告

### Skill

- **sql-queries**
- Purpose: 优化调查中使用的 SQL 查询语句，确保跨表 JOIN 正确、条件过滤完整、性能良好
- Expected outcome: 经过验证的高质量 SQL 查询，避免遗漏数据行或条件不完整的问题