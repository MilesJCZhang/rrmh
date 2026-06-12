/**
 * routes_salon.js - 沙龙管理路由
 * 支持：3男3女分组沙龙 + 男士/女士推荐官专属沙龙
 *
 * GET  /v1/salon/list            - 沙龙列表（支持tier筛选）
 * GET  /v1/salon/upcoming        - 即将开始的沙龙
 * GET  /v1/salon/detail/:id      - 沙龙详情（含分组+剩余名额）
 * GET  /v1/salon/my-list         - 我参与/举办的沙龙
 * POST /v1/salon/create          - 创建沙龙（推荐官/城市合伙人）
 * POST /v1/salon/create-gender   - 创建性别主体沙龙（推荐官专用）
 * POST /v1/salon/:id/signup      - 报名（含每周限制+性别限制+27人封顶）
 * POST /v1/salon/:id/cancel      - 取消报名（释放每周名额）
 * POST /v1/salon/:id/publish     - 发布沙龙（published → open）
 * PUT  /v1/salon/:id/approve     - 审核沙龙（管理员，通过后生成海报，拒绝保存原因）
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth-middleware');

// 可申办沙龙的角色：联创推荐官、社区服务站、城市合伙人、专业推荐官
// 公益推荐官无申办权限，仅可报名参会
// 角色值须与 constants/roles.js 中的 ROLE_HIERARCHY 键名完全一致
const ALLOWED_CREATE_ROLES = ['partner_matchmaker', 'community_station', 'city_franchisee', 'professional_recommender'];

// 确保表存在（含新增字段）
function ensureSalonTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      type TEXT DEFAULT 'mixed',
      score_tier TEXT DEFAULT 'silver',
      is_grouped INTEGER DEFAULT 1,
      allowed_tiers TEXT DEFAULT 'gold,silver,bronze',
      location TEXT,
      city TEXT,
      province TEXT,
      event_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      max_participants INTEGER DEFAULT 6,
      male_count INTEGER DEFAULT 0,
      female_count INTEGER DEFAULT 0,
      max_per_gender INTEGER DEFAULT 3,
      registration_fee INTEGER DEFAULT 399,
      status TEXT DEFAULT 'draft',
      organizer_id INTEGER,
      process_json TEXT,
      notices_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      -- 新增：男士/女士推荐官沙龙专用字段
      max_recommenders INTEGER DEFAULT 9,   -- 单场推荐官上限9人
      max_companions_per_person INTEGER DEFAULT 2,  -- 每人最多随行2人
      total_cap INTEGER DEFAULT 27,  -- 单场总人数封顶27人
      week_day INTEGER,  -- 每周几（1-7），用于每周场次管理
      week_salon_type TEXT,  -- 'male' / 'female'，标识男场/女场
      poster_url TEXT,  -- 审核通过后生成的海报URL
      -- 新增：审核状态字段
      audit_status TEXT DEFAULT 'pending',  -- 审核状态：pending/approved/rejected
      audit_time TEXT,  -- 审核时间
      auditor_id INTEGER,  -- 审核人ID
      reject_reason TEXT,  -- 驳回原因
      FOREIGN KEY (organizer_id) REFERENCES users(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS salon_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      group_index INTEGER DEFAULT 1,
      score_tier TEXT NOT NULL,
      male_count INTEGER DEFAULT 0,
      female_count INTEGER DEFAULT 0,
      max_per_gender INTEGER DEFAULT 3,
      status TEXT DEFAULT 'forming',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salon_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      salon_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      gender TEXT NOT NULL,
      user_score INTEGER DEFAULT 0,
      user_score_tier TEXT,
      order_id INTEGER,
      companions_json TEXT,  -- 格式：[{"name":"xxx","mobile":"138xxxx","gender":"male/female/unknown","age":25,"industry":"互联网","identity":"上班族/个体老板/自由职业/其他","position":"工程师","business":"主营产品","advantage":"个人优势简介"}]
      status TEXT DEFAULT 'registered',
      registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TEXT,
      FOREIGN KEY (group_id) REFERENCES salon_groups(id),
      FOREIGN KEY (salon_id) REFERENCES salons(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(salon_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS weekly_signup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      salon_id INTEGER NOT NULL,
      salon_week_day TEXT NOT NULL,  -- 场次所在周的周一日期（YYYY-MM-DD格式）
      signup_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (salon_id) REFERENCES salons(id),
      UNIQUE(user_id, salon_week_day)
    );

    CREATE TABLE IF NOT EXISTS salon_posters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      poster_url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (salon_id) REFERENCES salons(id)
    );
  `);

  // 兼容已有表：尝试新增字段（忽略已存在字段的错误）
  const alterSqls = [
    `ALTER TABLE salons ADD COLUMN max_recommenders INTEGER DEFAULT 9`,
    `ALTER TABLE salons ADD COLUMN max_companions_per_person INTEGER DEFAULT 2`,
    `ALTER TABLE salons ADD COLUMN total_cap INTEGER DEFAULT 27`,
    `ALTER TABLE salons ADD COLUMN week_day INTEGER`,
    `ALTER TABLE salons ADD COLUMN week_salon_type TEXT`,
    `ALTER TABLE salons ADD COLUMN poster_url TEXT`,
    `ALTER TABLE salons ADD COLUMN audit_status TEXT DEFAULT 'pending'`,
    `ALTER TABLE salons ADD COLUMN audit_time TEXT`,
    `ALTER TABLE salons ADD COLUMN auditor_id INTEGER`,
    `ALTER TABLE salons ADD COLUMN reject_reason TEXT`,
  ];
  for (const sql of alterSqls) {
    try { db.exec(sql); } catch (e) { /* 字段已存在则忽略 */ }
  }

  // 兼容 users 表：新增 gender 字段
  try {
    db.exec(`ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'unknown'`);
  } catch (e) { /* 字段已存在则忽略 */ }
}

