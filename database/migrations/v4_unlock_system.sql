-- ============================================================
-- v4_unlock_system.sql - 线上解锁系统
-- 阶段二：AI推荐页评分集成 + 分层访问控制
-- ============================================================

-- 解锁记录表
CREATE TABLE IF NOT EXISTS unlock_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  unlock_type TEXT NOT NULL,         -- online/offline
  order_id INTEGER,
  price INTEGER NOT NULL,            -- 实际支付(分)
  is_permanent INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',     -- active/expired/refunded
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id),
  UNIQUE(user_id, target_user_id, unlock_type)
);

CREATE INDEX IF NOT EXISTS idx_unlock_user ON unlock_records(user_id);
CREATE INDEX IF NOT EXISTS idx_unlock_target ON unlock_records(target_user_id);
CREATE INDEX IF NOT EXISTS idx_unlock_type ON unlock_records(unlock_type);

-- orders 表新增列（如果不存在则添加）
-- SQLite 不支持 IF NOT EXISTS 用于 ALTER TABLE，需要逐个尝试
ALTER TABLE orders ADD COLUMN unlock_target_user_id INTEGER;
ALTER TABLE orders ADD COLUMN score_tier_at_purchase TEXT;
