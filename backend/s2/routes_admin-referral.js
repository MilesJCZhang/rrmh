/**
 * routes_admin-referral.js - 管理员推荐码管理API（使用SQLite）
 * 
 * 功能清单：
 * 1. 批量生成推荐码 - 支持5种身份类型
 * 2. 手动创建推荐码 - 支持5种身份类型
 * 3. 建立推荐关系 - 通过推荐码手动绑定推荐关系
 * 4. 推荐码与用户ID绑定 - 用于初始推荐官身份注册
 * 
 * 身份类型：
 * - public_welfare: 公益推荐官 (前缀: GYRG)
 * - creator: 联创推荐官 (前缀: LCRG)
 * - professional: 专业推荐官 (前缀: ZYRG)
 * - community_station: 社区服务站 (前缀: SQZD)
 * - city_partner: 城市合伙人 (前缀: CSHH)
 */

const express = require('express');
const logger = require('../../utils/logger');

const router = express.Router();

// 数据库使用 app.get('db') 共享连接
function getDb(req) {
  return req.app.get('db');
}

// 身份类型配置
const ROLE_CONFIG = {
  public_welfare: { name: '公益推荐官', prefix: 'GYRG' },
  creator: { name: '联创推荐官', prefix: 'LCRG' },
  professional: { name: '专业推荐官', prefix: 'ZYRG' },
  community_station: { name: '社区服务站', prefix: 'SQZD' },
  city_partner: { name: '城市合伙人', prefix: 'CSHH' },
};

// 验证身份类型是否有效
function isValidRole(role) {
  return Object.keys(ROLE_CONFIG).includes(role);
}

// 生成唯一推荐码（需要传入 db 连接）
function generateUniqueCode(db, role) {
  const prefix = ROLE_CONFIG[role].prefix;
  let code;
  let isUnique = false;

  while (!isUnique) {
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    code = `${prefix}${random}`;

    const existing = db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code);
    if (!existing) isUnique = true;
  }

  return code;
}

/**
 * 验证推荐码前缀是否与类型匹配
 * 防止手动创建时输入前缀与类型不匹配的推荐码
 */
function validateCodePrefix(code, role) {
  const config = ROLE_CONFIG[role];
  if (!config || !code) return false;
  return code.startsWith(config.prefix);
}

/**
 * GET /api/admin/referral-codes/list
 * 获取推荐码列表
 */
