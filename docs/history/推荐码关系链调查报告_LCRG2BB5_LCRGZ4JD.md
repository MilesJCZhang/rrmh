# 推荐码关系链调查报告：LCRG2BB5 & LCRGZ4JD

## 调查时间
2026-06-21 15:49

## 调查方法
通过 SSH 连接生产服务器（ubuntu@175.24.227.251），在 MySQL 数据库 `renrenmeihao` 中执行多轮 SQL 查询，涉及表：
- `referral_codes` — 推荐码主表（83条记录）
- `users` — 用户表（含 recommendedBy、recommendCode 字段）
- `referral_relationships` — 推荐关系表（20条记录，实际使用的推荐关系）
- `user_referrals` — 推荐关系表（0条记录，未使用）

---

## 一、LCRG2BB5 调查结果

### 1.1 码属性

| 字段 | 值 | 状态 |
|------|-----|------|
| id | 141 | ✅ |
| code | LCRG2BB5 | ✅ |
| codeType | creator（联创推荐官邀请码） | ✅ 与靖鸿 `partner_matchmaker` 角色匹配 |
| referrerId | 113（靖鸿） | ✅ |
| status | active | ✅ |
| useCount | 0 | ✅ 刚创建，无人使用 |
| maxUses | 0（无限） | ✅ |
| 创建时间 | 2026-06-21 07:05:43 | ✅ 今天手动修复插入 |

### 1.2 上行关系链（靖鸿的推荐人）

靖鸿（id=113）的完整上游链路：

```
靖鸿 (id=113, role=partner_matchmaker)
  ├─ recommendedBy = 23 (樱花, role=partner_matchmaker)
  ├─ referral_relationships 记录:
  │   id=21, referrerId=23, refereeId=113
  │   referredCode=ZMJKCJWT (靖鸿的个人推荐码)
  │   referrerCode="" → ⚠️ 空，未记录樱花使用的推荐码
  └─ 樱花 (id=23) 的 recommendedBy = NULL（无推荐人，首批联创）
```

**状态：✅ 上行链路正确**。靖鸿由樱花推荐，樱花为无推荐人的首批联创推荐官。

### 1.3 下行关系链（通过 LCRG2BB5 被推荐的人）

| 数据源 | 查询结果 | 状态 |
|--------|---------|------|
| referral_codes.useCount | 0 | ✅ |
| user_referrals WHERE referral_code='LCRG2BB5' | 0 行（全表为空） | ✅ 空表是已知情况 |
| referral_relationships WHERE referrerCode='LCRG2BB5' | 0 行 | ✅ |
| users WHERE recommendedBy=113 | 0 行 | ✅ |
| referral_relationships WHERE referrerId=113 | 0 行 | ✅ |

**状态：✅ 下行链路正确**。码刚创建，无人使用。

### 1.4 LCRG2BB5 总评：✅ 关系链正确

- 码归属正确（靖鸿 id=113）
- codeType 与角色匹配（creator + partner_matchmaker）
- 上行推荐关系完整（靖鸿 → 樱花）
- 下行无人绑定（符合刚创建的状态）

---

## 二、LCRGZ4JD 调查结果

### 2.1 码属性

| 数据源 | 结果 | 状态 |
|--------|------|------|
| referral_codes WHERE code='LCRGZ4JD' | 不存在 | ⚠️ 不是"邀请码系统中的码" |
| users WHERE recommendCode='LCRGZ4JD' | 存在，持有者：樱花（id=23） | ✅ |

**结论：LCRGZ4JD 不是 `referral_codes` 表中的邀请码，而是樱花（id=23）的 `users.recommendCode`（用户的个人推荐码/分享码）。**

### 2.2 樱花的邀请码体系

樱花拥有两个层级的推荐码：

| 码类型 | 码值 | 功能 | 状态 |
|--------|------|------|------|
| users.recommendCode（个人推荐码） | **LCRGZ4JD** | 用户身份标识、分享用 | ✅ 存在 |
| referral_codes（联创邀请码） | **LCRGLXQV** | 正式邀请码，useCount=2 | ✅ 存在、且有使用记录 |
| 公益推荐码 | 无 | — | 樱花无公益推荐码 |

所以 LCRGZ4JD 本质上是"樱花的个人码"（类似微信用户的推荐标识符），而不是"联创推荐官邀请码"。

### 2.3 樱花的推荐关系

**上游**：樱花（id=23）的 recommendedBy = NULL，无推荐人。

**下游**：樱花推荐了谁？
| 数据 | 结果 |
|------|------|
| users WHERE recommendedBy=23 | 靖鸿（id=113） |
| referral_relationships WHERE referrerId=23 | id=21, refereeId=113 |
| 樱花使用的推荐码 | referrerCode=""（空，未记录） |