/**
 * GET /v1/salon/list
 * Query: tier, status, page, pageSize
 */
router.get('/list', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const { tier, status, page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;

    const conditions = ["status != 'draft'"];
    const params = [];

    if (tier) {
      conditions.push("(score_tier = ? OR score_tier = 'all' OR allowed_tiers LIKE '%' || ? || '%')");
      params.push(tier, tier);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');
    const countSql = `SELECT COUNT(*) as total FROM salons WHERE ${where}`;
    const { total } = db.prepare(countSql).get(...params);

    const listSql = `
      SELECT s.*, u.nickname as organizer_name
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      WHERE ${where}
      ORDER BY s.event_date ASC, s.start_time ASC
      LIMIT ? OFFSET ?
    `;
    params.push(Number(pageSize), offset);
    const list = db.prepare(listSql).all(...params);

    // 为每个沙龙附加分组名额信息和当前用户报名状态
    const userId = req.user.userId;
    const listWithGroups = list.map(salon => {
      const groups = db.prepare(
        'SELECT id, group_index, score_tier, male_count, female_count, max_per_gender, status FROM salon_groups WHERE salon_id = ?'
      ).all(salon.id);

      // 实时统计报名人数（不从 salons.male_count 读）
      const countByGender = db.prepare(`
        SELECT gender, COUNT(*) as cnt FROM salon_group_members WHERE salon_id = ? AND status != 'cancelled' GROUP BY gender
      `).all(salon.id);
      const realMaleCount = (countByGender.find(r => r.gender === 'male') || {}).cnt || 0;
      const realFemaleCount = (countByGender.find(r => r.gender === 'female') || {}).cnt || 0;

      const maleRemain = salon.max_per_gender - realMaleCount;
      const femaleRemain = salon.max_per_gender - realFemaleCount;

      // 检查当前用户是否已报名该沙龙
      const myReg = db.prepare(
        'SELECT id FROM salon_group_members WHERE salon_id = ? AND user_id = ? AND status != \'cancelled\''
      ).get(salon.id, userId);

      return {
        ...salon,
        male_count: realMaleCount,
        female_count: realFemaleCount,
        groups,
        maleRemain,
        femaleRemain,
        totalRemain: maleRemain + femaleRemain,
        isRegistered: !!myReg,
      };
    });

    res.json({
      code: 0,
      data: { list: listWithGroups, total, page: Number(page), pageSize: Number(pageSize) },
    });
  } catch (err) {
    console.error('[salon] list error:', err);
    res.status(500).json({ code: -1, message: '获取沙龙列表失败' });
  }
});

/**
 * GET /v1/salon/upcoming
 * 即将开始的沙龙（未来7天）
 */
router.get('/upcoming', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);
    const userId = req.user.userId;

    const list = db.prepare(`
      SELECT s.*, u.nickname as organizer_name
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      WHERE s.status IN ('published', 'open', 'full')
        AND s.event_date >= date('now')
      ORDER BY s.event_date ASC, s.start_time ASC
      LIMIT 20
    `).all();

    const listWithGroups = list.map(salon => {
      // 实时统计报名人数
      const countByGender = db.prepare(`
        SELECT gender, COUNT(*) as cnt FROM salon_group_members WHERE salon_id = ? AND status != 'cancelled' GROUP BY gender
      `).all(salon.id);
      const realMaleCount = (countByGender.find(r => r.gender === 'male') || {}).cnt || 0;
      const realFemaleCount = (countByGender.find(r => r.gender === 'female') || {}).cnt || 0;
      const maleRemain = salon.max_per_gender - realMaleCount;
      const femaleRemain = salon.max_per_gender - realFemaleCount;
      // 检查当前用户是否已报名
      const myReg = db.prepare(
        'SELECT id FROM salon_group_members WHERE salon_id = ? AND user_id = ? AND status != \'cancelled\''
      ).get(salon.id, userId);
      return { ...salon, male_count: realMaleCount, female_count: realFemaleCount, maleRemain, femaleRemain, totalRemain: maleRemain + femaleRemain, isRegistered: !!myReg };
    });

    res.json({ code: 0, data: listWithGroups });
  } catch (err) {
    console.error('[salon] upcoming error:', err);
    res.status(500).json({ code: -1, message: '获取即将开始的沙龙失败' });
  }
});

