-- 003_alter_salons_for_27_cap.sql
-- 修改 salons 表结构 - 支持27人封顶（9推荐官+每人最多2随行）

ALTER TABLE salons ADD COLUMN max_recommenders INTEGER DEFAULT 9;   -- 单场推荐官上限9人
ALTER TABLE salons ADD COLUMN max_companions_per_person INTEGER DEFAULT 2;  -- 每人最多随行2人
ALTER TABLE salons ADD COLUMN total_cap INTEGER DEFAULT 27;  -- 单场总人数封顶27人
ALTER TABLE salons ADD COLUMN week_day INTEGER;  -- 每周几（1-7），用于每周场次管理
ALTER TABLE salons ADD COLUMN week_salon_type TEXT;  -- 'male' / 'female'，标识男场/女场
ALTER TABLE salons ADD COLUMN poster_url TEXT;  -- 审核通过后生成的海报URL
