-- 007_ensure_score_tables_mysql.sql
-- MySQL 版本：创建评分系统所需的表
-- 在生产 MySQL 数据库 renrenmeihao 中执行

-- ============================================
-- 1. 评分规则配置表
-- ============================================
CREATE TABLE IF NOT EXISTS score_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  field_key VARCHAR(50) UNIQUE NOT NULL,
  field_group VARCHAR(20) NOT NULL,
  field_label VARCHAR(50) NOT NULL,
  max_score INT NOT NULL DEFAULT 0,
  is_required TINYINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. 用户评分快照表
-- ============================================
CREATE TABLE IF NOT EXISTS user_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  total_score INT DEFAULT 0,
  basic_score INT DEFAULT 0,
  career_score INT DEFAULT 0,
  hobby_score INT DEFAULT 0,
  preference_score INT DEFAULT 0,
  verification_score INT DEFAULT 0,
  asset_score INT DEFAULT 0,
  score_tier VARCHAR(20) DEFAULT 'unrated',
  detail_json TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_scores_user (user_id),
  INDEX idx_user_scores_tier (score_tier),
  INDEX idx_user_scores_total (total_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. 用户资产验资记录表
-- ============================================
CREATE TABLE IF NOT EXISTS user_asset_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  document_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by INT,
  reviewed_at DATETIME,
  reject_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asset_v_user (user_id),
  INDEX idx_asset_v_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. users 表新增列（逐条执行，重复执行会报错可忽略）
-- ============================================
ALTER TABLE users ADD COLUMN profile_score INT DEFAULT 0;
ALTER TABLE users ADD COLUMN score_tier VARCHAR(20) DEFAULT 'unrated';
ALTER TABLE users ADD COLUMN face_auth_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE users ADD COLUMN face_auth_image TEXT;
ALTER TABLE users ADD COLUMN id_card_front_image TEXT;
ALTER TABLE users ADD COLUMN id_card_back_image TEXT;
ALTER TABLE users ADD COLUMN property_images TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN vehicle_images TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN bank_deposit_proof TEXT;
ALTER TABLE users ADD COLUMN insurance_proof TEXT;
ALTER TABLE users ADD COLUMN finance_proof TEXT;
ALTER TABLE users ADD COLUMN asset_verified_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE users ADD COLUMN asset_verified_at DATETIME;

-- ============================================
-- 5. 初始化评分规则数据
-- ============================================
INSERT IGNORE INTO score_rules (field_key, field_group, field_label, max_score, sort_order) VALUES
  ('avatar',         'basic',       '头像',     8,  1),
  ('nickname',       'basic',       '昵称',     5,  2),
  ('gender',         'basic',       '性别',     3,  3),
  ('birthYear',      'basic',       '出生年份', 3,  4),
  ('city',           'basic',       '城市',     3,  5),
  ('phone',          'basic',       '手机号',   3,  6),
  ('wechatAccount',  'basic',       '微信号',   3,  7),
  ('education',      'basic',       '学历',     4,  8),
  ('maritalStatus',  'basic',       '婚姻状态', 3,  9),
  ('intro',          'basic',       '自我介绍', 5, 10),
  ('occupation',     'career',      '职业',     5, 11),
  ('income',         'career',      '收入',     5, 12),
  ('hasProperty',    'career',      '房产',     3, 13),
  ('hasCar',         'career',      '车辆',     2, 14),
  ('healthTags',     'hobby',       '健康标签', 5, 15),
  ('sleepHabit',     'hobby',       '作息习惯', 3, 16),
  ('sportHabit',     'hobby',       '运动习惯', 3, 17),
  ('dietTags',       'hobby',       '饮食偏好', 2, 18),
  ('smoking',        'hobby',       '抽烟',     1, 19),
  ('drinking',       'hobby',       '饮酒',     1, 20),
  ('expectAgeMin',    'preference',  '期望年龄', 3, 21),
  ('expectEducation', 'preference',  '期望学历', 2, 22),
  ('expectIncome',    'preference',  '期望收入', 2, 23),
  ('marriageExpect',  'preference',  '感情态度', 3, 24),
  ('idVerification',  'verification', '身份证验证', 5, 25),
  ('faceAuth',       'verification', '人脸认证', 7, 26),
  ('propertyProof',   'asset',       '房产证明', 3, 27),
  ('vehicleProof',    'asset',       '车辆证明', 2, 28),
  ('bankDepositProof','asset',       '银行存款', 2, 29),
  ('insuranceProof',  'asset',       '保险证明', 1, 30);