/**
 * GET /v1/salon/detail/:id
 * 沙龙详情（含分组信息+报名成员）
 */
router.get('/detail/:id', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const { id } = req.params;
    const userId = req.user.userId;

    const salon = db.prepare(`
      SELECT s.*, u.nickname as organizer_name
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      WHERE s.id = ?
    `).get(id);

    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }

    // 获取分组信息
    const groups = db.prepare(
      'SELECT * FROM salon_groups WHERE salon_id = ? ORDER BY group_index'
    ).all(id);

    // 获取每个分组的成员
    const groupsWithMembers = groups.map(g => {
      const members = db.prepare(
        'SELECT id, user_id, gender, user_score, user_score_tier, companions_json, status, registered_at FROM salon_group_members WHERE group_id = ? AND status != \'cancelled\''
      ).all(g.id);
      return { ...g, members };
    });

    // 当前用户是否已报名
    const myRegistration = db.prepare(
      'SELECT m.*, g.group_index, g.score_tier as group_tier FROM salon_group_members m JOIN salon_groups g ON m.group_id = g.id WHERE m.salon_id = ? AND m.user_id = ? AND m.status != \'cancelled\''
    ).get(id, userId);

    // 实时统计报名人数（不从 salons.male_count 读，因为可能因历史数据不准确）
    const countByGender = db.prepare(`
      SELECT gender, COUNT(*) as cnt FROM salon_group_members WHERE salon_id = ? AND status != 'cancelled' GROUP BY gender
    `).all(id);
    const realMaleCount = (countByGender.find(r => r.gender === 'male') || {}).cnt || 0;
    const realFemaleCount = (countByGender.find(r => r.gender === 'female') || {}).cnt || 0;

    const maleRemain = salon.max_per_gender - realMaleCount;
    const femaleRemain = salon.max_per_gender - realFemaleCount;

    res.json({
      code: 0,
      data: {
        ...salon,
        male_count: realMaleCount,    // 覆盖 salons 表中的缓存值
        female_count: realFemaleCount,
        groups: groupsWithMembers,
        maleRemain,
        femaleRemain,
        totalRemain: maleRemain + femaleRemain,
        myRegistration,
        isRegistered: !!myRegistration,
      },
    });
  } catch (err) {
    console.error('[salon] detail error:', err);
    res.status(500).json({ code: -1, message: '获取沙龙详情失败' });
  }
});

/**
 * GET /v1/salon/my-list
 * 我参与或举办的沙龙
 */
router.get('/my-list', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const userId = req.user.userId;

    // 我报名的沙龙
    const joined = db.prepare(`
      SELECT s.*, m.status as my_status, m.registered_at, g.group_index, g.score_tier as group_tier
      FROM salon_group_members m
      JOIN salons s ON m.salon_id = s.id
      LEFT JOIN salon_groups g ON m.group_id = g.id
      WHERE m.user_id = ? AND m.status != 'cancelled'
      ORDER BY s.event_date DESC
    `).all(userId);

    // 我举办的沙龙
    const organized = db.prepare(`
      SELECT * FROM salons WHERE organizer_id = ? ORDER BY event_date DESC
    `).all(userId);

    res.json({
      code: 0,
      data: { joined, organized },
    });
  } catch (err) {
    console.error('[salon] my-list error:', err);
    res.status(500).json({ code: -1, message: '获取我的沙龙失败' });
  }
});

/**
 * POST /v1/salon/create
 * 创建沙龙
 * 权限：联创推荐官、社区服务站、城市合伙人、专业推荐官可申办
 *       公益推荐官无申办权限，仅可报名参会
 */
