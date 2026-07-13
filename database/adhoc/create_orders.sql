CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  out_trade_no VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  total_fee DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','refunded','cancelled') DEFAULT 'pending',
  transaction_id VARCHAR(64) DEFAULT NULL,
  paid_at DATETIME DEFAULT NULL,
  salon_id INT DEFAULT NULL,
  registration_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_out_trade_no (out_trade_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
