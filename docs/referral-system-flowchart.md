# 人人媒好 - 推荐码管理系统流程图

## 一、完整业务流程图

```mermaid
flowchart TD
    Start([新用户/推荐官注册]) --> InputCode{输入推荐码?}
    
    InputCode -->|是| VerifyCode[验证推荐码]
    InputCode -->|否| Register[直接注册]
    
    VerifyCode -->|有效| BindUser[建立用户推荐关系]
    VerifyCode -->|无效| ShowError[提示:推荐码无效]
    
    BindUser --> UpdateCode[更新推荐码使用次数]
    UpdateCode --> UpdateUser[设置用户.referrer_id]
    UpdateUser --> Register
    
    Register --> UserRole{用户身份?}
    
    UserRole -->|普通用户| NormalUser[普通用户主页]
    UserRole -->|申请推荐官| ApplyPage[推荐官申请页]
    
    ApplyPage --> ChooseType[选择推荐官类型]
    ChooseType --> SubmitApply[提交申请]
    SubmitApply --> AdminReview{管理员审核}
    
    AdminReview -->|通过| AssignCode[分配推荐码]
    AdminReview -->|拒绝| NotifyReject[通知拒绝]
    
    AssignCode --> BindCodeToUser[绑定推荐码到用户]
    BindCodeToUser --> ActivateReferrer[激活推荐官身份]
    ActivateReferrer --> ReferrerDashboard[推荐官工作台]
    
    ReferrerDashboard --> DevelopUsers[发展用户/推荐官]
    DevelopUsers --> NewUserReg[新用户注册]
    NewUserReg --> BindUser
    
    ReferrerDashboard --> BindSubReferrer[绑定下级推荐官]
    BindSubReferrer --> CheckSubCode{下级推荐码存在?}
    CheckSubCode -->|是| CheckNotBound{未被绑定?}
    CheckSubCode -->|否| Error1[提示:推荐码不存在]
    
    CheckNotBound -->|是| BindRelationship[建立推荐关系]
    CheckNotBound -->|否| Error2[提示:已有推荐人]
    
    BindRelationship --> UpdateReferredBy[更新 referred_by_code]
    UpdateReferredBy --> LogRelationship[记录到 referral_relationships]
    LogRelationship --> CalcCommission[计算佣金]
    
    CalcCommission --> CommissionRecord[生成佣金记录]
    CommissionRecord --> CommissionStatus{佣金状态}
    
    CommissionStatus -->|pending| WaitConfirm[等待确认]
    CommissionStatus -->|confirmed| ReadyPay[准备发放]
    CommissionStatus -->|paid| AlreadyPaid[已发放]
    
    WaitConfirm --> AdminConfirm[管理员确认]
    AdminConfirm --> ReadyPay
    ReadyPay --> WechatPay[微信支付到推荐官]
    WechatPay --> NotifyPaid[通知到账]
    
    ReferrerDashboard --> ViewTeam[查看团队]
    ViewTeam --> ShowTree[显示推荐树]
    
    classDef success fill:#d4edda,stroke:#28a745
    classDef error fill:#f8d7da,stroke:#dc3545
    classDef process fill:#d1ecf1,stroke:#17a2b8
    
    class BindUser,UpdateCode,UpdateUser,ActivateReferrer,BindRelationship success
    class ShowError,Error1,Error2 error
    class AdminReview,AdminConfirm,WechatPay process
```

## 二、推荐码生命周期图

```mermaid
stateDiagram-v2
    [*] --> 生成: Admin 批量生成
    生成 --> 未分配: 初始状态
    未分配 --> 已分配: 绑定到推荐官
    已分配 --> 使用中: 用户注册使用
    使用中 --> 已用完: use_count >= max_uses
    使用中 --> 已过期: 超过 expires_at
    使用中 --> 已停用: Admin 手动停用
    已用完 --> [*]
    已过期 --> [*]
    已停用 --> [*]
    
    note right of 未分配
        推荐码已生成
        但尚未分配给推荐官
    end note
    
    note right of 已分配
        referrer_id 已设置
        推荐官身份已激活
    end note
    
    note right of 使用中
        用户正在通过此码注册
        use_count 不断增加
    end note
```

## 三、数据库表关系图