```diff
- ⚠️ referral_relationships 中樱花推荐靖鸿时，referrerCode 为空
- 正常情况应该记录樱花使用的推荐码（例如 "LCRGLXQV" 或 "LCRGZ4JD"）
```

### 2.4 樱花邀请码 LCRGLXQV 的使用情况

| 维度 | 结果 |
|------|------|
| referral_codes.useCount | 2 |
| referral_relationships 中 as referrerCode | 未出现（樱花未用此码推荐他人） |
| referral_relationships 中 as referredCode | 出现1次（id=15, referrerCode=LCRGOE50） |

注意：LCRGLXQV 在 referral_relationships 中**作为被推荐码**出现一次（id=15），表示用户 49（微信用户_0714）通过岚姐的 LCRGOE50 码推荐后，其关系记录中编码为 LCRGLXQV。这与 useCount=2 可能不匹配，但 useCount 计数器可能在其他地方递增。

### 2.5 LCRGZ4JD 总评：⚠️ 概念需要厘清

**LCRGZ4JD 不是"推荐码系统中的邀请码"，而是用户的个人推荐码（recommendCode）**。两者的区别：

| 系统 | 表 | 用途 |
|------|-----|------|
| 推荐码（邀请码） | referral_codes | 供他人绑定，有 useCount 统计 |
| 个人推荐码 | users.recommendCode | 用户身份标识、用于分享二维码等 |

如果用户发起的问题是"LCRGZ4JD 作为联创邀请码是否正确"，答案是不需要担心——因为它本就不属于邀请码系统。如果问题是"LCRGZ4JD 作为樱花的个人标识是否正确"，答案是正确。

---

## 三、系统性数据问题发现

### 3.1 user_referrals 表完全为空

`user_referrals` 表有正确的表结构但无数据（0条记录），推荐关系实际存储在：
- `users.recommendedBy` — 28个用户有推荐人记录（✅ 使用中）
- `referral_relationships` — 20条推荐关系记录（✅ 使用中）

**结论**：`user_referrals` 未投入使用，不影响现有功能，但如果有新功能依赖此表，需要数据迁移或填充脚本。

### 3.2 靖鸿的推荐记录缺失推荐码

referral_relationships.id=21 中，樱花推荐靖鸿时 referrerCode 为空：
```
referrerCode="" → ⚠️ 应记录为 "LCRGLXQV" 或 "LCRGZ4JD"
```

### 3.3 referral_codes.useCount 与实际绑定记录

| 推荐码 | useCount | referral_relationships 记录数 | 匹配？ |
|--------|---------|------|--------|
| LCRGLXQV（樱花） | 2 | 0（as referrerCode） | ⚠️ 2 vs 0 |
| LCRGX1Y2（用户60） | 4 | 2（as referrerCode） | ⚠️ 4 vs 2 |
| CSHH83UR（张进铖） | 10 | 2（as referrerCode） | ⚠️ 10 vs 2 |

这说明 `useCount` 的递增逻辑与 `referral_relationships` 的记录生成不是同步的，或者存在其他递增入口。**这是一个已知的缺陷**（2026-06-21 memory 中提到 `payment.ts` 的 codeType 命名不一致问题）。

---

## 四、综合结论

### LCRG2BB5：✅ 关系链正确

码的所有信息一致性良好：持有人正确（靖鸿 id=113）、codeType 角色匹配（creator）、上行推荐关系完整（靖鸿 → 樱花）、下行无人绑定（刚创建）。此为手动修复插入的码，后续需关注是否有用户被成功绑定。

### LCRGZ4JD：✅ 存在且属于樱花，但需厘清定位

LCRGZ4JD 是樱花（id=23）的 `users.recommendCode`（个人推荐码/分享码），不属于 `referral_codes` 表中的邀请码系统。樱花在邀请码系统中的正式码是 **LCRGLXQV**（creator, useCount=2）。

### 待优化的数据问题

1. `user_referrals` 表空置（0行），如需启用需填充脚本
2. `referral_relationships` 中靖鸿的推荐人 referrerCode 为空
3. `referral_codes.useCount` 与实际推荐关系记录数不一致（关联后端代码缺陷）

---

## 五、附录：关键查询结果

### 表行数
| 表 | 行数 |
|----|------|
| referral_codes | 83 |
| referral_relationships | 20（主要推荐关系） |
| user_referrals | 0（未使用） |
| users（有推荐人） | 28 |

### 各排名靠前的推荐码使用次数
```
CSHH83UR  → 10次（张进铖Miles）
LCRG4HGL  → 4次
LCRGX1Y2  → 4次
LCRG5C5O  → 3次
LCRGLXQV  → 2次（樱花）
LCRGO7LH  → 2次
LCRG8CC6  → 2次（已删除）
```
