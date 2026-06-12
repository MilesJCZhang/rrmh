-- ============================================================
-- 006_add_audit_fields_to_salons.sql
-- 为推荐官沙龙添加审核状态字段
-- ============================================================

-- 添加审核状态字段
ALTER TABLE salons ADD COLUMN audit_status TEXT DEFAULT 'pending';

-- 添加驳回原因字段
ALTER TABLE salons ADD COLUMN reject_reason TEXT;

-- 添加审核时间字段
ALTER TABLE salons ADD COLUMN audit_time TEXT;

-- 添加审核人ID字段
ALTER TABLE salons ADD COLUMN auditor_id INTEGER;

-- 创建审核状态索引
CREATE INDEX IF NOT EXISTS idx_salons_audit_status ON salons(audit_status);

-- 创建审核人索引
CREATE INDEX IF NOT EXISTS idx_salons_auditor ON salons(auditor_id);
