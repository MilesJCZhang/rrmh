// routes_referral-codes.js - 推荐码管理路由（小程序端）
// 提供推荐码生成、验证、查询、使用记录、推荐关系树、PDF导出等功能
const express = require('express');
const router = express.Router();

// 中间件：为每个请求注入共享的数据库连接到 req.db
router.use((req, res, next) => {
  req.db = req.app.get('db');
  next();
});

/**
 * 生成推荐码前缀
 */
function generateReferralCode(codeType) {
  const prefixMap = {
    'public_welfare': 'GYRG',
    'creator': 'LCRG',
    'professional': 'ZYRG',
    'community_station': 'SQZD',
    'city_partner': 'CSHH'
  };

  const prefix = prefixMap[codeType] || 'GYRG';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const code = prefix + suffix;
  // 注意：generateReferralCode 需要 db 参数，在路由处理器中传入 req.db
  return code;
}

// 验证推荐码是否唯一
function isCodeUnique(db, code) {
  const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
  return !existing;
}

// 生成唯一推荐码（确保不重复）
function generateUniqueReferralCode(db, codeType) {
  let code;
  let attempts = 0;
  do {
    code = generateReferralCode(codeType);
    attempts++;
  } while (!isCodeUnique(db, code) && attempts < 10);
  return code;
}

/**
 * 获取推荐码列表（管理端）
 * GET /api/admin/referral-codes/list
 */
router.get('/list', (req, res) => {
  const db = req.db;
  const { user_id, page = 1, page_size = 20, code_type, status } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (user_id) {
      whereClause += ' AND rc.referrer_id = ?';
      params.push(user_id);
    }

    if (code_type) {
      whereClause += ' AND rc.code_type = ?';
      params.push(code_type);
    }

    if (status) {
      whereClause += ' AND rc.status = ?';
      params.push(status);
    } else {
      // 默认过滤已删除的推荐码
      whereClause += " AND rc.status != 'deleted'";
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM referral_codes rc
      ${whereClause}
    `).get(...params);

    const total = countResult?.total || 0;
    const offset = (page - 1) * page_size;

    const codes = db.prepare(`
      SELECT
        rc.*,
        u.nickname as referrer_name,
        u.role as referrer_role
      FROM referral_codes rc
      LEFT JOIN users u ON u.id = rc.referrer_id
      ${whereClause}
      ORDER BY rc.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, page_size, offset);

    res.json({
      code: 0,
      data: {
        codes,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total,
          total_pages: Math.ceil(total / page_size)
        }
      }
    });

  } catch (err) {
    console.error('[referral-codes] 查询推荐码列表失败:', err);
    res.json({ code: 500, message: '查询失败：' + err.message });
  }
});

/**
 * 获取推荐码统计（管理端）
 * GET /api/admin/referral-codes/stats
 */
router.get('/stats', (req, res) => {
  const db = req.db;
  const { status } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status) {
      whereClause += ' AND rc.status = ?';
      params.push(status);
    } else {
      // 默认过滤已删除的推荐码
      whereClause += " AND rc.status != 'deleted'";
    }

    const stats = db.prepare(`
      SELECT 
        rc.code_type,
        COUNT(*) as count
      FROM referral_codes rc
      ${whereClause}
      GROUP BY rc.code_type
    `).all(...params);

    // 转换为前端需要的格式
    const result = {};
    stats.forEach((item) => {
      result[item.code_type] = item.count;
    });

    res.json({ code: 0, data: result });
  } catch (err) {
    console.error('[referral-codes] 查询推荐码统计失败:', err);
    res.json({ code: 500, message: '查询统计失败：' + err.message });
  }
});

/**
 * 手动创建推荐码（管理端）
 * POST /api/admin/referral-codes/manual-create
 */
