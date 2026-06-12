-- 002_add_gender_to_users.sql
-- 为 users 表新增 gender 字段，用于男/女场报名性别限制
ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'unknown';  -- 'male' / 'female' / 'unknown'