router.post('/create', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    // 申办权限校验
    const userId = req.user.userId;
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (!user || !ALLOWED_CREATE_ROLES.includes(user.role)) {
      return res.status(403).json({
        code: -1,
        message: '仅联创推荐官、社区服务站、城市合伙人、专业推荐官可申办沙龙，公益推荐官仅可报名参会',
      });
    }

    const {
      title, description, cover_image, type, score_tier,
      is_grouped, allowed_tiers, location, city, province,
      event_date, start_time, end_time, max_per_gender,
      registration_fee, process_json, notices_json,
    } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ code: -1, message: '标题和日期为必填项' });
    }

    const result = db.prepare(`
      INSERT INTO salons (title, description, cover_image, type, score_tier, is_grouped, allowed_tiers,
        location, city, province, event_date, start_time, end_time, max_per_gender,
        registration_fee, process_json, notices_json, organizer_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      title, description || null, cover_image || null, type || 'mixed',
      score_tier || 'all', is_grouped !== undefined ? (is_grouped ? 1 : 0) : 1,
      allowed_tiers || 'gold,silver,bronze',
      location || null, city || null, province || null,
      event_date, start_time || null, end_time || null,
      max_per_gender || 3, registration_fee || 399,
      process_json || null, notices_json || null, userId
    );

    // 如果是分组模式，自动创建默认分组
    if (is_grouped !== false) {
      const salonId = result.lastInsertRowid;
      const tierList = (allowed_tiers || 'gold,silver,bronze').split(',');
      tierList.forEach((tier, idx) => {
        db.prepare(`
          INSERT INTO salon_groups (salon_id, group_index, score_tier, max_per_gender)
          VALUES (?, ?, ?, ?)
        `).run(salonId, idx + 1, tier.trim(), max_per_gender || 3);
      });
    }

    res.json({
      code: 0,
      message: '沙龙创建成功，等待审核',
      data: { salon_id: result.lastInsertRowid },
    });
  } catch (err) {
    console.error('[salon] create error:', err);
    res.status(500).json({ code: -1, message: '创建沙龙失败' });
  }
});

/**
 * POST /v1/salon/create-gender
 * 创建性别主体沙龙（推荐官专用）
 * 将前端字段映射到后端统一数据模型
 * 前端输入：{ title, description, location, startTime, endTime, max_per_gender, registration_fee, cover_image, is_grouped, allowed_tiers, week_salon_type }
 * 后端写入：{ event_date, start_time, end_time, type }
 */
router.post('/create-gender', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    // 申办权限校验
    const userId = req.user.userId;
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (!user || !ALLOWED_CREATE_ROLES.includes(user.role)) {
      return res.status(403).json({
        code: -1,
        message: '仅联创推荐官、社区服务站、城市合伙人、专业推荐官可申办沙龙，公益推荐官仅可报名参会',
      });
    }

    const {
      title, description, location, startTime, endTime,
      max_per_gender, registration_fee, cover_image,
      is_grouped, allowed_tiers, week_salon_type,
    } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ code: -1, message: '标题和开始时间为必填项' });
    }

    // 从 startTime 中解析 event_date 和 start_time
    // startTime 格式: "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DDTHH:mm:ss"
    const dt = new Date(startTime);
    if (isNaN(dt.getTime())) {
      return res.status(400).json({ code: -1, message: '开始时间格式无效' });
    }
    const event_date = dt.toISOString().split('T')[0];
    const start_time = startTime.includes('T')
      ? startTime
      : dt.toISOString();

    // 解析 endTime
    let end_time = null;
    if (endTime) {
      const et = new Date(endTime);
      if (!isNaN(et.getTime())) {
        end_time = endTime.includes('T') ? endTime : et.toISOString();
      }
    }

    // week_salon_type → type 映射
    const type = week_salon_type === 'male' ? 'male_salon'
               : week_salon_type === 'female' ? 'female_salon'
               : 'mixed';

    // 性别主题沙龙默认 score_tier = 'all'（不限制评分等级）
    const score_tier = 'all';

    const result = db.prepare(`
      INSERT INTO salons (title, description, cover_image, type, score_tier, is_grouped, allowed_tiers,
        location, event_date, start_time, end_time, max_per_gender,
        registration_fee, organizer_id, status, week_salon_type, week_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      title, description || null, cover_image || null, type,
      score_tier, is_grouped !== undefined ? (is_grouped ? 1 : 0) : 1,
      allowed_tiers || 'gold,silver,bronze',
      location || null, event_date, start_time, end_time,
      max_per_gender || 3, registration_fee || 399, userId,
      week_salon_type || null,
      new Date(event_date).getDay() || null  // 计算 week_day（0=周日）
    );

    // 如果是分组模式，自动创建默认分组
    const salonId = result.lastInsertRowid;
    if (is_grouped !== false) {
      const tierList = (allowed_tiers || 'gold,silver,bronze').split(',');
      tierList.forEach((tier, idx) => {
        db.prepare(`
          INSERT INTO salon_groups (salon_id, group_index, score_tier, max_per_gender)
          VALUES (?, ?, ?, ?)
        `).run(salonId, idx + 1, tier.trim(), max_per_gender || 3);
      });
    }

    res.json({
      code: 0,
      message: '沙龙创建成功，等待审核',
      data: { salon_id: salonId },
    });
  } catch (err) {
    console.error('[salon] create-gender error:', err);
    res.status(500).json({ code: -1, message: '创建沙龙失败：' + err.message });
  }
});

