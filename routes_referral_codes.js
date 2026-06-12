/**
 * routes/referral-codes.js - 推荐码管理API路由
 */

const express = require('express');
const router = express.Router();

// 数据库使用 app.get('db') 共享连接，通过中间件获取
function getDb(req) {
  return req.app.get('db');
}

// JWT 中间件（从 routes_commission.js 复制）
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[routes_referral_codes] FATAL: JWT_SECRET 环境变量必须设置');
  process.exit(1);
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ code: -1, message: '未登录' });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ code: -1, message: '登录已过期' });
  }
}

// 管理员权限中间件
function adminMiddleware(req, res, next) {
  const db = getDb(req);
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!user || (user.role !== 'admin' && req.userId !== 1)) {
    return res.status(403).json({ code: -1, message: '无权限' });
  }
  next();
}

/**
 * GET /api/referral-codes/list
 * 获取推荐码列表
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { type, status } = req.query;

    let sql = 'SELECT * FROM referral_codes WHERE 1=1';
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND code_type = ?';
      params.push(type);
    }

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const codes = db.prepare(sql).all(...params);

    // 转换字段名以匹配前端
    const formattedCodes = codes.map(c => ({
      code: c.code,
      code_type: c.code_type,
      type_name: c.code_type === 'creator' ? '联创推荐官' : '公益推荐官',
      status: c.status,
      use_count: c.use_count,
      max_uses: c.max_uses,
      created_at: c.created_at,
      expires_at: c.expires_at,
    }));

    res.json({
      code: 0,
      data: formattedCodes,
    });
  } catch (error) {
    console.error('[API] 获取推荐码列表失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * POST /api/referral-codes/generate
 * 批量生成推荐码
 */