```mermaid
erDiagram
    users ||--o{ referral_codes : "拥有(referrer_id)"
    users ||--o{ referral_usage_logs : "使用推荐码"
    users ||--o{ referral_relationships : "作为推荐人(referrer_id)"
    users ||--o{ referral_relationships : "作为被推荐人(referee_id)"
    users ||--o{ commission_records : "获得佣金(user_id)"
    
    referral_codes ||--o{ referral_usage_logs : "被使用(code)"
    referral_codes {
        int id PK
        string code UK "推荐码字符串"
        string code_type "类型:creator/public_welfare/..."
        int referrer_id FK "推荐官用户ID"
        string referred_by_code "上线推荐码"
        string status "active/inactive/depleted"
        int use_count "使用次数"
        int max_uses "最大使用次数"
        string expires_at "过期时间"
        string batch_id "批次ID"
        text remark "备注"
    }
    
    referral_usage_logs {
        int id PK
        string code FK "推荐码"
        int user_id FK "注册用户ID"
        string scene "场景:register/manual_bind"
        string created_at
    }
    
    referral_relationships {
        int id PK
        int referrer_id FK "推荐人ID"
        string referrer_code "推荐人推荐码"
        int refereee_id FK "被推荐人ID"
        string refereee_code "被推荐人推荐码"
        string status "active/inactive"
        int level "层级:1=直接,2=间接"
        decimal total_commission "总佣金"
        text remark
    }
    
    commission_records {
        int id PK
        int user_id FK "受益人ID"
        int referral_relationship_id FK "关联推荐关系"
        string type "类型:register/upgrade/purchase"
        decimal amount "佣金金额"
        string status "pending/confirmed/paid"
        string paid_at "发放时间"
    }
    
    user_referrals {
        int id PK
        int referrer_id FK
        int refereee_id FK
        string referral_code
        string status
    }
```

## 四、推荐关系绑定时序图

```mermaid
sequenceDiagram
    participant Admin as 管理员
    participant Frontend as 前端页面
    participant Backend as 后端API
    participant DB as 数据库
    
    Admin->>Frontend: 打开"推荐关系绑定"页面
    Frontend->>Backend: GET /api/admin/referral-codes/list
    Backend->>DB: SELECT * FROM referral_codes
    DB-->>Backend: 返回推荐码列表
    Backend-->>Frontend: {code:0, data: [...]}
    Frontend->>Frontend: 渲染两个Picker选择器
    
    Admin->>Frontend: 选择推荐人推荐码 + 被推荐人推荐码
    Admin->>Frontend: 点击"绑定"
    
    Frontend->>Frontend: 表单验证
    Frontend->>Backend: POST /api/admin/referral-codes/bind
    Note over Frontend,Backend: {referrer_code: "LCRG48KL", referred_code: "GYRGJ87O"}
    
    Backend->>Backend: 验证参数完整性
    Backend->>DB: SELECT * FROM referral_codes WHERE code = ?
    DB-->>Backend: 返回推荐人推荐码信息
    
    alt 推荐人推荐码不存在
        Backend-->>Frontend: {code:-1, message:"推荐人推荐码不存在"}
        Frontend-->>Admin: 提示错误
    end
    
    Backend->>DB: SELECT * FROM referral_codes WHERE code = ?
    DB-->>Backend: 返回被推荐人推荐码信息
    
    alt 被推荐人推荐码不存在
        Backend-->>Frontend: {code:-1, message:"被推荐人推荐码不存在"}
        Frontend-->>Admin: 提示错误
    end
    
    Backend->>DB: CHECK referred_by_code IS NOT NULL
    
    alt 已被绑定
        Backend-->>Frontend: {code:-1, message:"该推荐码已有推荐人"}
        Frontend-->>Admin: 提示错误
    end
    
    Backend->>DB: BEGIN TRANSACTION
    DB-->>Backend: 事务开始
    
    Backend->>DB: UPDATE referral_codes SET referred_by_code = ? WHERE code = ?
    DB-->>Backend: 更新成功
    
    Backend->>DB: INSERT INTO referral_relationships (...)
    DB-->>Backend: 插入成功
    
    Backend->>DB: COMMIT
    DB-->>Backend: 事务提交成功
    
    Backend-->>Frontend: {code:0, message:"推荐关系绑定成功"}
    Frontend-->>Admin: 提示"绑定成功"
    Frontend->>Frontend: 刷新推荐码列表
```

## 五、佣金计算流程图