/**
 * 工具函数：获取指定日期所在周的周一日期（YYYY-MM-DD）
 */
function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=周日, 1=周一, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * POST /v1/salon/:id/signup
 * 报名沙龙
 * 校验逻辑：
 *   1. 每周报名次数限制（每人每周仅限1次）
 *   2. 男/女场性别限制（男推荐官只能报男场，女推荐官只能报女场）
 *   3. 人数限额校验（9推荐官+每人最多2随行，封顶27人）
 *
 * Body: { name, mobile, gender, age, industry, identity, position, business, advantage, companions: [{name, mobile, ...}] }
 */
router.post('/:id/signup', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const userId = req.user.userId;
    const { id } = req.params;
    const {
      name, mobile, gender: reqGender, age, industry, identity,
      position, business, advantage, companions
    } = req.body;

    // 获取沙龙信息
    const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(id);
    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }
    if (!['published', 'open'].includes(salon.status)) {
      return res.status(400).json({ code: -1, message: '该沙龙暂未开放报名' });
    }

    // 获取用户信息
    const user = db.prepare('SELECT id, gender, score_tier, profile_score, nickname, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // ===== 校验1：每周报名次数限制 =====
    const weekMonday = getMonday(salon.event_date);
    const weeklySignup = db.prepare(
      'SELECT id FROM weekly_signup WHERE user_id = ? AND salon_week_day = ?'
    ).get(userId, weekMonday);
    if (weeklySignup) {
      return res.status(400).json({ code: -1, message: '本周报名次数已用尽（每周仅限报名1次）' });
    }

    // ===== 校验2：男/女场性别限制 =====
    if (salon.week_salon_type) {
      const userGender = user.gender || 'unknown';
      if (salon.week_salon_type === 'male' && userGender !== 'male') {
        return res.status(400).json({ code: -1, message: '本场为男士推荐官专属沙龙，仅男士推荐官可报名' });
      }
      if (salon.week_salon_type === 'female' && userGender !== 'female') {
        return res.status(400).json({ code: -1, message: '本场为女士推荐官专属沙龙，仅女士推荐官可报名' });
      }
    }

    // ===== 校验3：人数限额校验（27人封顶）=====
    // 统计当前总报名人数（主推荐官数 + 所有随行人员数）
    const countResult = db.prepare(`
      SELECT
        COUNT(*) as main_count,
        SUM(CASE WHEN companions_json IS NOT NULL THEN json_array_length(companions_json) ELSE 0 END) as companion_count
      FROM salon_group_members
      WHERE salon_id = ? AND status != 'cancelled'
    `).get(id);

    const currentMainCount = countResult.main_count || 0;
    const currentCompanionCount = countResult.companion_count || 0;
    const currentTotal = currentMainCount + currentCompanionCount;

    // 新报名：1位主推荐官 + 随行人员
    const newCompanionsCount = Array.isArray(companions) ? companions.length : 0;
    const newTotal = currentTotal + 1 + newCompanionsCount;

    const totalCap = salon.total_cap || 27;
    if (newTotal > totalCap) {
      return res.status(400).json({ code: -1, message: `本场沙龙已满员（${totalCap}人封顶）` });
    }

    // 检查是否超过单场推荐官上限（9人）
    const maxRecommenders = salon.max_recommenders || 9;
    if (currentMainCount >= maxRecommenders) {
      return res.status(400).json({ code: -1, message: `本场推荐官名额已满（${maxRecommenders}人封顶）` });
    }

    // 检查是否已报名（含取消后重新报名的场景）
    const existing = db.prepare(
      'SELECT id, status FROM salon_group_members WHERE salon_id = ? AND user_id = ?'
    ).get(id, userId);
    if (existing && existing.status !== 'cancelled') {
      return res.status(400).json({ code: -1, message: '您已报名该沙龙' });
    }

    // 检查tier是否允许
    const userTier = user.score_tier || 'unrated';
    const allowedTiers = (salon.allowed_tiers || '').split(',').map(t => t.trim());
    if (salon.score_tier !== 'all' && !allowedTiers.includes(userTier)) {
      return res.status(403).json({
        code: -1,
        message: `您的评分等级(${userTier})不在该沙龙允许范围内，该场次限${salon.allowed_tiers}等级参加`,
      });
    }

    // 构建随行人员JSON（含详细资料）
    let companionsData = null;
    if (Array.isArray(companions) && companions.length > 0) {
      // 检查随行人数是否超过限制
      const maxCompanions = salon.max_companions_per_person || 2;
      if (companions.length > maxCompanions) {
        return res.status(400).json({ code: -1, message: `每位推荐官最多携带${maxCompanions}名随行人员` });
      }
      companionsData = JSON.stringify(companions.map(c => ({
        name: c.name || '',
        mobile: c.mobile || '',
        gender: c.gender || 'unknown',
        age: c.age || null,
        industry: c.industry || '',
        identity: c.identity || '',       // 上班族/个体老板/自由职业/其他
        position: c.position || '',         // 上班岗位/职务
        business: c.business || '',         // 经营主营项目
        advantage: c.advantage || '',      // 个人优势资源简介
      })));
    }

    // 找到匹配的分组（按tier匹配）
    let group = db.prepare(
      'SELECT * FROM salon_groups WHERE salon_id = ? AND score_tier = ? AND status = \'forming\' LIMIT 1'
    ).get(id, userTier);

    if (!group) {
      group = db.prepare(
        'SELECT * FROM salon_groups WHERE salon_id = ? AND status = \'forming\' LIMIT 1'
      ).get(id);
    }

    if (!group) {
      const groupResult = db.prepare(`
        INSERT INTO salon_groups (salon_id, group_index, score_tier, max_per_gender)
        VALUES (?, 1, ?, ?)
      `).run(id, userTier, salon.max_per_gender || 3);
      group = { id: groupResult.lastInsertRowid, male_count: 0, female_count: 0, max_per_gender: salon.max_per_gender || 3 };
    }

    // 创建/恢复报名记录（含随行人员详细资料）
    const userGender = user.gender || 'unknown';
    if (existing && existing.status === 'cancelled') {
      // 取消后重新报名：更新已有记录
      db.prepare(`
        UPDATE salon_group_members SET
          group_id = ?, gender = ?, user_score = ?, user_score_tier = ?,
          companions_json = ?, status = 'registered',
          registered_at = datetime('now'), cancelled_at = NULL
        WHERE id = ?
      `).run(group.id, userGender, user.profile_score || 0, userTier, companionsData, existing.id);
    } else {
      // 首次报名：插入新记录
      db.prepare(`
        INSERT INTO salon_group_members (
          group_id, salon_id, user_id, gender, user_score, user_score_tier,
          companions_json, status, registered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', datetime('now'))
      `).run(group.id, id, userId, userGender, user.profile_score || 0, userTier, companionsData);
    }

    // 更新分组人数
    const genderCountField = userGender === 'male' ? 'male_count' : 'female_count';
    db.prepare(`UPDATE salon_groups SET ${genderCountField} = ${genderCountField} + 1 WHERE id = ?`).run(group.id);

    // 更新沙龙总人数
    const salonGenderField = userGender === 'male' ? 'male_count' : 'female_count';
    db.prepare(`UPDATE salons SET ${salonGenderField} = ${salonGenderField} + 1, updated_at = datetime('now') WHERE id = ?`).run(id);

    // ===== 记录每周报名 =====
    db.prepare(
      'INSERT INTO weekly_signup (user_id, salon_id, salon_week_day) VALUES (?, ?, ?)'
    ).run(userId, id, weekMonday);

    // 检查分组是否已满
    const updatedGroup = db.prepare('SELECT male_count, female_count, max_per_gender FROM salon_groups WHERE id = ?').get(group.id);
    if (updatedGroup.male_count >= updatedGroup.max_per_gender && updatedGroup.female_count >= updatedGroup.max_per_gender) {
      db.prepare("UPDATE salon_groups SET status = 'ready' WHERE id = ?").run(group.id);
    }

    // 检查沙龙是否满员（27人封顶）
    if (newTotal >= totalCap) {
      db.prepare("UPDATE salons SET status = 'full', updated_at = datetime('now') WHERE id = ?").run(id);
    }

    // TODO: 创建报名费订单 + 支付回调触发佣金

    res.json({
      code: 0,
      message: '报名成功',
      data: {
        salon_id: Number(id),
        group_id: group.id,
        group_index: group.group_index || 1,
        registration_fee: salon.registration_fee,
        total_count: newTotal,
        remaining: totalCap - newTotal,
      },
    });
  } catch (err) {
    console.error('[salon] signup error:', err);
    res.status(500).json({ code: -1, message: '报名失败：' + err.message });
  }
});