router.post('/generate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { type, count } = req.body;

    if (!type || !['creator', 'public_welfare'].includes(type)) {
      return res.status(400).json({ code: -1, message: '类型无效' });
    }

    const countNum = parseInt(count) || 10;
    if (countNum < 1 || countNum > 100) {
      return res.status(400).json({ code: -1, message: '数量必须在1-100之间' });
    }

    const generatedCodes = [];
    const batchId = `batch_${Date.now()}`;
    const prefix = type === 'creator' ? 'LCRG' : 'GYRG';

    for (let i = 0; i < countNum; i++) {
      let code;
      let isUnique = false;

      // 生成唯一推荐码
      while (!isUnique) {
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `${prefix}${random}`;

        const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
        if (!existing) isUnique = true;
      }

      try {
        db.prepare(`
          INSERT INTO referral_codes (code, code_type, status, batch_id, created_by)
          VALUES (?, ?, 'active', ?, ?)
        `).run(code, type, batchId, req.userId);

        generatedCodes.push(code);
      } catch (err) {
        // 忽略重复
      }
    }

    res.json({
      code: 0,
      message: `成功生成 ${generatedCodes.length} 个推荐码`,
      data: {
        batch_id: batchId,
        codes: generatedCodes,
      },
    });
  } catch (error) {
    console.error('[API] 批量生成推荐码失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * POST /api/referral-codes/manual-create
 * 手动创建推荐码
 */
router.post('/manual-create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { code, type, max_uses, expire_date } = req.body;

    // 验证类型
    if (!type || !['creator', 'public_welfare'].includes(type)) {
      return res.status(400).json({ code: -1, message: '类型无效' });
    }

    // 如果提供了自定义code，检查唯一性
    let finalCode = code;
    if (finalCode) {
      if (!/^[A-Za-z0-9]+$/.test(finalCode)) {
        return res.status(400).json({ code: -1, message: '推荐码只能包含字母和数字' });
      }

      const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(finalCode);
      if (existing) {
        return res.status(400).json({ code: -1, message: '推荐码已存在' });
      }
    } else {
      // 自动生成
      const prefix = type === 'creator' ? 'LCRG' : 'GYRG';
      let isUnique = false;
      while (!isUnique) {
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        finalCode = `${prefix}${random}`;
        const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(finalCode);
        if (!existing) isUnique = true;
      }
    }

    // 插入数据库
    const maxUsesNum = parseInt(max_uses) || 0;
    const stmt = db.prepare(`
      INSERT INTO referral_codes (code, code_type, max_uses, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      finalCode,
      type,
      maxUsesNum,
      expire_date || null,
      req.userId
    );

    res.json({
      code: 0,
      message: '创建成功',
      data: {
        code: finalCode,
      },
    });
  } catch (error) {
    console.error('[API] 手动创建推荐码失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * POST /api/referral-codes/bind
 * 建立推荐关系
 * 新格式：{ referrer_code, referred_code, remark } — 两个推荐码互绑
 * 旧格式：{ code, user_id, remark } — 推荐码绑定到用户（向后兼容）
 */
router.post('/bind', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { referrer_code, referred_code, remark, code, user_id } = req.body;

    // ========== 新格式：两个推荐码互绑 ==========
    if (referrer_code && referred_code) {
      if (referrer_code === referred_code) {
        return res.status(400).json({ code: -1, message: '推荐人和被推荐人推荐码不能相同' });
      }

      // 1. 验证推荐人推荐码
      const referrerCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(referrer_code);
      if (!referrerCode) {
        return res.status(404).json({ code: -1, message: '推荐人推荐码不存在' });
      }

      // 2. 验证被推荐人推荐码
      const referredCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(referred_code);
      if (!referredCode) {
        return res.status(404).json({ code: -1, message: '被推荐人推荐码不存在' });
      }

      // 3. 检查被推荐人推荐码是否已被绑定
      if (referredCode.referred_by_code) {
        return res.status(400).json({ code: -1, message: '该推荐码已有推荐人' });
      }

      // 4. 建立推荐关系：设置 referred_by_code
      db.prepare('UPDATE referral_codes SET referred_by_code = ?, remark = ? WHERE code = ?')
        .run(referrer_code, remark || null, referred_code);

      // 5. 记录推荐关系日志（若表存在）
      try {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS referral_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_code TEXT NOT NULL,
            referred_code TEXT NOT NULL,
            remark TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        db.prepare(`
          INSERT INTO referral_relationships (referrer_code, referred_code, remark)
          VALUES (?, ?, ?)
        `).run(referrer_code, referred_code, remark || null);
      } catch (e) {
        // 忽略
      }

      return res.json({
        code: 0,
        message: '推荐关系绑定成功',
        data: {
          referrer_code,
          referred_code,
        },
      });
    }

    // ========== 旧格式：推荐码绑定到用户（向后兼容） ==========
    if (code && user_id) {
      // 1. 验证推荐码
      const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
      if (!referralCode) {
        return res.status(404).json({ code: -1, message: '推荐码不存在' });
      }

      if (referralCode.status !== 'active') {
        return res.status(400).json({ code: -1, message: '推荐码已失效' });
      }

      if (referralCode.max_uses > 0 && referralCode.use_count >= referralCode.max_uses) {
        return res.status(400).json({ code: -1, message: '推荐码已达到最大使用次数' });
      }

      // 2. 验证用户是否存在
      const user = db.prepare('SELECT id, referrer_id FROM users WHERE id = ?').get(user_id);
      if (!user) {
        return res.status(404).json({ code: -1, message: '用户不存在' });
      }

      // 3. 检查用户是否已有推荐人
      if (user.referrer_id) {
        return res.status(400).json({ code: -1, message: '该用户已有推荐人' });
      }

      // 4. 获取推荐人ID（从推荐码关联的推荐官）
      const referrerId = referralCode.referrer_id;
      if (!referrerId) {
        return res.status(400).json({ code: -1, message: '该推荐码未关联推荐官' });
      }

      // 5. 建立推荐关系（事务）
      const transaction = db.transaction(() => {
        // 更新用户表
        db.prepare('UPDATE users SET referrer_id = ? WHERE id = ?').run(referrerId, user_id);

        // 更新推荐码使用次数
        db.prepare('UPDATE referral_codes SET use_count = use_count + 1, last_bound_user_id = ?, last_bound_at = datetime("now") WHERE code = ?')
          .run(user_id, code);

        // 记录推荐关系（如果有 user_referrals 表）
        try {
          db.prepare(`
            INSERT INTO user_referrals (referrer_id, referee_id, referral_code, status)
            VALUES (?, ?, ?, 'pending')
          `).run(referrerId, user_id, code);
        } catch (e) {
          // 表可能不存在，忽略
        }
      });

      transaction();

      return res.json({
        code: 0,
        message: '推荐关系建立成功',
        data: {
          code,
          user_id,
          referrer_id: referrerId,
        },
      });
    }

    // 参数不完整
    return res.status(400).json({ code: -1, message: '参数不完整，需要提供 referrer_code+referred_code 或 code+user_id' });
  } catch (error) {
    console.error('[API] 建立推荐关系失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * GET /api/referral-codes/export
 * 导出推荐码
 */
router.get('/export', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { format = 'json' } = req.query;

    const codes = db.prepare('SELECT * FROM referral_codes ORDER BY created_at DESC').all();

    if (format === 'csv') {
      // CSV格式
      let csv = '推荐码,类型,状态,使用次数,最大使用次数,创建时间\n';
      codes.forEach(c => {
        const typeName = c.code_type === 'creator' ? '联创推荐官' : '公益推荐官';
        const statusName = c.status === 'active' ? '有效' : c.status === 'depleted' ? '已用完' : '已停用';
        csv += `${c.code},${typeName},${statusName},${c.use_count},${c.max_uses || '无限'},${c.created_at}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="referral_codes.csv"');
      res.send(csv);
    } else {
      // JSON格式
      res.json({
        code: 0,
        data: codes,
      });
    }
  } catch (error) {
    console.error('[API] 导出推荐码失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * POST /api/referral-codes/delete
 * 删除推荐码
 */
router.post('/delete', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ code: -1, message: '推荐码不能为空' });
    }

    const existing = db.prepare('SELECT id, code_type FROM referral_codes WHERE code = ?').get(code);
    if (!existing) {
      return res.status(404).json({ code: -1, message: '推荐码不存在' });
    }

    // 检查是否已被使用（有关联的推荐关系）
    if (existing.code_type) {
      const inUse = db.prepare('SELECT id FROM referral_codes WHERE referred_by_code = ?').get(code);
      if (inUse) {
        return res.status(400).json({ code: -1, message: '该推荐码已被用于推荐关系，无法删除' });
      }
    }

    db.prepare('DELETE FROM referral_codes WHERE code = ?').run(code);

    res.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('[API] 删除推荐码失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

/**
 * POST /api/referral-codes/bind-code-to-user
 * 将推荐码绑定到用户（分配推荐码给推荐官）
 */
router.post('/bind-code-to-user', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = getDb(req);
    const { code, user_id } = req.body;

    if (!code || !user_id) {
      return res.status(400).json({ code: -1, message: '推荐码和用户ID不能为空' });
    }

    // 1. 验证推荐码
    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
    if (!referralCode) {
      return res.status(404).json({ code: -1, message: '推荐码不存在' });
    }

    // 2. 验证用户
    const user = db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // 3. 绑定：更新推荐码的 referrer_id 和 referrer_name
    db.prepare('UPDATE referral_codes SET referrer_id = ?, referrer_name = ? WHERE code = ?')
      .run(user_id, user.nickname || user.role || '推荐官', code);

    res.json({
      code: 0,
      message: '绑定成功',
      data: {
        code,
        user_id,
        type_name: referralCode.code_type === 'creator' ? '联创推荐官' : '公益推荐官',
      },
    });
  } catch (error) {
    console.error('[API] 绑定推荐码到用户失败:', error);
    res.status(500).json({ code: -1, message: '服务器错误' });
  }
});

module.exports = router;
