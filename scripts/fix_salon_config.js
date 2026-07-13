/**
 * 修复沙龙配置管理功能
 * 1. 创建 salon_configs 表（如果不存在）
 * 2. 插入默认配置（如果表为空）
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'renrenmei.db');
console.log('使用数据库:', dbPath);

const db = new Database(dbPath);

try {
  // 1. 创建 salon_configs 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS salon_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      emoji VARCHAR(10),
      
      -- 主题配置
      theme_color VARCHAR(20),
      theme_light_color VARCHAR(20),
      theme_gradient VARCHAR(200),
      theme_banner_bg VARCHAR(200),
      theme_icon VARCHAR(10),
      
      -- 页面配置
      page_list VARCHAR(200),
      page_detail VARCHAR(200),
      page_create VARCHAR(200),
      
      -- 功能配置（JSON）
      features TEXT,
      
      -- 报名配置（JSON）
      registration TEXT,
      
      -- 权限配置（JSON）
      permissions TEXT,
      
      -- 收益配置（JSON）
      commission TEXT,
      
      -- API配置（JSON）
      api TEXT,
      
      -- 状态
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE(type)
    )
  `);
  console.log('✓ salon_configs 表创建成功（或已存在）');

  // 2. 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_salon_configs_type ON salon_configs(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_salon_configs_status ON salon_configs(status)`);
  } catch (e) {
    // 索引可能已存在
  }

  // 3. 插入默认配置
  const count = db.prepare('SELECT COUNT(*) as count FROM salon_configs').get().count;
  
  if (count === 0) {
    console.log('插入默认沙龙配置...');
    
    const insertConfig = db.prepare(`
      INSERT INTO salon_configs (
        type, name, description, emoji,
        theme_color, theme_light_color, theme_gradient, theme_banner_bg, theme_icon,
        page_list, page_detail, page_create,
        features, registration, permissions, commission, api,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 常规沙龙配置
    insertConfig.run(
      'mixed',
      '圈层主题沙龙',
      '常规沙龙活动，3男3女分组模式',
      '🎉',
      '#C8102E',
      '#FFF0F0',
      'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
      'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
      '🎉',
      '/subpackages/activity/pages/salon-list/salon-list',
      '/subpackages/activity/pages/salon-detail/salon-detail',
      '/subpackages/activity/pages/salon-create/salon-create',
      JSON.stringify({
        totalCap: 27,
        maxRecommenders: 9,
        maxPerGender: 3,
        showScoreFilter: true,
        allowCompanion: true,
        maxCompanions: 1,
        requireProfile: true,
        allowWalkIn: false,
        maxPerWeek: 1,
      }),
      JSON.stringify({
        needPayment: true,
        defaultFee: 399,
        needProfile: true,
        allowCompanion: true,
        companionFields: ['name', 'gender', 'age', 'phone'],
      }),
      JSON.stringify({
        creatorRoles: ['admin', 'station_owner'],
        participantRoles: ['user', 'referrer', 'matchmaker'],
        genderLimit: 'none',
        minAge: 18,
        maxAge: 80,
        minScore: 0,
      }),
      JSON.stringify({
        referrer: 50,
        platform: 30,
        matchmaker: 20,
      }),
      JSON.stringify({
        list: '/api/salons',
        detail: '/api/salons/:id',
        register: '/api/salons/:id/register',
        create: '/api/salons',
        update: '/api/salons/:id',
        cancel: '/api/salons/:id/cancel',
        approve: '/api/admin/salons/:id/approve',
      }),
      'active'
    );
    
    // 男推荐官沙龙配置
    insertConfig.run(
      'male_salon',
      '男推荐官沙龙',
      '专为男推荐官举办的沙龙活动',
      '👨',
      '#0066CC',
      '#E6F0FF',
      'linear-gradient(135deg, #0066CC 0%, #3399FF 100%)',
      'linear-gradient(135deg, #0066CC 0%, #3399FF 100%)',
      '👨',
      '/subpackages/activity/pages/male-salon-list/male-salon-list',
      '/subpackages/activity/pages/male-salon-detail/male-salon-detail',
      '/subpackages/activity/pages/male-salon-create/male-salon-create',
      JSON.stringify({
        totalCap: 27,
        maxRecommenders: 9,
        maxPerGender: 3,
        showScoreFilter: true,
        allowCompanion: false,
        maxCompanions: 0,
        requireProfile: true,
        allowWalkIn: false,
        maxPerWeek: 1,
      }),
      JSON.stringify({
        needPayment: true,
        defaultFee: 299,
        needProfile: true,
        allowCompanion: false,
        companionFields: [],
      }),
      JSON.stringify({
        creatorRoles: ['admin', 'station_owner', 'referrer'],
        participantRoles: ['user', 'referrer'],
        genderLimit: 'male_only',
        minAge: 22,
        maxAge: 60,
        minScore: 60,
      }),
      JSON.stringify({
        referrer: 60,
        platform: 25,
        matchmaker: 15,
      }),
      JSON.stringify({
        list: '/api/salons',
        detail: '/api/salons/:id',
        register: '/api/salons/:id/register',
        create: '/api/salons',
        update: '/api/salons/:id',
        cancel: '/api/salons/:id/cancel',
        approve: '/api/admin/salons/:id/approve',
      }),
      'active'
    );
    
    // 女推荐官沙龙配置
    insertConfig.run(
      'female_salon',
      '女推荐官沙龙',
      '专为女推荐官举办的沙龙活动',
      '👩',
      '#E83D8F',
      '#FFE6F0',
      'linear-gradient(135deg, #E83D8F 0%, #FF6BA3 100%)',
      'linear-gradient(135deg, #E83D8F 0%, #FF6BA3 100%)',
      '👩',
      '/subpackages/activity/pages/female-salon-list/female-salon-list',
      '/subpackages/activity/pages/female-salon-detail/female-salon-detail',
      '/subpackages/activity/pages/female-salon-create/female-salon-create',
      JSON.stringify({
        totalCap: 27,
        maxRecommenders: 9,
        maxPerGender: 3,
        showScoreFilter: true,
        allowCompanion: false,
        maxCompanions: 0,
        requireProfile: true,
        allowWalkIn: false,
        maxPerWeek: 1,
      }),
      JSON.stringify({
        needPayment: true,
        defaultFee: 199,
        needProfile: true,
        allowCompanion: false,
        companionFields: [],
      }),
      JSON.stringify({
        creatorRoles: ['admin', 'station_owner', 'referrer'],
        participantRoles: ['user', 'referrer'],
        genderLimit: 'female_only',
        minAge: 20,
        maxAge: 55,
        minScore: 65,
      }),
      JSON.stringify({
        referrer: 55,
        platform: 30,
        matchmaker: 15,
      }),
      JSON.stringify({
        list: '/api/salons',
        detail: '/api/salons/:id',
        register: '/api/salons/:id/register',
        create: '/api/salons',
        update: '/api/salons/:id',
        cancel: '/api/salons/:id/cancel',
        approve: '/api/admin/salons/:id/approve',
      }),
      'active'
    );
    
    console.log('✓ 默认沙龙配置插入成功');
  } else {
    console.log(`salon_configs 表已有 ${count} 条记录，跳过插入`);
  }

  console.log('✓ 修复完成！');
  
} catch (error) {
  console.error('修复失败:', error);
  process.exit(1);
} finally {
  db.close();
}
