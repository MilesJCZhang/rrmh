-- 005_create_salon_posters.sql
-- 新建 salon_posters 表 - 海报管理

CREATE TABLE IF NOT EXISTS salon_posters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  poster_url TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
