-- =============================================
-- 支付订单表迁移脚本
-- 运行方式（SSH 到服务器后）：
--   mysql -h <host> -u root -p renrenmei < create_orders_table.sql
-- =============================================
-- 注意：请先登录服务器确认数据库名和配置
--   mysql -h 175.24.227.251 -u root -p -e "SHOW DATABASES;"
-- =============================================

-- 检查 orders 表是否存在
SELECT COUNT(*) AS orders_table_exists
FROM information_schema.tables
WHERE table_schema = 'renrenmei'
  AND table_name = 'orders';

-- 如果 orders 表不存在，执行以下建表语句：
-- CREATE TABLE IF NOT EXISTS orders (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   out_trade_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户订单号',
--   user_id INT NOT NULL COMMENT '付款用户ID',
--   type VARCHAR(50) NOT NULL COMMENT '订单类型: single_registration/partner_matchmaker/professional_recommender/city_franchisee/salon_registration',
--   total_fee DECIMAL(10,2) NOT NULL COMMENT '订单金额(元)',
--   status ENUM('pending', 'paid', 'refunded', 'cancelled') DEFAULT 'pending' COMMENT '状态',
--   transaction_id VARCHAR(64) DEFAULT NULL COMMENT '微信交易号',
--   paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
--   salon_id INT DEFAULT NULL COMMENT '关联沙龙ID(沙龙报名时)',
--   registration_id INT DEFAULT NULL COMMENT '关联报名ID(沙龙报名时)',
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   INDEX idx_user (user_id),
--   INDEX idx_status (status),
--   INDEX idx_out_trade_no (out_trade_no),
--   INDEX idx_created (created_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 备用建表语句（无 IF NOT EXISTS 检查，直接创建）：
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  out_trade_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户订单号',
  user_id INT NOT NULL COMMENT '付款用户ID',
  type VARCHAR(50) NOT NULL COMMENT '订单类型',
  total_fee DECIMAL(10,2) NOT NULL COMMENT '订单金额(元)',
  status ENUM('pending', 'paid', 'refunded', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  transaction_id VARCHAR(64) DEFAULT NULL COMMENT '微信交易号',
  paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
  salon_id INT DEFAULT NULL COMMENT '关联沙龙ID',
  registration_id INT DEFAULT NULL COMMENT '关联报名ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_out_trade_no (out_trade_no),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