router.post('/manual-create', (req, res) => {
  const db = req.db;
  const { user_id, code_type, type, code, max_uses, expire_date, expires_at } = req.body;

  // 支持 type 和 code_type 两种参数名
  const finalCodeType = code_type || type;
  const finalMaxUses = max_uses !== undefined ? parseInt(max_uses) : 0;
  // 支持 expire_date 和 expires_at 两种参数名
  const finalExpiresAt = expires_at || expire_date || null;

  console.log('[referral-codes] 手动创建推荐码请求:', { user_id, code_type: finalCodeType, code });

  if (!finalCodeType) {
    return res.json({ code: 400, message: '缺少必要参数：推荐码类型' });
  }

  const allowedRoles = ['public_welfare', 'creator', 'professional', 'community_station', 'city_partner'];
  if (!allowedRoles.includes(finalCodeType)) {
    return res.json({ code: 400, message: '无效的身份类型' });
  }

  try {
    // 如果提供了 user_id，验证用户是否存在
    if (user_id) {
      const user = db.prepare('SELECT id, role, referral_code FROM users WHERE id = ?').get(user_id);

      if (!user) {
        return res.json({ code: 404, message: '用户不存在' });
      }
    }

    // 如果指定了推荐码，检查是否已存在
    let finalCode = code;
    if (finalCode) {
      const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(finalCode.toUpperCase());
      if (existing) {
        return res.json({ code: 409, message: '推荐码已存在' });
      }
    } else {
      // 自动生成
      finalCode = generateReferralCode(finalCodeType);
    }

    // 插入推荐码（referrer_id 可以是 NULL）
    db.prepare(`
      INSERT INTO referral_codes (code, code_type, referrer_id, status, created_by, use_count, max_uses, expires_at)
      VALUES (?, ?, ?, 'active', ?, 0, ?, ?)
    `).run(finalCode.toUpperCase(), finalCodeType, user_id || null, user_id || null, finalMaxUses, finalExpiresAt);

    // 如果提供了 user_id，更新用户的推荐码
    if (user_id) {
      db.prepare('UPDATE users SET referral_code = ?, referral_level = 1 WHERE id = ?').run(finalCode.toUpperCase(), user_id);
    }

    console.log('[referral-codes] 推荐码手动创建成功:', { user_id, code: finalCode, code_type: finalCodeType });

    res.json({ code: 0, data: { code: finalCode, code_type: finalCodeType, message: '推荐码创建成功' } });

  } catch (err) {
    console.error('[referral-codes] 手动创建推荐码失败:', err);
    res.json({ code: 500, message: '创建推荐码失败：' + err.message });
  }
});

/**
 * 生成推荐码（批量）
 * POST /api/admin/referral-codes/generate
 * 前端发送：{ type: 'public_welfare', count: 10 }
 */
router.post('/generate', (req, res) => {
  const db = req.db;
  const { type, count = 1 } = req.body;

  console.log('[referral-codes] 批量生成推荐码请求:', { type, count });

  const allowedRoles = ['public_welfare', 'creator', 'professional', 'community_station', 'city_partner'];
  if (!type) {
    return res.json({ code: 400, message: '缺少必要参数' });
  }
  if (!allowedRoles.includes(type)) {
    return res.json({ code: 400, message: '无效的身份类型' });
  }

  try {
    const codes = [];
    const timestamp = Date.now();
    const batchId = `BATCH_${timestamp}_${Math.random().toString(16).substr(2, 6).toUpperCase()}`;

    for (let i = 0; i < count; i++) {
      const code = generateReferralCode(type);

      db.prepare(`
        INSERT INTO referral_codes (code, code_type, referrer_id, status, created_by, use_count, max_uses, batch_id)
        VALUES (?, ?, NULL, 'active', NULL, 0, 0, ?)
      `).run(code, type, batchId);

      codes.push(code);
    }

    console.log('[referral-codes] 推荐码批量生成成功:', { count: codes.length, type, batchId });

    res.json({
      code: 0,
      data: {
        codes: codes,
        count: codes.length,
        batch_id: batchId
      },
      message: `成功生成 ${codes.length} 个推荐码`
    });

  } catch (err) {
    console.error('[referral-codes] 批量生成推荐码失败:', err);
    res.json({ code: 500, message: '生成推荐码失败：' + err.message });
  }
});

/**
 * 删除推荐码
 * POST /api/admin/referral-codes/delete
 */
router.post('/delete', (req, res) => {
  const db = req.db;
  const { code } = req.body;

  if (!code) {
    return res.json({ code: 400, message: '缺少推荐码' });
  }

  try {
    const existing = db.prepare('SELECT id, status FROM referral_codes WHERE code = ?').get(code.toUpperCase());

    if (!existing) {
      return res.json({ code: 404, message: '推荐码不存在' });
    }

    // 软删除：标记为已删除而不是物理删除
    db.prepare("UPDATE referral_codes SET status = 'deleted' WHERE code = ?").run(code.toUpperCase());

    console.log('[referral-codes] 推荐码删除成功:', { code });

    res.json({ code: 0, data: { code }, message: '删除成功' });

  } catch (err) {
    console.error('[referral-codes] 删除推荐码失败:', err);
    res.json({ code: 500, message: '删除失败：' + err.message });
  }
});

