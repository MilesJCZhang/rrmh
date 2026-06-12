-- 新建 visitor_logs 表（访客追踪机制）
-- 用途：记录通过推荐码/链接进入小程序但未注册的用户
-- 创建时间：2026-06-02

CREATE TABLE IF NOT EXISTS visitor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL COMMENT '推荐官用户ID',
    referrer_code TEXT NOT NULL COMMENT '推荐码',
    visitor_openid TEXT NOT NULL COMMENT '访客openid',
    visitor_nickname TEXT COMMENT '访客昵称',
    visitor_avatar TEXT COMMENT '访客头像',
    visit_time TEXT DEFAULT CURRENT_TIMESTAMP COMMENT '到访时间',
    reg_status TEXT DEFAULT 'pending' COMMENT '注册状态：pending/registered',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_visitor_referrer ON visitor_logs(referrer_id);
CREATE INDEX IF NOT EXISTS idx_visitor_openid ON visitor_logs(visitor_openid);
CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_logs(reg_status);
CREATE INDEX IF NOT EXISTS idx_visitor_time ON visitor_logs(visit_time);

-- 说明：
-- 1. 当用户通过推荐码/链接进入小程序时，在小程序入口（首页、扫码落地页）调用 POST /v1/referral/visitor-log 记录访客到访行为
-- 2. 当访客完成注册后，调用 PUT /v1/referral/visitor-update 更新 reg_status 为 registered
-- 3. 统计未注册访客时，查询 referrer_id 下 reg_status = 'pending' 的记录
-- 4. visitor_openid 用于去重，同一访客多次访问只记录一次