/**
 * POST /v1/salon/:id/cancel
 * 取消报名
 */
router.post('/:id/cancel', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const userId = req.user.userId;
    const { id } = req.params;

    // 先获取沙龙信息（用于计算 weekly_signup 的 salon_week_day）
    const salon = db.prepare('SELECT event_date FROM salons WHERE id = ?').get(id);
    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }

    const member = db.prepare(
      'SELECT m.*, g.max_per_gender as group_max FROM salon_group_members m JOIN salon_groups g ON m.group_id = g.id WHERE m.salon_id = ? AND m.user_id = ? AND m.status != \'cancelled\''
    ).get(id, userId);

    if (!member) {
      return res.status(400).json({ code: -1, message: '未找到有效报名记录' });
    }

    // 更新成员状态
    db.prepare("UPDATE salon_group_members SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?").run(member.id);

    // 更新分组计数
    const genderCountField = member.gender === 'male' ? 'male_count' : 'female_count';
    db.prepare(`UPDATE salon_groups SET ${genderCountField} = CASE WHEN ${genderCountField} > 0 THEN ${genderCountField} - 1 ELSE 0 END, status = 'forming' WHERE id = ?`).run(member.group_id);

    // 更新沙龙计数
    const salonGenderField = member.gender === 'male' ? 'male_count' : 'female_count';
    db.prepare(`UPDATE salons SET ${salonGenderField} = CASE WHEN ${salonGenderField} > 0 THEN ${salonGenderField} - 1 ELSE 0 END, status = 'open', updated_at = datetime('now') WHERE id = ?`).run(id);

    // 释放每周报名名额（取消后允许同一周报名其他沙龙）
    const weekMonday = getMonday(salon.event_date);
    db.prepare('DELETE FROM weekly_signup WHERE user_id = ? AND salon_id = ? AND salon_week_day = ?').run(userId, id, weekMonday);

    res.json({ code: 0, message: '取消报名成功' });
  } catch (err) {
    console.error('[salon] cancel error:', err);
    res.status(500).json({ code: -1, message: '取消报名失败' });
  }
});