/**
 * 验证推荐码
 * POST /api/referral-codes/verify
 */
router.post('/verify', (req, res) => {
  const db = req.db;
  const { code } = req.body;

  if (!code) {
    return res.json({ code: 400, message: '推荐码不能为空' });
  }

  try {
    const result = db.prepare(`
      SELECT rc.*, u.nickname as referrer_name, u.role as referrer_role
      FROM referral_codes rc
      LEFT JOIN users u ON u.id = rc.referrer_id
      WHERE rc.code = ?
    `).get(code.toUpperCase());

    if (!result) {
      return res.json({ code: 404, message: '推荐码无效或已失效' });
    }

    // ✅ 关键修改：检查推荐码是否已绑定推荐人
    if (!result.referrer_id) {
      return res.json({
        code: 400,
        data: {
          valid: false,
          code: result.code,
          code_type: result.code_type,
          referrer_id: null,
          referrer_name: null,
          message: '推荐码未关联推荐官，请联系管理员绑定'
        }
      });
    }

    res.json({
      code: 0,
      data: {
        valid: true,
        code: result.code,
        code_type: result.code_type,
        referrer_id: result.referrer_id,
        referrer_name: result.referrer_name || '推荐官',
        message: '推荐码有效'
      }
    });

  } catch (err) {
    console.error('[referral-codes] 验证推荐码失败:', err);
    res.json({ code: 500, message: '验证失败' });
  }
});

/**
 * 获取用户的推荐码
 * GET /api/referral-codes/my/:user_id
 */
router.get('/my/:user_id', (req, res) => {
  const db = req.db;
  const { user_id } = req.params;

  try {
    const result = db.prepare(`
      SELECT rc.*, u.nickname, u.role
      FROM referral_codes rc
      LEFT JOIN users u ON u.id = rc.referrer_id
      WHERE rc.referrer_id = ?
      ORDER BY rc.created_at DESC
      LIMIT 1
    `).get(user_id);

    if (!result) {
      return res.json({ code: 404, message: '未找到推荐码' });
    }

    res.json({
      code: 0,
      data: {
        code: result.code,
        code_type: result.code_type,
        referrer_name: result.nickname || '推荐官',
        created_at: result.created_at
      }
    });

  } catch (err) {
    console.error('[referral-codes] 查询推荐码失败:', err);
    res.json({ code: 500, message: '查询失败' });
  }
});

/**
 * 查询推荐码使用记录
 * GET /api/referral-codes/usage-records
 */
router.get('/usage-records', (req, res) => {
  const db = req.db;
  const { user_id, code, page = 1, page_size = 20 } = req.query;

  if (!user_id) {
    return res.json({ code: 400, message: '缺少用户ID' });
  }

  try {
    let whereClause = 'WHERE rc.referrer_id = ?';
    let params = [user_id];

    if (code) {
      whereClause += ' AND rul.code = ?';
      params.push(code.toUpperCase());
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM referral_usage_logs rul
      LEFT JOIN referral_codes rc ON rc.code = rul.code
      ${whereClause}
    `).get(...params);

    const total = countResult?.total || 0;
    const offset = (page - 1) * page_size;

    const records = db.prepare(`
      SELECT
        rul.id,
        rul.code,
        rul.user_id,
        u.nickname as user_name,
        u.role as user_role,
        rul.scene,
        rul.ip_address,
        rul.created_at
      FROM referral_usage_logs rul
      LEFT JOIN referral_codes rc ON rc.code = rul.code
      LEFT JOIN users u ON u.id = rul.user_id
      ${whereClause}
      ORDER BY rul.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, page_size, offset);

    const formattedRecords = records.map(record => ({
      id: record.id,
      code: record.code,
      user_id: record.user_id,
      user_name: record.user_name || '用户' + record.user_id,
      user_role: record.user_role || 'user',
      scene: record.scene,
      scene_name: getSceneName(record.scene),
      ip_address: record.ip_address,
      created_at: record.created_at,
      time_ago: getTimeAgo(record.created_at)
    }));

    res.json({
      code: 0,
      data: {
        records: formattedRecords,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total,
          total_pages: Math.ceil(total / page_size)
        }
      }
    });

  } catch (err) {
    console.error('[referral-codes] 查询使用记录失败:', err);
    res.json({ code: 500, message: '查询失败：' + err.message });
  }
});

