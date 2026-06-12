-- v3_score_system.sql
-- 100分评分系统 + 用户资料扩展
-- 执行方式: sqlite3 renrenmei.db < v3_score_system.sql

-- =============================================
-- 1. 评分规则配置表
-- =============================================
CREATE TABLE IF NOT EXISTS score_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_key TEXT UNIQUE NOT NULL,
  field_group TEXT NOT NULL,
  field_label TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. 用户评分快照表
-- =============================================
CREATE TABLE IF NOT EXISTS user_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  total_score INTEGER DEFAULT 0,
  basic_score INTEGER DEFAULT 0,
  career_score INTEGER DEFAULT 0,
  hobby_score INTEGER DEFAULT 0,
  preference_score INTEGER DEFAULT 0,
  verification_score INTEGER DEFAULT 0,
  asset_score INTEGER DEFAULT 0,
  score_tier TEXT DEFAULT 'unrated',
  detail_json TEXT,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_scores_user ON user_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scores_tier ON user_scores(score_tier);
CREATE INDEX IF NOT EXISTS idx_user_scores_total ON user_scores(total_score);

-- =============================================
-- 3. 用户资产验资记录表
-- =============================================
CREATE TABLE IF NOT EXISTS user_asset_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  reject_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_asset_v_user ON user_asset_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_v_status ON user_asset_verifications(status);

-- =============================================
-- 4. users 表新增列（向后兼容，忽略已存在列的错误）
-- =============================================
-- SQLite 不支持 IF NOT EXISTS 对 ALTER TABLE ADD COLUMN，
-- 使用事务+忽略错误的方式处理

ALTER TABLE users ADD COLUMN profile_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN score_tier TEXT DEFAULT 'unrated';
ALTER TABLE users ADD COLUMN face_auth_status TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN face_auth_image TEXT;
ALTER TABLE users ADD COLUMN id_card_front_image TEXT;
ALTER TABLE users ADD COLUMN id_card_back_image TEXT;
ALTER TABLE users ADD COLUMN property_images TEXT;
ALTER TABLE users ADD COLUMN vehicle_images TEXT;
ALTER TABLE users ADD COLUMN bank_deposit_proof TEXT;
ALTER TABLE users ADD COLUMN insurance_proof TEXT;
ALTER TABLE users ADD COLUMN finance_proof TEXT;
ALTER TABLE users ADD COLUMN asset_verified_status TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN asset_verified_at TEXT;

-- =============================================
-- 5. 初始化评分规则数据
-- =============================================
-- 基础信息 (40分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('avatar',         'basic',       '头像',     8,  1),
  ('nickname',       'basic',       '昵称',     5,  2),
  ('gender',         'basic',       '性别',     3,  3),
  ('birthYear',      'basic',       '出生年份', 3,  4),
  ('city',           'basic',       '城市',     3,  5),
  ('phone',          'basic',       '手机号',   3,  6),
  ('wechatAccount',  'basic',       '微信号',   3,  7),
  ('education',      'basic',       '学历',     4,  8),
  ('maritalStatus',  'basic',       '婚姻状态', 3,  9),
  ('intro',          'basic',       '自我介绍', 5, 10);

-- 职业收入 (15分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('occupation',     'career',      '职业',     5, 11),
  ('income',         'career',      '收入',     5, 12),
  ('hasProperty',    'career',      '房产',     3, 13),
  ('hasCar',         'career',      '车辆',     2, 14);

-- 兴趣爱好 (15分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('healthTags',     'hobby',       '健康标签', 5, 15),
  ('sleepHabit',     'hobby',       '作息习惯', 3, 16),
  ('sportHabit',     'hobby',       '运动习惯', 3, 17),
  ('dietTags',       'hobby',       '饮食偏好', 2, 18),
  ('smoking',        'hobby',       '抽烟',     1, 19),
  ('drinking',       'hobby',       '饮酒',     1, 20);

-- 择偶需求 (10分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('expectAgeMin',    'preference',  '期望年龄', 3, 21),
  ('expectEducation', 'preference',  '期望学历', 2, 22),
  ('expectIncome',    'preference',  '期望收入', 2, 23),
  ('marriageExpect',  'preference',  '感情态度', 3, 24);

-- 认证 (12分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('idVerification',  'verification', '身份证验证', 5, 25),
  ('faceAuth',        'verification', '人脸认证',   7, 26);

-- 资产 (8分)
INSERT OR IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('propertyProof',   'asset',       '房产证明', 3, 27),
  ('vehicleProof',    'asset',       '车辆证明', 2, 28),
  ('bankDepositProof','asset',       '银行存款', 2, 29),
  ('insuranceProof',  'asset',       '保险证明', 1, 30);

-- 合计: 40 + 15 + 15 + 10 + 12 + 8 = 100
