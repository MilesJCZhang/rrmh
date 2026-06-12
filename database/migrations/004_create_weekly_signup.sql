-- 004_create_weekly_signup.sql
-- 新建 weekly_signup 表 - 每周报名次数限制

CREATE TABLE IF NOT EXISTS weekly_signup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  salon_id INTEGER NOT NULL,
  salon_week_day TEXT NOT NULL,  -- 场次所在周的周一日期（YYYY-MM-DD格式）
  signup_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (salon_id) REFERENCES salons(id),
  UNIQUE(user_id, salon_week_day)  -- 每人每周只能报名1次
);