function getSceneName(scene) {
  const sceneMap = {
    'register': '注册使用',
    'manual_bind': '手动绑定',
    'scan_qrcode': '扫码使用'
  };
  return sceneMap[scene] || '其他';
}

function getTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 172800000) return '昨天';
  return (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

/**
 * 获取推荐关系树
 * GET /api/referral-codes/tree
 */
router.get('/tree', (req, res) => {
  const db = req.db;
  const { user_id, max_depth = 3 } = req.query;

  console.log('[referral-codes] 获取推荐关系树请求:', { user_id, max_depth });

  if (!user_id) {
    return res.json({ code: 400, message: '缺少用户ID' });
  }

  // 验证 user_id 是否为有效的整数
  const uid = parseInt(user_id);
  if (isNaN(uid) || uid <= 0) {
    return res.json({ code: 400, message: '无效的用户ID：' + user_id });
  }

  try {
    // 获取用户自己的推荐码
    const getUserCode = (uid) => {
      const row = db.prepare(
        'SELECT code FROM referral_codes WHERE referrer_id = ? LIMIT 1'
      ).get(uid);
      return row?.code || null;
    };

    // 根据推荐码获取用户ID
    const getUserIdByCode = (code) => {
      const row = db.prepare(
        'SELECT referrer_id FROM referral_codes WHERE code = ? LIMIT 1'
      ).get(code);
      return row?.referrer_id || null;
    };

    // 获取某推荐码的下线推荐码列表
    const getDownlineCodes = (referrerCode) => {
      return db.prepare(
        'SELECT * FROM referral_relationships WHERE referrer_code = ?'
      ).all(referrerCode);
    };

    // 递归构建树
    const buildTree = (uid, depth = 0) => {
      if (depth >= max_depth) return null;

      const userCode = getUserCode(uid);
      if (!userCode) return null;

      const relationships = getDownlineCodes(userCode);
      if (relationships.length === 0) return null;

      const children = [];
      for (const rel of relationships) {
        const referredUserId = getUserIdByCode(rel.referred_code);
        const childUser = referredUserId
          ? db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(referredUserId)
          : null;
        const child = {
          id: referredUserId || rel.id,
          name: childUser?.nickname || '用户' + (referredUserId || rel.id),
          role: childUser?.role || 'user',
          code: rel.referred_code,
          level: rel.level || depth + 1,
          total_commission: rel.total_commission || 0,
          settled_commission: rel.settled_commission || 0,
          children: null
        };

        if (depth < max_depth - 1) {
          child.children = buildTree(referredUserId, depth + 1);
        }

        children.push(child);
      }

      return children;
    };

    // 获取根用户信息
    const rootUser = db.prepare(
      'SELECT id, nickname, role FROM users WHERE id = ?'
    ).get(user_id);

    if (!rootUser) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    const rootCode = getUserCode(user_id);

    const tree = {
      id: rootUser.id,
      name: rootUser.nickname || '用户' + rootUser.id,
      role: rootUser.role || 'user',
      code: rootCode || '',
      level: 0,
      total_commission: 0,
      settled_commission: 0,
      children: buildTree(user_id, 0)
    };

    // 计算统计
    const stats = { total_members: 0, by_role: {}, total_commission: 0 };

    const countStats = (node) => {
      if (!node) return;
      stats.total_members++;
      stats.by_role[node.role] = (stats.by_role[node.role] || 0) + 1;
      stats.total_commission += node.total_commission || 0;
      if (node.children) {
        node.children.forEach(child => countStats(child));
      }
    };

    countStats(tree);

    res.json({ code: 0, data: { tree, stats } });

  } catch (err) {
    console.error('[referral-codes] 获取推荐关系树失败:', err);
    res.json({ code: 500, message: '查询失败：' + err.message });
  }
});

/**
 * 建立推荐关系（管理端）
 * POST /api/admin/referral-codes/bind
 */
router.post('/bind', (req, res) => {
  const db = req.db;
  const { referrer_code, referred_code, remark } = req.body;

  console.log('[referral-codes] 建立推荐关系请求:', { referrer_code, referred_code, remark });

  if (!referrer_code || !referred_code) {
    return res.json({ code: 400, message: '缺少必要参数：referrer_code 和 referred_code' });
  }

  if (referrer_code === referred_code) {
    return res.json({ code: 400, message: '推荐人和被推荐人推荐码不能相同' });
  }

  try {
    // 验证推荐人推荐码
    const referrer = db.prepare(
      "SELECT * FROM referral_codes WHERE code = ? AND status = 'active'"
    ).get(referrer_code.toUpperCase());

    if (!referrer) {
      return res.json({ code: 404, message: '推荐人推荐码不存在或已失效' });
    }

    // 验证被推荐人推荐码
    const referred = db.prepare(
      "SELECT * FROM referral_codes WHERE code = ? AND status = 'active'"
    ).get(referred_code.toUpperCase());

    if (!referred) {
      return res.json({ code: 404, message: '被推荐人推荐码不存在或已失效' });
    }

    // 检查关系是否已存在
    const existingRel = db.prepare(
      'SELECT id FROM referral_relationships WHERE referrer_code = ? AND referred_code = ?'
    ).get(referrer_code.toUpperCase(), referred_code.toUpperCase());

    if (existingRel) {
      return res.json({ code: 409, message: '推荐关系已存在' });
    }

    // 创建推荐关系
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO referral_relationships (referrer_code, referred_code, level, created_at, remark)
      VALUES (?, ?, 1, ?, ?)
    `).run(referrer_code.toUpperCase(), referred_code.toUpperCase(), timestamp, remark || null);

    // 同步写入 user_referrals（将代码级关系翻译为用户级关系）
    if (referrer.referrer_id && referred.referrer_id) {
      try {
        const existingUr = db.prepare(
          'SELECT id FROM user_referrals WHERE user_id = ?'
        ).get(referred.referrer_id);

        if (!existingUr) {
          db.prepare(`
            INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
            VALUES (?, ?, ?, datetime('now'), 1)
          `).run(referred.referrer_id, referrer.referrer_id, referred_code.toUpperCase());

          db.prepare(
            'UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)'
          ).run(referrer.referrer_id, referred.referrer_id);
        }
      } catch (e) {
        if (e.message && e.message.includes('no such table')) {
          try {
            db.exec(`
              CREATE TABLE IF NOT EXISTS user_referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                referrer_id INTEGER NOT NULL,
                referral_code TEXT,
                bind_time TEXT,
                is_locked INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id)
              )
            `);
            db.prepare(`
              INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
              VALUES (?, ?, ?, datetime('now'), 1)
            `).run(referred.referrer_id, referrer.referrer_id, referred_code.toUpperCase());
            db.prepare(
              'UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)'
            ).run(referrer.referrer_id, referred.referrer_id);
          } catch (e2) {
            console.warn('[referral-codes] 同步 user_referrals 失败:', e2.message);
          }
        } else {
          console.warn('[referral-codes] 同步 user_referrals 失败:', e.message);
        }
      }
    }

    console.log('[referral-codes] 推荐关系建立成功:', { referrer_code, referred_code });

    res.json({
      code: 0,
      data: {
        referrer_code: referrer_code.toUpperCase(),
        referred_code: referred_code.toUpperCase(),
        message: '推荐关系建立成功'
      }
    });

  } catch (err) {
    console.error('[referral-codes] 建立推荐关系失败:', err);
    res.json({ code: 500, message: '建立推荐关系失败：' + err.message });
  }
});

/**
 * 推荐码绑定用户（管理端）
 * POST /api/admin/referral-codes/bind-code-to-user
 */
router.post('/bind-code-to-user', (req, res) => {
  const db = req.db;
  const { code, user_id } = req.body;

  console.log('[referral-codes] 推荐码绑定用户请求:', { code, user_id });

  if (!code || !user_id) {
    return res.json({ code: 400, message: '缺少必要参数：code 和 user_id' });
  }

  try {
    // 验证推荐码是否存在
    const referralCode = db.prepare(
      'SELECT * FROM referral_codes WHERE code = ?'
    ).get(code.toUpperCase());

    if (!referralCode) {
      return res.json({ code: 404, message: '推荐码不存在' });
    }

    // 验证用户是否存在
    const user = db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(user_id);

    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    // 检查用户是否已有推荐码
    if (user.referral_code) {
      return res.json({ code: 409, message: '用户已有推荐码：' + user.referral_code });
    }

    // 更新推荐码的 referrer_id
    db.prepare('UPDATE referral_codes SET referrer_id = ? WHERE code = ?').run(user_id, code.toUpperCase());

    // 更新用户的 referral_code
    db.prepare('UPDATE users SET referral_code = ?, referral_level = 1 WHERE id = ?').run(code.toUpperCase(), user_id);

    console.log('[referral-codes] 推荐码绑定用户成功:', { code, user_id, nickname: user.nickname });

    res.json({
      code: 0,
      data: {
        code: code.toUpperCase(),
        user_id: user_id,
        user_name: user.nickname || '用户' + user_id,
        message: '推荐码绑定用户成功'
      }
    });

  } catch (err) {
    console.error('[referral-codes] 推荐码绑定用户失败:', err);
    res.json({ code: 500, message: '绑定失败：' + err.message });
  }
});

/**
 * 分配推荐码（支持用户ID或微信号）
 * POST /api/admin/referral-codes/assign
 * 参数：code + (user_id 或 wechat_account)
 */
router.post('/assign', (req, res) => {
  const db = req.db;
  const { code, user_id, wechat_account } = req.body;

  console.log('[referral-codes] 分配推荐码请求:', { code, user_id, wechat_account });

  if (!code) {
    return res.json({ code: 400, message: '缺少推荐码' });
  }

  if (!user_id && !wechat_account) {
    return res.json({ code: 400, message: '请提供用户ID或微信号' });
  }

  try {
    // 1. 验证推荐码是否存在
    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code.toUpperCase());
    if (!referralCode) {
      return res.json({ code: 404, message: '推荐码不存在' });
    }

    // 2. 查找用户
    let user;
    if (user_id) {
      // 按用户ID查找
      user = db.prepare('SELECT id, nickname, phone, openid FROM users WHERE id = ?').get(parseInt(user_id));
      if (!user) {
        return res.json({ code: 404, message: '用户不存在，ID: ' + user_id });
      }
    } else if (wechat_account) {
      // 按微信号查找（支持 openid、手机号、昵称）
      user = db.prepare('SELECT id, nickname, phone, openid FROM users WHERE openid = ? OR phone = ? OR nickname LIKE ? LIMIT 1').get(wechat_account, wechat_account, `%${wechat_account}%`);
      if (!user) {
        return res.json({ code: 404, message: '未找到用户，微信号: ' + wechat_account });
      }
    }

    // 3. 检查用户是否已有推荐码
    if (user.referral_code) {
      return res.json({ code: 409, message: `用户已有推荐码: ${user.referral_code}，请先解绑` });
    }

    // 4. 绑定推荐码到用户
    db.prepare('UPDATE referral_codes SET referrer_id = ? WHERE code = ?').run(user.id, code.toUpperCase());
    db.prepare('UPDATE users SET referral_code = ?, referral_level = 1 WHERE id = ?').run(code.toUpperCase(), user.id);

    console.log('[referral-codes] 推荐码分配成功:', { code, user_id: user.id, nickname: user.nickname });

    res.json({
      code: 0,
      data: {
        code: code.toUpperCase(),
        user_id: user.id,
        user_name: user.nickname || '用户' + user.id,
        wechat_account: wechat_account || user.phone || user.openid,
        message: '推荐码分配成功'
      }
    });

  } catch (err) {
    console.error('[referral-codes] 分配推荐码失败:', err);
    res.json({ code: 500, message: '分配失败：' + err.message });
  }
});

/**
 * 导出推荐码（CSV格式）
 * GET /api/admin/referral-codes/export
 */
router.get('/export', (req, res) => {
  const db = req.db;

  try {
    const codes = db.prepare(`
      SELECT rc.code, rc.code_type, rc.status, rc.use_count, rc.max_uses,
             rc.expires_at, u.nickname as referrer_name, rc.created_at
      FROM referral_codes rc
      LEFT JOIN users u ON u.id = rc.referrer_id
      WHERE rc.status != 'deleted'
      ORDER BY rc.created_at DESC
    `).all();

    // 生成CSV
    let csv = '推荐码,类型,状态,使用次数,最大使用次数,过期时间,推荐人,创建时间\n';
    const typeMap = {
      'public_welfare': '公益推荐官',
      'creator': '创作者推荐官',
      'professional': '专业推荐官',
      'community_station': '社区站长',
      'city_partner': '城市合伙人'
    };
    const statusMap = {
      'active': '激活',
      'inactive': '未激活',
      'expired': '已过期',
      'deleted': '已删除'
    };

    for (const c of codes) {
      const typeName = typeMap[c.code_type] || c.code_type;
      const statusName = statusMap[c.status] || c.status;
      csv += `${c.code},${typeName},${statusName},${c.use_count},${c.max_uses},${c.expires_at || '永久'},${c.referrer_name || ''},${c.created_at}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=referral-codes.csv');
    res.send('\uFEFF' + csv); // BOM for Excel

  } catch (err) {
    console.error('[referral-codes] 导出推荐码失败:', err);
    res.json({ code: 500, message: '导出失败：' + err.message });
  }
});

