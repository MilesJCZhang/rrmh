-- database/migrations/v8_system_config.sql
-- 系统配置表（用于存储小程序首页图片等配置）

CREATE TABLE IF NOT EXISTS system_config (
  `key` TEXT PRIMARY KEY,
  `value` TEXT NOT NULL,
  `description` TEXT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT OR IGNORE INTO system_config (`key`, `value`, `description`) VALUES
('hero_slides', '[{"id":"salon","title":"同城聚会沙龙","subtitle":"推荐官身份验证 人人真实靠谱","pattern":"🌸","theme":"love","ctaText":"查看近期活动","ctaPage":"/subpackages/activity/pages/salon-list/salon-list","highlights":["威海本地 每周都有活动","80后/90后/00后 分龄专场","精品小班制 每场仅6人"]},{"id":"ai-match","title":"AI推荐 精准甄选","subtitle":"精致三对小众私享局，安静私密轻松相聚","pattern":"🤖","theme":"tech","ctaText":"创建我的画像","ctaPage":"/pages/avatar/avatar","highlights":["不知从何开口？AI帮你","个性化沟通 画像替你表达","隐私安全 姓名不公开"]},{"id":"matchmaker","title":"人人推荐 人人美好","subtitle":"携手遇见知己，相伴温暖朝夕","pattern":"💝","theme":"red","ctaText":"联系公益推荐官","ctaPage":"/subpackages/matchmaker/pages/matchmaker/matchmaker","highlights":["推荐官审核把关 身份真实","70后到00后 分龄推荐","全程跟进 同频相聚"]}]', '首页轮播图配置（JSON格式）'),
('grid2_dating_bg', '', '会员档案背景图URL'),
('grid2_salon_bg', '', '圈层主题沙龙背景图URL'),
('grid4_charity_bg', '', '公益推荐官背景图URL'),
('grid4_partner_bg', '', '联创推荐官背景图URL'),
('grid4_city_bg', '', '城市合伙人背景图URL'),
('grid4_community_bg', '', '社区服务站背景图URL'),
('grid4_male_salon_bg', '', '男推荐官主体沙龙背景图URL'),
('grid4_female_salon_bg', '', '女推荐官主体沙龙背景图URL');
