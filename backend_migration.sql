-- 佣金系统数据库迁移脚本
-- 添加佣金相关表结构和索引

SET NAMES utf8mb4;

-- 支付订单表（核心支付记录）
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  out_trade_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户订单号',
  user_id INT NOT NULL COMMENT '付款用户ID',
  type VARCHAR(50) NOT NULL COMMENT '订单类型: single_registration/partner_matchmaker/professional_recommender/city_franchisee/salon_registration',
  total_fee DECIMAL(10,2) NOT NULL COMMENT '订单金额(元)',
  status ENUM('pending', 'paid', 'refunded', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  transaction_id VARCHAR(64) DEFAULT NULL COMMENT '微信交易号',
  paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
  salon_id INT DEFAULT NULL COMMENT '关联沙龙ID(沙龙报名时)',
  registration_id INT DEFAULT NULL COMMENT '关联报名ID(沙龙报名时)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_out_trade_no (out_trade_no),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 佣金记录表（核心）
CREATE TABLE IF NOT EXISTS commissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '关联订单ID',
  payer_id INT NOT NULL COMMENT '付款人ID',
  pay_type VARCHAR(50) NOT NULL COMMENT '付款类型: single_registration/partner_matchmaker/professional_recommender/city_franchisee/salon_attend',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',

  -- 收款人信息
  recipient_id INT DEFAULT NULL COMMENT '收款人ID(可为NULL表示平台)',
  recipient_role VARCHAR(50) DEFAULT NULL COMMENT '收款人角色',
  recipient_type ENUM('referrer', 'platform', 'self', 'organizer') NOT NULL COMMENT '收款类型',

  -- 金额
  amount DECIMAL(10,2) NOT NULL COMMENT '佣金金额',
  platform_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT '平台沉淀金额',

  -- 关联关系
  referrer_id INT DEFAULT NULL COMMENT '推荐人ID',
  is_self_referral TINYINT(1) DEFAULT 0 COMMENT '是否自荐',
  settlement_pool DECIMAL(10,2) DEFAULT 0.00 COMMENT '沉淀资金金额',

  -- 状态
  status ENUM('pending', 'settled', 'cancelled') DEFAULT 'pending',
  note VARCHAR(200) DEFAULT NULL COMMENT '备注',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME DEFAULT NULL,

  INDEX idx_order (order_id),
  INDEX idx_recipient (recipient_id),
  INDEX idx_payer (payer_id),
  INDEX idx_referrer (referrer_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 平台沉淀资金表
CREATE TABLE IF NOT EXISTS platform_fund (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source ENUM('single_registration', 'partner_matchmaker', 'professional_recommender', 'city_franchisee', 'salon_attend', 'community_station') NOT NULL COMMENT '资金来源',
  order_id INT DEFAULT NULL COMMENT '关联订单ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '金额',

  -- 归属
  owner_type ENUM('platform', 'city_partner', 'professional_partner') DEFAULT 'platform' COMMENT '归属方',
  owner_id INT DEFAULT NULL COMMENT '归属人ID(城市合伙人/专业推荐官ID)',

  status ENUM('accumulated', 'distributed', 'withdrawn') DEFAULT 'accumulated' COMMENT '状态',
  note VARCHAR(200) DEFAULT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  distributed_at DATETIME DEFAULT NULL,

  INDEX idx_owner (owner_type, owner_id),
  INDEX idx_source (source),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 推荐关系统计表（按类型累计）
CREATE TABLE IF NOT EXISTS referral_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  referrer_id INT NOT NULL COMMENT '推荐人ID',

  -- 按推荐类型计数
  registration_count INT DEFAULT 0 COMMENT '推荐建档人数',
  partner_count INT DEFAULT 0 COMMENT '推荐联创人数',
  professional_count INT DEFAULT 0 COMMENT '推荐专业人数',
  city_count INT DEFAULT 0 COMMENT '推荐城市人数',
  community_count INT DEFAULT 0 COMMENT '推荐社区人数',

  -- 按推荐类型累计金额
  registration_amount DECIMAL(10,2) DEFAULT 0.00,
  partner_amount DECIMAL(10,2) DEFAULT 0.00,
  professional_amount DECIMAL(10,2) DEFAULT 0.00,
  city_amount DECIMAL(10,2) DEFAULT 0.00,
  community_amount DECIMAL(10,2) DEFAULT 0.00,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_user_referrer (user_id, referrer_id),
  INDEX idx_referrer (referrer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 沙龙补贴记录表
CREATE TABLE IF NOT EXISTS salon_subsidies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  salon_id INT NOT NULL COMMENT '沙龙ID',
  organizer_id INT NOT NULL COMMENT '承办人ID(城市合伙人)',
  attendee_id INT NOT NULL COMMENT '参会人ID',
  referrer_id INT DEFAULT NULL COMMENT '参会人的推荐人ID',
  subsidy_amount DECIMAL(10,2) NOT NULL COMMENT '补贴金额(99元/次)',
  status ENUM('pending', 'settled') DEFAULT 'pending',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME DEFAULT NULL,

  INDEX idx_organizer (organizer_id),
  INDEX idx_salon (salon_id),
  UNIQUE KEY uk_salon_attendee (salon_id, attendee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 提现记录表（增强）
CREATE TABLE IF NOT EXISTS withdrawals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '申请金额',
  fee DECIMAL(10,2) DEFAULT 0.00 COMMENT '手续费',
  actual_amount DECIMAL(10,2) NOT NULL COMMENT '实际到账金额',
  fee_rate DECIMAL(5,4) DEFAULT 0.1300 COMMENT '手续费率',
  status ENUM('pending', 'approved', 'rejected', 'paid') DEFAULT 'pending',
  remark VARCHAR(200) DEFAULT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT NULL,

  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