/**
 * 解绑推荐码
 * POST /api/admin/referral-codes/unbind
 */
router.post('/unbind', (req, res) => {
  const db = req.db;
  const { code } = req.body;

  if (!code) {
    return res.json({ code: 400, message: '缺少推荐码' });
  }

  try {
    const existing = db.prepare('SELECT id, referrer_id, status FROM referral_codes WHERE code = ?').get(code.toUpperCase());

    if (!existing) {
      return res.json({ code: 404, message: '推荐码不存在' });
    }

    if (!existing.referrer_id) {
      return res.json({ code: 400, message: '该推荐码未绑定用户' });
    }

    const userId = existing.referrer_id;

    // 解绑：清除 referrer_id，更新用户表的 referral_code
    db.prepare('UPDATE referral_codes SET referrer_id = NULL WHERE code = ?').run(code.toUpperCase());
    db.prepare('UPDATE users SET referral_code = NULL WHERE id = ?').run(userId);

    console.log('[referral-codes] 推荐码解绑成功:', { code, userId });

    res.json({ code: 0, data: { code }, message: '解绑成功' });

  } catch (err) {
    console.error('[referral-codes] 解绑推荐码失败:', err);
    res.json({ code: 500, message: '解绑失败：' + err.message });
  }
});

/**
 * 查看推荐码详情/洞察
 * GET /api/admin/referral-codes/insight/:code
 */
