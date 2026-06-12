-- =====================================================
-- 人人媒好 - 推荐系统数据库优化设计
-- 版本：v2.0
-- 日期：2026-05-14
-- =====================================================

-- =====================================================
-- 1. 推荐码表（优化版）
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    code_type TEXT NOT NULL,
    
    -- 推荐官信息（谁拥有这个推荐码）
    referrer_id INTEGER,
    referrer_name TEXT,
    
    -- 上下线关系（这个推荐官的"上线"是谁）
    referred_by_code TEXT DEFAULT NULL,
    
    -- 状态与使用
    status TEXT DEFAULT 'active',  -- active, inactive, depleted, expired
    use_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 0,  -- 0 = 无限
    
    -- 时间
    expires_at TEXT,
    created_by INTEGER,  -- 谁创建的（admin ID）
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    
    -- 扩展
    batch_id TEXT,
    remark TEXT,
    
    -- 外键
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_code ON referral_codes(code);
CREATE INDEX idx_type ON referral_codes(code_type);
CREATE INDEX idx_status ON referral_codes(status);
CREATE INDEX idx_referrer ON referral_codes(referrer_id);

-- =====================================================
-- 2. 推荐码使用记录表（新增 - 解决追溯问题）
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- 使用场景
    scene TEXT DEFAULT 'register',  -- register, manual_bind, scan_qrcode
    ip_address TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_usage_code ON referral_usage_logs(code);
CREATE INDEX idx_usage_user ON referral_usage_logs(user_id);

-- =====================================================
-- 3. 推荐关系表（优化版）
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 推荐人（上线）
    referrer_id INTEGER NOT NULL,
    referrer_code TEXT NOT NULL,
    
    -- 被推荐人（下线）
    referee_id INTEGER NOT NULL,
    referee_code TEXT NOT NULL,
    
    -- 关系状态
    status TEXT DEFAULT 'active',  -- active, inactive, disputed
    level INTEGER DEFAULT 1,  -- 层级（1=直接推荐，2=间接推荐）
    
    -- 收益相关
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    settled_commission DECIMAL(10,2) DEFAULT 0.00,
    
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referee_id) REFERENCES users(id)
);

CREATE INDEX idx_rel_referrer ON referral_relationships(referrer_id);
CREATE INDEX idx_rel_referee ON referral_relationships(referee_id);
CREATE INDEX idx_rel_status ON referral_relationships(status);

-- =====================================================
-- 4. 用户推荐关系表（保留 - 用于快速查询）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referee_id INTEGER NOT NULL,
    referral_code TEXT,
    status TEXT DEFAULT 'active',
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referee_id) REFERENCES users(id)
);

-- =====================================================
-- 5. 佣金记录表（新增 - 完整佣金追踪）
-- =====================================================
CREATE TABLE IF NOT EXISTS commission_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 关联
    user_id INTEGER NOT NULL,  -- 受益人（推荐官）
    referral_relationship_id INTEGER,  -- 关联的推荐关系
    
    -- 佣金信息
    type TEXT NOT NULL,  -- register, upgrade, purchase, renewal
    amount DECIMAL(10,2) NOT NULL,
    rate DECIMAL(5,2),  -- 佣金比例（如：10.00 = 10%）
    
    -- 状态
    status TEXT DEFAULT 'pending',  -- pending, confirmed, paid, cancelled
    confirmed_at TEXT,
    paid_at TEXT,
    
    -- 关联订单（如果有）
    order_id INTEGER,
    
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (referral_relationship_id) REFERENCES referral_relationships(id)
);

CREATE INDEX idx_comm_user ON commission_records(user_id);
CREATE INDEX idx_comm_status ON commission_records(status);

-- =====================================================
-- 6. 用户表（补充字段）
-- =====================================================
-- 需要在 users 表添加：
-- ALTER TABLE users ADD COLUMN referral_code TEXT;  -- 用户自己的推荐码
-- ALTER TABLE users ADD COLUMN referral_level INTEGER DEFAULT 0;  -- 推荐官等级
-- ALTER TABLE users ADD COLUMN total_commission DECIMAL(10,2) DEFAULT 0.00;
-- ALTER TABLE users ADD COLUMN available_commission DECIMAL(10,2) DEFAULT 0.00;

-- =====================================================
-- 视图：推荐官业绩统计
-- =====================================================
CREATE VIEW IF NOT EXISTS v_referrer_stats AS
SELECT 
    u.id AS user_id,
    u.nickname,
    rc.code AS referral_code,
    COUNT(DISTINCT rr.referee_id) AS total_referees,
    COUNT(DISTINCT CASE WHEN rr.status = 'active' THEN rr.referee_id END) AS active_referees,
    COALESCE(SUM(cr.amount), 0) AS total_commission,
    COALESCE(SUM(CASE WHEN cr.status = 'paid' THEN cr.amount ELSE 0 END), 0) AS paid_commission,
    COALESCE(SUM(CASE WHEN cr.status = 'pending' THEN cr.amount ELSE 0 END), 0) AS pending_commission
FROM users u
LEFT JOIN referral_codes rc ON rc.referrer_id = u.id
LEFT JOIN referral_relationships rr ON rr.referrer_id = u.id
LEFT JOIN commission_records cr ON cr.user_id = u.id
WHERE u.role IN ('creator', 'professional', 'public_welfare', 'community_station', 'city_partner')
GROUP BY u.id;

-- =====================================================
-- 示例数据
-- =====================================================

-- 插入推荐码
INSERT OR IGNORE INTO referral_codes (code, code_type, status) VALUES
('GYRG8C31', 'public_welfare', 'active'),
('LCRG48KL', 'creator', 'active'),
('ZYRG8BY8', 'professional', 'active');

-- 插入使用记录
INSERT OR IGNORE INTO referral_usage_logs (code, user_id, scene) VALUES
('LCRG48KL', 456, 'register');

-- 插入推荐关系
INSERT OR IGNORE INTO referral_relationships (referrer_id, referrer_code, refere_id, refere_code, level) VALUES
(123, 'LCRG48KL', 456, 'GYRG8C31', 1);

COMMIT;
