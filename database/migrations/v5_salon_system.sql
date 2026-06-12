-- ============================================================
-- v5_salon_system.sql - 3男3女线下沙龙系统
-- 阶段三：固定6人制沙龙，按评分段分场次
-- ============================================================

-- 沙龙活动基础表
CREATE TABLE IF NOT EXISTS salons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  type TEXT DEFAULT 'mixed',           -- mixed/male_salon/female_salon
  score_tier TEXT DEFAULT 'silver',    -- gold/silver/bronze/all （该场次允许的评分段）
  is_grouped INTEGER DEFAULT 1,        -- 是否3男3女分组模式
  allowed_tiers TEXT DEFAULT 'gold,silver,bronze',  -- 逗号分隔允许参加的tier
  location TEXT,
  city TEXT,
  province TEXT,
  event_date TEXT NOT NULL,            -- 活动日期 YYYY-MM-DD
  start_time TEXT,                     -- 开始时间 HH:mm
  end_time TEXT,                        -- 结束时间 HH:mm
  max_participants INTEGER DEFAULT 6,
  male_count INTEGER DEFAULT 0,        -- 已报名男
  female_count INTEGER DEFAULT 0,      -- 已报名女
  max_per_gender INTEGER DEFAULT 3,    -- 每性别上限
  registration_fee INTEGER DEFAULT 399, -- 报名费（元）
  status TEXT DEFAULT 'draft',         -- draft/pending_review/published/open/full/ongoing/completed/cancelled
  organizer_id INTEGER,                -- 组织者(推荐官/城市合伙人)
  process_json TEXT,                   -- 流程时间线 JSON
  notices_json TEXT,                   -- 注意事项 JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_salons_date ON salons(event_date);
CREATE INDEX IF NOT EXISTS idx_salons_tier ON salons(score_tier);
CREATE INDEX IF NOT EXISTS idx_salons_status ON salons(status);
CREATE INDEX IF NOT EXISTS idx_salons_organizer ON salons(organizer_id);

-- 3男3女分组表
CREATE TABLE IF NOT EXISTS salon_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  group_index INTEGER DEFAULT 1,
  score_tier TEXT NOT NULL,             -- gold/silver/bronze
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  max_per_gender INTEGER DEFAULT 3,
  status TEXT DEFAULT 'forming',       -- forming/ready/ongoing/completed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salon_groups_salon ON salon_groups(salon_id);

-- 沙龙报名成员表
CREATE TABLE IF NOT EXISTS salon_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  salon_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  gender TEXT NOT NULL,
  user_score INTEGER DEFAULT 0,
  user_score_tier TEXT,
  order_id INTEGER,
  companions_json TEXT,                -- 同行人 JSON [{name, gender}]
  status TEXT DEFAULT 'registered',   -- registered/checked_in/cancelled/no_show
  registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  FOREIGN KEY (group_id) REFERENCES salon_groups(id),
  FOREIGN KEY (salon_id) REFERENCES salons(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(salon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sgm_group ON salon_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sgm_user ON salon_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sgm_salon ON salon_group_members(salon_id);