router.get('/insight/:code', (req, res) => {
  const db = req.db;
  const { code } = req.params;

  try {
    const codeRecord = db.prepare(`
      SELECT rc.*, u.nickname as referrer_name, u.role as referrer_role,
             u.phone as referrer_phone, u.wechat_account as referrer_wechat
      FROM referral_codes rc
      LEFT JOIN users u ON u.id = rc.referrer_id
      WHERE rc.code = ?
    `).get(code.toUpperCase());

    if (!codeRecord) {
      return res.json({ code: 404, message: '推荐码不存在' });
    }

    // 使用记录
    const usageRecords = db.prepare(`
      SELECT rul.*, u.nickname as user_name, u.role as user_role
      FROM referral_usage_logs rul
      LEFT JOIN users u ON u.id = rul.user_id
      WHERE rul.code = ?
      ORDER BY rul.created_at DESC
      LIMIT 50
    `).all(code.toUpperCase());

    // 推荐关系
    const relationships = db.prepare(`
      SELECT rr.*, u.nickname as referred_name, u.role as referred_role
      FROM referral_relationships rr
      LEFT JOIN users u ON u.id = (SELECT referrer_id FROM referral_codes WHERE code = rr.referred_code)
      WHERE rr.referrer_code = ?
      LIMIT 50
    `).all(code.toUpperCase());

    res.json({
      code: 0,
      data: {
        code: codeRecord,
        usage_records: usageRecords,
        relationships: relationships,
        stats: {
          total_usage: codeRecord.use_count || 0,
          max_uses: codeRecord.max_uses || 0,
          remaining: (codeRecord.max_uses || 0) - (codeRecord.use_count || 0)
        }
      }
    });

  } catch (err) {
    console.error('[referral-codes] 查询推荐码详情失败:', err);
    res.json({ code: 500, message: '查询失败：' + err.message });
  }
});

module.exports = router;
