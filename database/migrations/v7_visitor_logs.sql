-- =====================================================
-- 人人媒好 - 访客追踪表
-- 版本：v7
-- 日期：2026-06-02
-- =====================================================
-- 用途：记录通过推荐码/链接进入小程序但未注册的用户
-- 前端在扫码/点链接入口处调用 POST /v1/referral/visitor-log 记录
-- 访客完成注册后调用 PUT /v1/referral/visitor-update 更新状态
-- =====================================================

CREATE TABLE IF NOT EXISTS visitor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referrer_code TEXT NOT NULL,
    visitor_openid TEXT NOT NULL,
    visitor_nickname TEXT,
    visitor_avatar TEXT,
    visit_time TEXT DEFAULT (datetime('now', 'localtime')),
    reg_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (referrer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_referrer ON visitor_logs(referrer_id);
CREATE INDEX IF NOT EXISTS idx_visitor_openid ON visitor_logs(visitor_openid);
CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_logs(reg_status);
CREATE INDEX IF NOT EXISTS idx_visitor_time ON visitor_logs(visit_time);
