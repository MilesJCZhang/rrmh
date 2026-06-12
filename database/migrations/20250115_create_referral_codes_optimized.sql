-- 推荐码系统数据库迁移脚本（优化版）
-- 基于架构设计 v1.0（2025-01-15）

SET NAMES utf8mb4;

-- ============================================
-- 1. 创建推荐码表（优化结构）
-- ============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- 推荐码信息
  code VARCHAR(20) NOT NULL UNIQUE COMMENT '推荐码（唯一）',
  code_type ENUM('creator', 'public_welfare') NOT NULL COMMENT '推荐码类型：联创推荐官/公益推荐官',
  
  -- 关联的推荐官
  referrer_id INT DEFAULT NULL COMMENT '推荐官用户ID（NULL表示未分配）',
  
  -- 状态管理
  status ENUM('active', 'inactive', 'expired', 'depleted') DEFAULT 'active' COMMENT '推荐码状态：激活/未激活/过期/已用完',
  
  -- 使用统计
  use_count INT DEFAULT 0 COMMENT '已使用次数',
  max_uses INT DEFAULT 0 COMMENT '最大使用次数（0表示无限制）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL COMMENT '过期时间（NULL表示永不过期）',
  last_used_at DATETIME DEFAULT NULL COMMENT '最后一次使用时间',
  
  -- 绑定信息（最近一次）
  last_bound_user_id INT DEFAULT NULL COMMENT '最近绑定的用户ID',
  last_bound_at DATETIME DEFAULT NULL COMMENT '最近绑定时间',
  
  -- 管理字段
  created_by INT DEFAULT NULL COMMENT '创建者管理员ID',
  batch_id VARCHAR(50) DEFAULT NULL COMMENT '批次号（用于批量管理）',
  notes VARCHAR(500) DEFAULT '' COMMENT '管理员备注',
  
  -- 索引
  UNIQUE KEY uk_code (code),
  INDEX idx_referrer (referrer_id),
  INDEX idx_type (code_type),
  INDEX idx_status (status),
  INDEX idx_batch (batch_id),
  INDEX idx_created (created_at),
  
  -- 外键约束（可选，取决于用户表）
  -- FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐码表';

-- ============================================
-- 2. 插入首批10个推荐码
-- ============================================

-- 联创推荐官推荐码（Creator Referral Codes）
INSERT INTO referral_codes (code, code_type, max_uses, batch_id, created_at) VALUES
('LCRG001', 'creator', 0, 'BATCH_20250115_001', NOW()),
('LCRG002', 'creator', 0, 'BATCH_20250115_001', NOW()),
('LCRG003', 'creator', 0, 'BATCH_20250115_001', NOW()),
('LCRG004', 'creator', 0, 'BATCH_20250115_001', NOW()),
('LCRG005', 'creator', 0, 'BATCH_20250115_001', NOW());

-- 公益推荐官推荐码（Public Welfare Referral Codes）
INSERT INTO referral_codes (code, code_type, max_uses, batch_id, created_at) VALUES
('GYRG001', 'public_welfare', 0, 'BATCH_20250115_002', NOW()),
('GYRG002', 'public_welfare', 0, 'BATCH_20250115_002', NOW()),
('GYRG003', 'public_welfare', 0, 'BATCH_20250115_002', NOW()),
('GYRG004', 'public_welfare', 0, 'BATCH_20250115_002', NOW()),
('GYRG005', 'public_welfare', 0, 'BATCH_20250115_002', NOW());

-- ============================================
-- 3. 验证数据（查询生成的推荐码）
-- ============================================
-- SELECT * FROM referral_codes ORDER BY code_type, code;

-- ============================================
-- 4. 执行说明
-- ============================================
-- 1. 登录MySQL：mysql -u root -p
-- 2. 选择数据库：USE your_database_name;
-- 3. 执行脚本：SOURCE /Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/database/migrations/20250115_create_referral_codes_optimized.sql;
-- 4. 验证数据：SELECT * FROM referral_codes;
