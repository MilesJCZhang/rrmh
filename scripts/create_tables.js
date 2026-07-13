/**
 * 创建人人媒好项目所需的数据库表
 * 运行: node create_tables.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'renrenmei.db'));
console.log('数据库连接成功');

try {
  // 1. 创建 stations 表（服务站管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      address TEXT NOT NULL,
      contact_phone VARCHAR(20),
      manager_id INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name)
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stations_status ON stations(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stations_manager ON stations(manager_id)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ stations 表创建成功');

  // 2. 创建 partners 表（合伙人管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('creator', 'public_welfare')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      level INTEGER DEFAULT 1,
      total_earnings DECIMAL(10,2) DEFAULT 0.00,
      referral_code VARCHAR(20),
      id_card VARCHAR(18),
      id_card_front VARCHAR(200),
      id_card_back VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ partners 表创建成功');

  // 3. 创建 withdrawals 表（提现管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'paid')),
      bank_account VARCHAR(50),
      bank_name VARCHAR(100),
      account_holder VARCHAR(50),
      reject_reason VARCHAR(500),
      processed_at DATETIME,
      processor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ withdrawals 表创建成功');

  // 5. 创建 salon_configs 表（沙龙配置管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS salon_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      emoji VARCHAR(10),
      
      -- 主题配置（JSON）
      theme_color VARCHAR(20),
      theme_light_color VARCHAR(20),
      theme_gradient VARCHAR(200),
      theme_banner_bg VARCHAR(200),
      theme_icon VARCHAR(10),
      
      -- 页面配置（JSON）
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
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_salon_configs_type ON salon_configs(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_salon_configs_status ON salon_configs(status)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ salon_configs 表创建成功');
  
  // 插入默认配置
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM salon_configs').get().count;
    if (count === 0) {
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
        '男推荐官主体沙龙',
        '男推荐官主办的沙龙活动',
        '👨',
        '#1565C0',
        '#E3F2FD',
        'linear-gradient(135deg, #1565C0, #42A5F5)',
        'linear-gradient(135deg, #1565C0, #42A5F5)',
        '👨',
        '/subpackages/activity/pages/salon-list/salon-list?type=male_salon',
        '/subpackages/activity/pages/salon-detail/salon-detail',
        '/subpackages/activity/pages/salon-create/salon-create',
        JSON.stringify({
          totalCap: 27,
          maxRecommenders: 9,
          maxPerGender: 0,
          showScoreFilter: true,
          allowCompanion: true,
          maxCompanions: 2,
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
          creatorRoles: ['referrer'],
          participantRoles: ['user', 'referrer', 'matchmaker'],
          genderLimit: 'male_only',
          minAge: 18,
          maxAge: 80,
          minScore: 60,
        }),
        JSON.stringify({
          referrer: 60,
          platform: 20,
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
      
      // 女推荐官沙龙配置
      insertConfig.run(
        'female_salon',
        '女推荐官主体沙龙',
        '女推荐官主办的沙龙活动',
        '👩',
        '#C2185B',
        '#FCE4EC',
        'linear-gradient(135deg, #C2185B, #F06292)',
        'linear-gradient(135deg, #C2185B, #F06292)',
        '👩',
        '/subpackages/activity/pages/salon-list/salon-list?type=female_salon',
        '/subpackages/activity/pages/salon-detail/salon-detail',
        '/subpackages/activity/pages/salon-create/salon-create',
        JSON.stringify({
          totalCap: 27,
          maxRecommenders: 9,
          maxPerGender: 0,
          showScoreFilter: true,
          allowCompanion: true,
          maxCompanions: 2,
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
          creatorRoles: ['referrer'],
          participantRoles: ['user', 'referrer', 'matchmaker'],
          genderLimit: 'female_only',
          minAge: 18,
          maxAge: 80,
          minScore: 60,
        }),
        JSON.stringify({
          referrer: 60,
          platform: 20,
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
      
      console.log('✓ 默认沙龙配置已插入');
    }
  } catch (e) {
    console.log('沙龙配置已存在或插入失败:', e.message);
  }

  // 4. 创建 partner_earnings 表（合伙人收益记录）
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      type TEXT DEFAULT 'referral' CHECK(type IN ('referral', 'bonus', 'other')),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(partner_id, order_id)
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_earnings_partner ON partner_earnings(partner_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_earnings_user ON partner_earnings(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_earnings_created ON partner_earnings(created_at)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ partner_earnings 表创建成功');

  // 5. 创建 partner_referrals 表（合伙人推荐记录）
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL,
      referral_code VARCHAR(20),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'expired')),
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(partner_id, referred_user_id)
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON partner_referrals(partner_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_partner_referrals_user ON partner_referrals(referred_user_id)`);
  } catch (e) {
    // 索引可能已存在
  }
  console.log('✓ partner_referrals 表创建成功');

  console.log('\n✅ 所有数据库表创建完成！');

} catch (error) {
  console.error('❌ 创建表失败:', error.message);
} finally {
  db.close();
}