/**
 * POST /v1/salon/:id/publish
 * 发布沙龙（推荐官/组织者）
 */
router.post('/:id/publish', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const userId = req.user.userId;

    const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(id);
    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }
    if (salon.organizer_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ code: -1, message: '无权操作' });
    }

    db.prepare("UPDATE salons SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(id);

    res.json({ code: 0, message: '沙龙已发布' });
  } catch (err) {
    console.error('[salon] publish error:', err);
    res.status(500).json({ code: -1, message: '发布失败' });
  }
});

/**
 * 生成沙龙海报（内部函数）
 * 审核通过后调用，生成海报URL并存储
 */
async function generateSalonPoster(salonId) {
  try {
    const db = req.app.get('db');
    const salon = db.prepare(`
      SELECT s.*, u.nickname as organizer_name
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      WHERE s.id = ?
    `).get(salonId);

    if (!salon) return null;

    // 构造海报URL（实际项目中此处应调用canvas生成海报图片并上传COS）
    // 此处先生成一个占位URL，实际实现需对接小程序码API
    const posterUrl = `/assets/posters/salon_${salonId}.png`;

    // 存储海报URL到salons表
    db.prepare("UPDATE salons SET poster_url = ? WHERE id = ?").run(posterUrl, salonId);

    // 同时写入salon_posters表
    db.prepare(
      'INSERT INTO salon_posters (salon_id, poster_url) VALUES (?, ?)'
    ).run(salonId, posterUrl);

    console.log(`[salon] 海报已生成：salonId=${salonId}, url=${posterUrl}`);
    return posterUrl;
  } catch (err) {
    console.error('[salon] generatePoster error:', err);
    return null;
  }
}

/**
 * PUT /v1/salon/:id/approve
 * 审核沙龙（管理员）
 * 审核通过时自动生成海报，审核拒绝时保存拒绝原因
 */
router.put('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { action, reject_reason } = req.body;
    const auditorId = req.user.userId;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: -1, message: 'action须为approve或reject' });
    }

    if (action === 'approve') {
      // 审核通过：设置audit_status='approved'，同时设置status='published'
      db.prepare(`UPDATE salons SET 
        audit_status = 'approved', 
        status = 'published', 
        reject_reason = NULL, 
        audit_time = datetime('now'), 
        auditor_id = ?,
        updated_at = datetime('now') 
        WHERE id = ?`).run(auditorId, id);

      // 审核通过后异步生成海报（不阻塞响应）
      generateSalonPoster(id).then(posterUrl => {
        if (posterUrl) {
          console.log(`[salon] 海报生成成功： ${posterUrl}`);
        }
      }).catch(err => {
        console.error('[salon] 海报生成失败：', err);
      });
    } else {
      // 审核拒绝：设置audit_status='rejected'，保持status='draft'
      if (!reject_reason) {
        return res.status(400).json({ code: -1, message: '拒绝时必须提供拒绝原因' });
      }
      db.prepare(`UPDATE salons SET 
        audit_status = 'rejected', 
        status = 'draft', 
        reject_reason = ?, 
        audit_time = datetime('now'), 
        auditor_id = ?,
        updated_at = datetime('now') 
        WHERE id = ?`).run(reject_reason, auditorId, id);
    }

    res.json({ code: 0, message: action === 'approve' ? '审核通过，海报生成中' : '已拒绝' });
  } catch (err) {
    console.error('[salon] approve error:', err);
    res.status(500).json({ code: -1, message: '审核失败' });
  }
});