router.get('/list', (req, res) => {
  try {
    const db = getDb(req);
    const { type, status } = req.query;

    let sql = `SELECT 
        id, code, code_type, referrer_id, referrer_name,
        status, use_count, max_uses, expires_at,
        created_at, updated_at, created_by
      FROM referral_codes
      WHERE 1=1`;
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

    // 格式化返回数据
    const formattedCodes = codes.map(c => ({
      id: c.id,
      code: c.code,
      code_type: c.code_type,
      type_name: ROLE_CONFIG[c.code_type]?.name || c.code_type,
      status: c.status,
      use_count: c.use_count,
      max_uses: c.max_uses,
      created_at: c.created_at,
      expires_at: c.expires_at,
      referrer_id: c.referrer_id,
      referrer_name: c.referrer_name,
      created_by: c.created_by,
    }));

    res.json({
      code: 0,
      data: formattedCodes,
    });

  } catch (err) {
    logger.error('[Admin] List referral codes error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * POST /api/admin/referral-codes/generate
 * 功能1: 批量生成推荐码
 * 支持5种身份类型：公益推荐官、联创推荐官、专业推荐官、社区服务站、城市合伙人
 */
router.post('/generate', (req, res) => {
  try {
    const db = getDb(req);
    const { type, count } = req.body;

    // 验证身份类型
    if (!type || !isValidRole(type)) {
      return res.status(400).json({ 
        code: -1, 
        message: `类型无效，必须是以下之一: ${Object.keys(ROLE_CONFIG).join(', ')}` 
      });
    }

    const countNum = parseInt(count) || 10;
    if (countNum < 1 || countNum > 100) {
      return res.status(400).json({ code: -1, message: '数量必须在1-100之间' });
    }

    const generatedCodes = [];
    const batchId = `batch_${Date.now()}`;

    for (let i = 0; i < countNum; i++) {
      const code = generateUniqueCode(db, type);

      try {
        db.prepare(`
          INSERT INTO referral_codes (code, code_type, status, batch_id, created_by)
          VALUES (?, ?, 'active', ?, ?)
        `).run(code, type, batchId, 1); // created_by 默认为1（管理员）

        generatedCodes.push(code);
      } catch (err) {
        // 忽略重复
        logger.error('Insert error:', err.message);
      }
    }

    res.json({
      code: 0,
      message: `成功生成 ${generatedCodes.length} 个${ROLE_CONFIG[type].name}推荐码`,
      data: {
        batch_id: batchId,
        type: type,
        type_name: ROLE_CONFIG[type].name,
        codes: generatedCodes,
      },
    });

  } catch (err) {
    logger.error('[Admin] Generate referral codes error:', err);
    res.status(500).json({ code: -1, message: '生成失败' });
  }
});

/**
 * POST /api/admin/referral-codes/manual-create
 * 功能2: 手动创建推荐码
 * 支持5种身份类型，可自定义推荐码、设置使用次数和过期时间
 */
router.post('/manual-create', (req, res) => {
  try {
    const db = getDb(req);
    const { code, type, max_uses, expire_date } = req.body;

    // 验证身份类型
    if (!type || !isValidRole(type)) {
      return res.status(400).json({ 
        code: -1, 
        message: `类型无效，必须是以下之一: ${Object.keys(ROLE_CONFIG).join(', ')}` 
      });
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

      // 校验前缀与类型是否匹配，防止手动输入错误
      if (!validateCodePrefix(finalCode, type)) {
        return res.status(400).json({
          code: -1,
          message: `推荐码前缀与类型不匹配: ${finalCode} 应以 ${ROLE_CONFIG[type].prefix} 开头`,
        });
      }
    } else {
      // 自动生成
      finalCode = generateUniqueCode(db, type);
    }

    // 插入数据库
    const maxUsesNum = parseInt(max_uses) || 0;

    db.prepare(`
      INSERT INTO referral_codes (code, code_type, max_uses, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(finalCode, type, maxUsesNum, expire_date || null, 1);

    res.json({
      code: 0,
      message: '创建成功',
      data: {
        code: finalCode,
        type: type,
        type_name: ROLE_CONFIG[type].name,
        max_uses: maxUsesNum,
        expires_at: expire_date || null,
      },
    });

  } catch (err) {
    logger.error('[Admin] Manual create referral code error:', err);
    res.status(500).json({ code: -1, message: '创建失败' });
  }
});

/**
 * POST /api/admin/referral-codes/bind
 * 功能3: 建立推荐关系（通过推荐码）
 * 手动输入推荐码，建立推荐人与被推荐人的关系，绑定后续收益权限
 */
router.post('/bind', (req, res) => {
  try {
    const db = getDb(req);
    const { referrer_code, referred_code, remark, code, user_id } = req.body;

    // ========== 新格式：两个推荐码互绑 ==========
    if (referrer_code && referred_code) {
      if (referrer_code === referred_code) {
        return res.status(400).json({ code: -1, message: '推荐人和被推荐人推荐码不能相同' });
      }

      // 0. 特殊处理：SYSTEM 表示系统生成的推荐官
      if (referrer_code.toUpperCase() === 'SYSTEM') {
        const referredCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(referred_code);
        if (!referredCode) {
          return res.status(404).json({ code: -1, message: '被推荐人推荐码不存在' });
        }
        if (referredCode.referred_by_code) {
          return res.status(400).json({ code: -1, message: '该推荐码已有推荐人' });
        }
        db.prepare("UPDATE referral_codes SET referred_by_code = 'SYSTEM', remark = ? WHERE code = ?")
          .run(remark || '系统生成', referred_code);
        return res.json({
          code: 0,
          message: '已标记为系统生成推荐官（无上级推荐人）',
          data: { referrer_code: 'SYSTEM', referred_code },
        });
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

      // 5. 记录推荐关系日志（若表不存在则自动创建）
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

      // 6. 同步写入 user_referrals（将代码级关系翻译为用户级关系）
      if (referrerCode.referrer_id && referredCode.referrer_id) {
        try {
          const existingUr = db.prepare(
            'SELECT id FROM user_referrals WHERE user_id = ?'
          ).get(referredCode.referrer_id);

          if (!existingUr) {
            db.prepare(`
              INSERT INTO user_referrals (user_id, referrer_id, referral_code, bind_time, is_locked)
              VALUES (?, ?, ?, datetime('now'), 1)
            `).run(referredCode.referrer_id, referrerCode.referrer_id, referred_code);

            db.prepare(
              'UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)'
            ).run(referrerCode.referrer_id, referredCode.referrer_id);
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
              `).run(referredCode.referrer_id, referrerCode.referrer_id, referred_code);
              db.prepare(
                'UPDATE users SET referrer_id = ? WHERE id = ? AND (referrer_id IS NULL OR referrer_id = 0)'
              ).run(referrerCode.referrer_id, referredCode.referrer_id);
            } catch (e2) {
              logger.warn('[Admin] 同步 user_referrals 失败:', e2.message);
            }
          } else {
            logger.warn('[Admin] 同步 user_referrals 失败:', e.message);
          }
        }
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
      if (!code || !user_id) {
        return res.status(400).json({ code: -1, message: '推荐码和用户ID不能为空' });
      }

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
      const user = db.prepare('SELECT id, referrer_id, nickname FROM users WHERE id = ?').get(user_id);

      if (!user) {
        return res.status(404).json({ code: -1, message: '用户不存在' });
      }

      // 3. 检查用户是否已有推荐人
      if (user.referrer_id) {
        return res.status(400).json({ code: -1, message: '该用户已有推荐人' });
      }

      // 4. 获取推荐人ID（从推荐码关联的推荐官）
      const referrerId = referralCode.referrer_id;
      
      // 如果推荐码没有关联推荐人，需要先绑定推荐人
      if (!referrerId) {
        return res.status(400).json({ 
          code: -1, 
          message: '该推荐码未关联推荐官，请先使用 /bind-code-to-user 接口绑定推荐官' 
        });
      }

      // 5. 验证推荐人是否存在
      const referrer = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(referrerId);
      if (!referrer) {
        return res.status(404).json({ code: -1, message: '推荐人不存在' });
      }

      // 6. 建立推荐关系（事务）
      const transaction = db.transaction(() => {
        // 更新用户表
        db.prepare('UPDATE users SET referrer_id = ? WHERE id = ?').run(referrerId, user_id);

        // 更新推荐码使用次数
        db.prepare(`UPDATE referral_codes 
           SET use_count = use_count + 1,
               last_used_at = datetime('now'),
               last_bound_user_id = ?,
               last_bound_at = datetime('now'),
               remark = ?
           WHERE code = ?`)
          .run(user_id, remark || null, code);

        // 记录推荐关系（如果有 user_referrals 表）
        try {
          db.prepare(`
            INSERT INTO user_referrals (referrer_id, referee_id, referral_code, status, remark)
            VALUES (?, ?, ?, 'active', ?)
          `).run(referrerId, user_id, code, remark || null);
        } catch (e) {
          // 表可能不存在，忽略
          logger.debug('user_referrals table not exists, skip');
        }
      });

      transaction();

      return res.json({
        code: 0,
        message: '推荐关系建立成功',
        data: {
          code: code,
          code_type: referralCode.code_type,
          type_name: ROLE_CONFIG[referralCode.code_type]?.name || referralCode.code_type,
          user_id: user_id,
          user_name: user.nickname,
          referrer_id: referrerId,
          referrer_name: referrer.nickname,
          remark: remark || null,
        },
      });
    }

    // 参数不完整
    return res.status(400).json({ code: -1, message: '参数不完整，需要提供 referrer_code+referred_code 或 code+user_id' });

  } catch (err) {
    logger.error('[Admin] Bind referral error:', err);
    res.status(500).json({ code: -1, message: '建立推荐关系失败' });
  }
});

