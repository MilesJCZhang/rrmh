-- ============================================================
-- v6_premium_system.sql - 高端验资匹配 + 基金托管
-- 阶段四：高端验资 → AI匹配 → 人工一对一 → 基金托管
-- ============================================================

-- 高端验资申请表
CREATE TABLE IF NOT EXISTS premium_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verify_type TEXT NOT NULL DEFAULT 'online',   -- online/offline
  status TEXT DEFAULT 'pending',                 -- pending/reviewing/approved/rejected
  -- 验资材料
  asset_type TEXT,                               -- property/vehicle/deposit/income/other
  asset_description TEXT,
  document_urls TEXT,                            -- JSON array of document image URLs
  estimated_value TEXT,                          -- 估算资产价值
  contact_phone TEXT,
  preferred_time TEXT,                           -- 线下预约时间
  preferred_location TEXT,                       -- 线下预约地点
  -- 审核
  reviewed_by INTEGER,
  reviewed_at TEXT,
  reject_reason TEXT,
  admin_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pv_user ON premium_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pv_status ON premium_verifications(status);

-- 基金托管账户表
CREATE TABLE IF NOT EXISTS fund_custody_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  partner_user_id INTEGER,                       -- 匹配对象
  match_record_id INTEGER,                       -- 关联高端匹配记录
  amount INTEGER NOT NULL DEFAULT 100000,        -- 托管金额（分），10万元
  service_fee INTEGER NOT NULL DEFAULT 15000,    -- 服务费（分），1.5万元
  custody_years INTEGER DEFAULT 3,               -- 托管期限（年），3-5年
  status TEXT DEFAULT 'pending',                 -- pending/active/matured/settled/refunded
  start_date TEXT,
  end_date TEXT,
  settle_type TEXT,                              -- marriage/refund （结婚扣费/到期退还）
  settle_amount INTEGER,                         -- 实际结算金额（分）
  settled_at TEXT,
  order_id INTEGER,                              -- 关联支付订单
  contract_url TEXT,                             -- 托管合同URL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (partner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fca_user ON fund_custody_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fca_partner ON fund_custody_accounts(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_fca_status ON fund_custody_accounts(status);

-- 高端匹配服务记录表
CREATE TABLE IF NOT EXISTS premium_match_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verification_id INTEGER,                       -- 关联验资记录
  status TEXT DEFAULT 'ai_matching',             -- ai_matching/matched/human_matching/confirmed/custody_created/completed/cancelled
  -- AI匹配
  ai_matched_user_id INTEGER,                    -- AI推荐的用户
  ai_match_score REAL,                           -- AI匹配度
  ai_match_reason TEXT,                          -- AI推荐理由
  ai_matched_at TEXT,
  -- 人工匹配
  human_matched_user_id INTEGER,                 -- 人工推荐的用户
  human_matchmaker_id INTEGER,                   -- 匹配的红娘
  human_matched_at TEXT,
  -- 用户确认
  confirmed_user_id INTEGER,                     -- 用户最终确认的对象
  confirmed_at TEXT,
  -- 备注
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (verification_id) REFERENCES premium_verifications(id),
  FOREIGN KEY (ai_matched_user_id) REFERENCES users(id),
  FOREIGN KEY (human_matched_user_id) REFERENCES users(id),
  FOREIGN KEY (confirmed_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pmr_user ON premium_match_records(user_id);
CREATE INDEX IF NOT EXISTS idx_pmr_status ON premium_match_records(status);