```mermaid
flowchart TD
    Start([触发佣金计算]) --> TriggerType{触发类型?}
    
    TriggerType -->|新用户注册| Calc1[计算直接推荐奖金]
    TriggerType -->|下级推荐官升级| Calc2[计算升级奖金]
    TriggerType -->|用户购买服务| Calc3[计算消费分成]
    TriggerType -->|续费| Calc4[计算续费奖励]
    
    Calc1 --> GetReferral[获取推荐关系]
    Calc2 --> GetReferral
    Calc3 --> GetReferral
    Calc4 --> GetReferral
    
    GetReferral --> CheckLevel{推荐官等级?}
    
    CheckLevel -->|联创推荐官| Rate1[提成20%]
    CheckLevel -->|专业推荐官| Rate2[提成15%]
    CheckLevel -->|公益推荐官| Rate3[提成10%]
    CheckLevel -->|社区服务站| Rate4[提成12%]
    CheckLevel -->|城市合伙人| Rate5[提成25%]
    
    Rate1 --> CheckSub[检查是否有上线]
    Rate2 --> CheckSub
    Rate3 --> CheckSub
    Rate4 --> CheckSub
    Rate5 --> CheckSub
    
    CheckSub -->|有上线| CalcSubCommission[计算上线抽成]
    CheckSub -->|无上线| GenerateRecord[生成佣金记录]
    
    CalcSubCommission --> SubRate{上线等级}
    SubRate -->|联创| SubRate1[抽成5%]
    SubRate -->|专业| SubRate2[抽成3%]
    SubRate -->|其他| SubRate3[抽成2%]
    
    SubRate1 --> GenerateRecord
    SubRate2 --> GenerateRecord
    SubRate3 --> GenerateRecord
    
    GenerateRecord --> InsertCommission[INSERT INTO commission_records]
    InsertCommission --> NotifyReferrer[微信订阅消息通知]
    NotifyReferrer --> End([结束])
    
    classDef trigger fill:#fff3cd,stroke:#ffc107
    classDef calculate fill:#d1ecf1,stroke:#17a2b8
    classDef notify fill:#d4edda,stroke:#28a745
    
    class Start,TriggerType trigger
    class Calc1,Calc2,Calc3,Calc4,CheckLevel,Rate1,Rate2,Rate3,Rate4,Rate5,CheckSub,CalcSubCommission,SubRate,SubRate1,SubRate2,SubRate3 calculate
    class NotifyReferrer,End notify
```

## 六、关键业务规则

### 1. 推荐码生成规则
- **公益推荐官**：前缀 `GYRG` + 4位随机字符
- **联创推荐官**：前缀 `LCRG` + 4位随机字符
- **专业推荐官**：前缀 `ZYRG` + 4位随机字符
- **社区服务站**：前缀 `SQZD` + 4位随机字符
- **城市合伙人**：前缀 `CSHH` + 4位随机字符

### 2. 推荐关系层级
- **Level 1**：直接推荐（A 推荐 B）
- **Level 2**：间接推荐（A 推荐 B，B 推荐 C，A 获得 C 的间接奖励）

### 3. 佣金结算周期
- **T+1**：用户注册/升级触发佣金（pending）
- **T+7**：管理员确认无异常后（confirmed）
- **每月15日**：批量发放上月 confirmed 佣金（paid）

### 4. 防作弊机制
- 同一 IP 24小时内只能使用 3 次推荐码
- 推荐关系建立后 7 天内不能解除
- 退款订单对应的佣金自动扣除

---

## 附录：快速 SQL 查询

### 查询推荐官的完整团队
```sql
WITH RECURSIVE team AS (
    -- 初始：指定推荐官的直接下线
    SELECT 
        rr.referee_id,
        rr.referrer_code,
        rr.referee_code,
        rr.level,
        1 as depth
    FROM referral_relationships rr
    WHERE rr.referrer_id = ?  -- 输入推荐官ID
    
    UNION ALL
    
    -- 递归：下线的下线
    SELECT 
        rr.referee_id,
        rr.referrer_code,
        rr.referee_code,
        rr.level,
        t.depth + 1
    FROM referral_relationships rr
    INNER JOIN team t ON rr.referrer_id = t.referee_id
    WHERE t.depth < 5  -- 最多5层
)
SELECT * FROM team;
```

### 统计推荐官业绩
```sql
SELECT 
    u.id,
    u.nickname,
    rc.code as referral_code,
    COUNT(DISTINCT rr.referee_id) as total_referees,
    COUNT(DISTINCT CASE WHEN u_reg.created_at >= date('now', '-30 days') THEN rr.referee_id END) as month_new,
    COALESCE(SUM(cr.amount), 0) as total_commission
FROM users u
LEFT JOIN referral_codes rc ON rc.referrer_id = u.id
LEFT JOIN referral_relationships rr ON rr.referrer_id = u.id
LEFT JOIN commission_records cr ON cr.user_id = u.id AND cr.status = 'paid'
WHERE u.role IN ('creator', 'professional', 'public_welfare')
GROUP BY u.id;
```