/**
 * POST /api/admin/referral-codes/bind-code-to-user
 * 功能4: 推荐码与用户ID手动绑定
 * 实现最初推荐官身份与推荐码的注册
 */
router.post('/bind-code-to-user', (req, res) => {
  try {
    const db = getDb(req);
    const { code, user_id, remark } = req.body;

    if (!code || !user_id) {
      return res.status(400).json({ code: -1, message: '推荐码和用户ID不能为空' });
    }

    // 1. 验证推荐码是否存在
    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);

    if (!referralCode) {
      return res.status(404).json({ code: -1, message: '推荐码不存在' });
    }

    // 2. 验证用户是否存在
    const user = db.prepare('SELECT id, nickname, role FROM users WHERE id = ?').get(user_id);

    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    // 3. 检查推荐码是否已经绑定了用户
    if (referralCode.referrer_id) {
      return res.status(400).json({ 
        code: -1, 
        message: `该推荐码已绑定用户ID: ${referralCode.referrer_id}` 
      });
    }

    // 4. 绑定推荐码到用户（事务）
    const CODE_TYPE_ROLE_MAP = {
      public_welfare: 'public_matchmaker',
      creator: 'partner_matchmaker',
      professional: 'professional_recommender',
      community_station: 'community_station',
      city_partner: 'city_franchisee',
    };
    const transaction = db.transaction(() => {
      // 更新推荐码的 referrer_id 和 referrer_name
      db.prepare(`UPDATE referral_codes 
         SET referrer_id = ?,
             referrer_name = ?,
             updated_at = datetime('now')
         WHERE code = ?`)
        .run(user_id, user.nickname, code);

      // 自动更新 user.role，追加推荐官身份（不会覆盖已有角色）
      const newRole = CODE_TYPE_ROLE_MAP[referralCode.code_type];
      if (newRole) {
        const currentRoles = (user.role || '').split(',').map(r => r.trim());
        if (!currentRoles.includes(newRole)) {
          currentRoles.push(newRole);
          const roleStr = currentRoles.filter(r => r !== 'user').join(',');
          db.prepare('UPDATE users SET role = ? WHERE id = ?').run(roleStr, user_id);
        }
      }
    });

    transaction();

    res.json({
      code: 0,
      message: '推荐码与用户绑定成功',
      data: {
        code: code,
        code_type: referralCode.code_type,
        type_name: ROLE_CONFIG[referralCode.code_type]?.name || referralCode.code_type,
        user_id: user_id,
        user_name: user.nickname,
        user_role: user.role,
        remark: remark || null,
      },
    });

  } catch (err) {
    logger.error('[Admin] Bind code to user error:', err);
    res.status(500).json({ code: -1, message: '绑定失败' });
  }
});