/**
 * GET /v1/salon/admin/pending
 * 获取待审核的推荐官沙龙列表（管理员）
 */
router.get('/admin/pending', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);

    const { page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;

    // 查询待审核的沙龙（audit_status='pending' 或 audit_status IS NULL）
    const countSql = `SELECT COUNT(*) as total FROM salons WHERE audit_status = 'pending' OR audit_status IS NULL`;
    const { total } = db.prepare(countSql).get();

    const listSql = `
      SELECT s.*, 
             u.nickname as organizer_name,
             u.mobile as organizer_mobile
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      WHERE s.audit_status = 'pending' OR s.audit_status IS NULL
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const list = db.prepare(listSql).all(pageSize, offset);

    res.json({
      code: 0,
      data: {
        list,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (err) {
    console.error('[salon] get pending salons error:', err);
    res.status(500).json({ code: -1, message: '获取待审核沙龙列表失败' });
  }
});

/**
 * GET /v1/salon/weekly-schedule
 * 获取周历报名状况（周一至周五，分上下午场）
 * Query: weekMonday (可选，默认当前周), session (am/pm，可选，默认am)
 */
router.get('/weekly-schedule', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureSalonTables(db);
    const userId = req.user.userId;

    const weekMonday = req.query.weekMonday || getMonday(new Date().toISOString().split('T')[0]);
    const session = req.query.session || 'am';

    // 计算 weekStart 和 weekEnd
    const weekStart = weekMonday;
    const weekEnd = new Date(weekMonday);
    weekEnd.setDate(weekEnd.getDate() + 4);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // 时间范围
    const timeStart = session === 'am' ? '00:00' : '12:00';
    const timeEnd = session === 'am' ? '12:00' : '23:59';

    // 查询该周的所有沙龙
    const salons = db.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM salon_group_members WHERE salon_id = s.id AND status != 'cancelled') as registered_count
      FROM salons s
      WHERE s.week_day IN (1, 2, 3, 4, 5)
        AND s.event_date >= ? AND s.event_date <= ?
        AND s.start_time >= ? AND s.start_time < ?
        AND s.status IN ('published', 'open', 'full')
      ORDER BY s.week_day ASC
    `).all(weekStart, weekEndStr, timeStart, timeEnd);

    // 构建日程表（周一到周五）
    const weekDays = [
      { dayKey: 1, date: addDays(weekMonday, 0) },
      { dayKey: 2, date: addDays(weekMonday, 1) },
      { dayKey: 3, date: addDays(weekMonday, 2) },
      { dayKey: 4, date: addDays(weekMonday, 3) },
      { dayKey: 5, date: addDays(weekMonday, 4) },
    ];

    const schedule = weekDays.map(day => {
      const salon = salons.find(s => s.week_day === day.dayKey);
      if (!salon) {
        return { dayKey: day.dayKey, date: day.date, slot: null };
      }

      // 计算剩余名额
      const registeredCount = salon.registered_count || 0;
      const maxPerGender = salon.max_per_gender || 3;
      const maxParticipants = maxPerGender * 2; // 3男3女 = 6
      const remaining = Math.max(0, maxParticipants - registeredCount);

      // 用户是否已报名
      const myReg = db.prepare(
        'SELECT id FROM salon_group_members WHERE salon_id = ? AND user_id = ? AND status != \'cancelled\''
      ).get(salon.id, userId);

      return {
        dayKey: day.dayKey,
        date: day.date,
        slot: {
          id: salon.id,
          title: salon.title,
          startTime: salon.start_time,
          endTime: salon.end_time,
          registeredCount,
          maxParticipants,
          remaining,
          registrationFee: salon.registration_fee || 299,
          originalFee: 399,
          isRegistered: !!myReg,
          isFull: remaining <= 0,
        },
      };
    });

    res.json({
      code: 0,
      data: {
        weekMonday,
        schedule,
      },
    });
  } catch (err) {
    console.error('[salon] weekly-schedule error:', err);
    res.status(500).json({ code: -1, message: '获取周历失败' });
  }
});

/**
 * 辅助函数：日期加减
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

module.exports = router;
