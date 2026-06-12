-- 推荐码系统数据库表创建SQL
-- 执行此SQL语句创建所需的表

-- 1. 推荐码表
CREATE TABLE IF NOT EXISTS `referral_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL COMMENT '推荐码（唯一）',
  `type` enum('creator','public_welfare') NOT NULL COMMENT '类型：creator=创作者, public_welfare=公益',
  `status` enum('active','inactive','expired') DEFAULT 'active' COMMENT '状态',
  `max_uses` int(11) DEFAULT 0 COMMENT '最大使用次数（0=无限）',
  `used_count` int(11) DEFAULT 0 COMMENT '已使用次数',
  `referrer_id` int(11) DEFAULT NULL COMMENT '关联的推荐人用户ID',
  `batch_id` varchar(50) DEFAULT NULL COMMENT '批次ID',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者用户ID（管理员）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_referrer` (`referrer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推荐码表';

-- 2. 用户推荐关系表
CREATE TABLE IF NOT EXISTS `user_referrals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `referrer_id` int(11) NOT NULL COMMENT '推荐人用户ID',
  `referee_id` int(11) NOT NULL COMMENT '被推荐人用户ID',
  `referral_code` varchar(20) NOT NULL COMMENT '使用的推荐码',
  `status` enum('pending','rewarded','cancelled') DEFAULT 'pending' COMMENT '奖励状态',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_referee` (`referee_id`),
  KEY `idx_referrer` (`referrer_id`),
  KEY `idx_code` (`referral_code`),
  CONSTRAINT `fk_user_referrals_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_referrals_referee` FOREIGN KEY (`referee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户推荐关系表';

-- 示例：生成推荐码的存储过程（可选）
-- DELIMITER $$
-- CREATE PROCEDURE GenerateReferralCodes(IN p_type VARCHAR(20), IN p_count INT, IN p_admin_id INT)
-- BEGIN
--   DECLARE i INT DEFAULT 0;
--   DECLARE v_code VARCHAR(20);
--   
--   WHILE i < p_count DO
--     -- 生成推荐码逻辑
--     SET v_code = CONCAT(UPPER(p_type), FLOOR(1000 + RAND() * 9000));
--     
--     INSERT IGNORE INTO referral_codes (code, type, created_by)
--     VALUES (v_code, p_type, p_admin_id);
--     
--     SET i = i + 1;
--   END WHILE;
-- END$$
-- DELIMITER ;