/**
 * GET /api/admin/referral-codes/export
 * 导出推荐码（支持 JSON 和 CSV 格式）
 */
router.get('/export', (req, res) => {
  try {
    const db = getDb(req);
    const { format = 'json', type } = req.query;

    let sql = `
      SELECT 
        code, code_type, status, use_count, max_uses,
        created_at, expires_at, referrer_name, referrer_id,
        last_used_at, last_bound_user_id
       FROM referral_codes
       WHERE 1=1`;
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND code_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';

    const codes = db.prepare(sql).all(...params);

    if (format === 'csv') {
      // CSV格式
      let csv = '\uFEFF推荐码,类型,状态,使用次数,最大使用次数,创建时间,过期时间,推荐官姓名,推荐官ID,最后使用时间,最后绑定用户ID\n';

      codes.forEach(c => {
        const typeName = ROLE_CONFIG[c.code_type]?.name || c.code_type;
        const statusName = c.status === 'active' ? '有效' : c.status === 'depleted' ? '已用完' : '已停用';
        csv += `${c.code},${typeName},${statusName},${c.use_count},${c.max_uses || '无限'},${c.created_at || ''},${c.expires_at || ''},${c.referrer_name || ''},${c.referrer_id || ''},${c.last_used_at || ''},${c.last_bound_user_id || ''}\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="referral_codes.csv"');
      res.send(csv);
    } else {
      // JSON格式
      const formattedCodes = codes.map(c => ({
        ...c,
        type_name: ROLE_CONFIG[c.code_type]?.name || c.code_type,
      }));

      res.json({
        code: 0,
        data: formattedCodes,
      });
    }

  } catch (err) {
    logger.error('[Admin] Export referral codes error:', err);
    res.status(500).json({ code: -1, message: '导出失败' });
  }
});

/**
 * POST /api/admin/referral-codes/update-status
 * 更新推荐码状态（启用/停用）
 */
router.post('/update-status', (req, res) => {
  try {
    const db = getDb(req);
    const { code, status } = req.body;

    if (!code || !status) {
      return res.status(400).json({ code: -1, message: '推荐码和状态不能为空' });
    }

    if (!['active', 'inactive', 'depleted'].includes(status)) {
      return res.status(400).json({ code: -1, message: '状态无效' });
    }

    const result = db.prepare(`UPDATE referral_codes 
      SET status = ?, updated_at = datetime('now') 
      WHERE code = ?`).run(status, code);

    if (result.changes === 0) {
      return res.status(404).json({ code: -1, message: '推荐码不存在' });
    }

    res.json({
      code: 0,
      message: '状态更新成功',
      data: {
        code: code,
        status: status,
      },
    });

  } catch (err) {
    logger.error('[Admin] Update status error:', err);
    res.status(500).json({ code: -1, message: '更新失败' });
  }
});


/**
 * POST /api/admin/referral-codes/delete
 * 删除推荐码
 */
router.post('/delete', (req, res) => {
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

    // 检查是否已被用于推荐关系
    const inUse = db.prepare('SELECT id FROM referral_codes WHERE referred_by_code = ?').get(code);
    if (inUse) {
      return res.status(400).json({ code: -1, message: '该推荐码已被用于推荐关系，无法删除' });
    }

    db.prepare('DELETE FROM referral_codes WHERE code = ?').run(code);

    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    logger.error('[Admin] Delete referral code error:', err);
    res.status(500).json({ code: -1, message: '删除失败' });
  }
});


module.exports = router;

// ===================================================================
// 以下端点适配前端 referral-code.service.ts
//   assign  -> 绑定推荐码到用户
//   unbind  -> 解绑推荐码
//   insight -> 推荐码洞察统计
// ===================================================================

/**
 * POST /assign - 分配推荐码给用户（前端 assignCode 调用）
 * 请求体: { code, user_id, remark? }
 */
router.post('/assign', (req, res) => {
  try {
    const db = getDb(req);
    const { code, user_id, remark } = req.body;

    if (!code || !user_id) {
      return res.status(400).json({ code: -1, message: '推荐码和用户ID不能为空' });
    }

    // 1. 验证推荐码
    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
    if (!referralCode) return res.status(404).json({ code: -1, message: '推荐码不存在' });
    if (referralCode.status !== 'active') return res.status(400).json({ code: -1, message: '推荐码已失效' });
    if (referralCode.max_uses > 0 && referralCode.use_count >= referralCode.max_uses) {
      return res.status(400).json({ code: -1, message: '推荐码已达到最大使用次数' });
    }

    // 2. 验证用户
    const user = db.prepare('SELECT id, referrer_id, nickname FROM users WHERE id = ?').get(user_id);
    if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });
    if (user.referrer_id) return res.status(400).json({ code: -1, message: '该用户已有推荐人' });

    // 检查用户是否已有同类型推荐码
    const existingSameType = db.prepare(
      'SELECT id, code FROM referral_codes WHERE referrer_id = ? AND code_type = ?'
    ).get(user_id, referralCode.code_type);
    if (existingSameType) {
      return res.status(400).json({
        code: -1,
        message: `该用户已有同类型推荐码: ${existingSameType.code}，请先解绑`,
      });
    }

    // 3. 获取推荐人
    const referrerId = referralCode.referrer_id;
    if (!referrerId) {
      return res.status(400).json({ code: -1, message: '该推荐码未关联推荐官，请先绑定推荐官' });
    }

    const referrer = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(referrerId);
    if (!referrer) return res.status(404).json({ code: -1, message: '推荐人不存在' });

    // 4. 建立推荐关系
    const CODE_TYPE_ROLE_MAP = {
      public_welfare: 'public_matchmaker',
      creator: 'partner_matchmaker',
      professional: 'professional_recommender',
      community_station: 'community_station',
      city_partner: 'city_franchisee',
    };
    const transaction = db.transaction(() => {
      db.prepare('UPDATE users SET referrer_id = ? WHERE id = ?').run(referrerId, user_id);
      // 自动更新被推荐人的角色（追加，不覆盖）
      const newRole = CODE_TYPE_ROLE_MAP[referralCode.code_type];
      if (newRole) {
        const currentRoles = (user.role || '').split(',').map(r => r.trim());
        if (!currentRoles.includes(newRole)) {
          currentRoles.push(newRole);
          const roleStr = currentRoles.filter(r => r !== 'user').join(',');
          db.prepare('UPDATE users SET role = ? WHERE id = ?').run(roleStr, user_id);
        }
      }
      db.prepare(`UPDATE referral_codes SET use_count = use_count + 1, last_used_at = datetime('now'),
         last_bound_user_id = ?, last_bound_at = datetime('now'), remark = ? WHERE code = ?`)
        .run(user_id, remark || null, code);
      try {
        db.prepare(`INSERT INTO user_referrals (referrer_id, referee_id, referral_code, status, remark)
          VALUES (?, ?, ?, 'active', ?)`).run(referrerId, user_id, code, remark || null);
      } catch (e) { /* 表可能不存在 */ }
    });

    transaction();

    res.json({
      code: 0,
      message: '分配成功',
      data: {
        code, user_id,
        referrer_id: referrerId,
        referrer_name: referrer.nickname,
        user_name: user.nickname,
      },
    });
  } catch (err) {
    logger.error('[Admin] assign referral code error:', err);
    res.status(500).json({ code: -1, message: '分配失败' });
  }
});

/**
 * POST /unbind - 解绑推荐码
 * 请求体: { code }
 */
router.post('/unbind', (req, res) => {
  try {
    const db = getDb(req);
    const { code } = req.body;

    if (!code) return res.status(400).json({ code: -1, message: '推荐码不能为空' });

    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
    if (!referralCode) return res.status(404).json({ code: -1, message: '推荐码不存在' });

    // 找到使用了该推荐码的用户，清除推荐关系
    const boundUsers = db.prepare("SELECT id FROM users WHERE referrer_id = (SELECT referrer_id FROM referral_codes WHERE code = ?)").all(code);

    const transaction = db.transaction(() => {
      for (const u of boundUsers) {
        db.prepare('UPDATE users SET referrer_id = NULL WHERE id = ?').run(u.id);
      }
      db.prepare("UPDATE referral_codes SET referrer_id = NULL, referrer_name = NULL, updated_at = datetime('now') WHERE code = ?").run(code);
    });

    transaction();

    res.json({ code: 0, message: '解绑成功', data: { code, unbound_users: boundUsers.length } });
  } catch (err) {
    logger.error('[Admin] unbind referral code error:', err);
    res.status(500).json({ code: -1, message: '解绑失败' });
  }
});

/**
 * GET /insight/:code - 推荐码洞察统计
 */
router.get('/insight/:code', (req, res) => {
  try {
    const db = getDb(req);
    const { code } = req.params;

    const referralCode = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code);
    if (!referralCode) return res.status(404).json({ code: -1, message: '推荐码不存在' });

    // 构建前端期望的 code_info 格式
    const code_info = {
      code: referralCode.code,
      codeType: referralCode.code_type,
      type_name: ROLE_CONFIG[referralCode.code_type]?.name || referralCode.code_type,
      status: referralCode.status,
      useCount: referralCode.use_count || 0,
      maxUses: referralCode.max_uses || 0,
      expiresAt: referralCode.expires_at || null,
      created_at: referralCode.created_at,
    };

    // 构建上级推荐人信息
    let parentReferrer = null;
    if (referralCode.referred_by_code === 'SYSTEM') {
      parentReferrer = { nickname: '系统', wechatAccount: '-', role: 'system' };
    } else if (referralCode.referred_by_code) {
      const parentCode = db.prepare('SELECT referrer_id FROM referral_codes WHERE code = ?').get(referralCode.referred_by_code);
      if (parentCode?.referrer_id) {
        const parentUser = db.prepare('SELECT id, nickname, role, wechat_account FROM users WHERE id = ?').get(parentCode.referrer_id);
        if (parentUser) {
          parentReferrer = {
            nickname: parentUser.nickname,
            wechatAccount: parentUser.wechat_account || '-',
            role: parentUser.role,
          };
        }
      }
    } else if (referralCode.referrer_id) {
      // 兼容旧数据：直接查 users 表
      const parentUser = db.prepare('SELECT id, nickname, role, wechat_account FROM users WHERE id = ?').get(referralCode.referrer_id);
      if (parentUser) {
        parentReferrer = {
          nickname: parentUser.nickname,
          wechatAccount: parentUser.wechat_account || '-',
          role: parentUser.role,
        };
      }
    }
    code_info.referrer = parentReferrer;

    // 查询通过此推荐码绑定的用户（referred_users 格式）
    let referredUsers = [];
    try {
      const rawUsers = db.prepare(`
        SELECT id, nickname, phone, role, created_at
        FROM users WHERE referrer_id = ?
        ORDER BY created_at DESC
      `).all(referralCode.referrer_id || 0);
      referredUsers = rawUsers.map(u => ({
        id: u.id,
        nickname: u.nickname || '用户' + u.id,
        wechatAccount: u.phone || '',
        level: 1,
        status: 'active',
        created_at: u.created_at,
      }));
    } catch (e) {}

    // 查询使用记录（usage_logs 格式）
    let usageLogs = [];
    try {
      usageLogs = db.prepare(`
        SELECT rul.*, u.nickname as user_nickname
        FROM referral_usage_logs rul
        LEFT JOIN users u ON u.id = rul.user_id
        WHERE rul.code = ?
        ORDER BY rul.created_at DESC
        LIMIT 50
      `).all(code);
    } catch (e) {}

    // 如果 usage_logs 表不存在，尝试从 referral_relationships 表获取
    if (usageLogs.length === 0) {
      try {
        usageLogs = db.prepare(`
          SELECT rr.id, rr.referrer_code as code, rr.referred_code as referred_code,
                 rr.created_at, '(双码互绑)' as scene
          FROM referral_relationships rr
          WHERE rr.referrer_code = ? OR rr.referred_code = ?
          ORDER BY rr.created_at DESC
          LIMIT 50
        `).all(code, code);
      } catch (e) {}
    }

    // 角色统计
    const roleStats = {};
    let totalCommission = 0, pendingCommission = 0;
    for (const u of referredUsers) {
      const role = u.role || 'user';
      roleStats[role] = (roleStats[role] || 0) + 1;
    }
    // 佣金统计
    try {
      const comm = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total,
               COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending
        FROM commissions WHERE recipient_id = ?
      `).get(referralCode.referrer_id || 0);
      if (comm) {
        totalCommission = parseFloat(comm.total || 0);
        pendingCommission = parseFloat(comm.pending || 0);
      }
    } catch (e) {}

    // 返回前端期望的格式
    res.json({
      code: 0,
      data: {
        code_info,
        referred_users: referredUsers,
        usage_logs: usageLogs,
        stats: {
          total_users: referredUsers.length,
          by_role: roleStats,
          total_commission: totalCommission,
          pending_commission: pendingCommission,
          total_usage: referralCode.use_count || 0,
          max_uses: referralCode.max_uses || 0,
        },
      },
    });
  } catch (err) {
    logger.error('[Admin] insight error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});
