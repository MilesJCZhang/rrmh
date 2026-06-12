-- 推荐码系统数据库迁移脚本
-- 为联创推荐官和公益推荐官生成首批推荐码

SET NAMES utf8mb4;

-- ============================================
-- 1. 创建推荐码表
-- ============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- 推荐码信息
  code VARCHAR(20) NOT NULL UNIQUE COMMENT '推荐码（唯一）',
  code_type ENUM('creator', 'public_welfare') NOT NULL COMMENT '推荐码类型：联创推荐官/公益推荐官',
  
  -- 关联的推荐官（可以为NULL，后续分配）
  referrer_id INT DEFAULT NULL COMMENT '推荐官用户ID（NULL表示未分配）',
  referrer_name VARCHAR(100) DEFAULT '' COMMENT '推荐官姓名/昵称',
  
  -- 状态管理
  status ENUM('active', 'inactive', 'expired') DEFAULT 'active' COMMENT '推荐码状态',
  
  -- 使用统计
  use_count INT DEFAULT 0 COMMENT '使用次数',
  max_uses INT DEFAULT 0 COMMENT '最大使用次数（0表示无限制）',
  
  -- 使用记录
  last_used_at DATETIME DEFAULT NULL COMMENT '最后一次使用时间',
  
  -- 绑定信息（当用户通过推荐码注册时）
  bound_user_id INT DEFAULT NULL COMMENT '最近绑定的用户ID',
  bound_at DATETIME DEFAULT NULL COMMENT '最近绑定时间',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL COMMENT '过期时间（NULL表示永不过期）',
  
  -- 索引
  UNIQUE KEY uk_code (code),
  INDEX idx_referrer (referrer_id),
  INDEX idx_type (code_type),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐码表';

-- ============================================
-- 2. 生成首批10个推荐码（联创5个 + 公益5个）
-- ============================================

-- 联创推荐官推荐码（Creator Referral Codes）
INSERT INTO referral_codes (code, code_type, referrer_name, max_uses, created_at) VALUES
('LCRG001', 'creator', '联创推荐官001', 0, NOW()),
('LCRG002', 'creator', '联创推荐官002', 0, NOW()),
('LCRG003', 'creator', '联创推荐官003', 0, NOW()),
('LCRG004', 'creator', '联创推荐官004', 0, NOW()),
('LCRG005', 'creator', '联创推荐官005', 0, NOW());

-- 公益推荐官推荐码（Public Welfare Referral Codes）
INSERT INTO referral_codes (code, code_type, referrer_name, max_uses, created_at) VALUES
('GYRG001', 'public_welfare', '公益推荐官001', 0, NOW()),
('GYRG002', 'public_welfare', '公益推荐官002', 0, NOW()),
('GYRG003', 'public_welfare', '公益推荐官003', 0, NOW()),
('GYRG004', 'public_welfare', '公益推荐官004', 0, NOW()),
('GYRG005', 'public_welfare', '公益推荐官005', 0, NOW());

-- ============================================
-- 3. 验证数据（查询生成的推荐码）
-- ============================================
-- SELECT * FROM referral_codes ORDER BY code_type, code;
