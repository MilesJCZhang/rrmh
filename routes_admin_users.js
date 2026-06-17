/**
 * routes_admin_users.js - 管理后台用户管理 API
 * 管理员专用：用户列表、详情、状态管理
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAuth, requireAdmin);

/**
 * GET /v1/admin/users
 * 用户列表（支持分页、关键词搜索、状态筛选）
 */
router.get('/users', (req, res) => {
  const db = req.app.get('db');
  const { page = 1, limit = 20, keyword, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = [];
    let params = [];

    if (keyword) {
      where.push('(nickname LIKE ? OR phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status !== undefined && status !== '') {
      where.push('status = ?');
      params.push(parseInt(status));
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params)?.count || 0;

    const list = db.prepare(`
      SELECT id, nickname, avatar_url, phone, gender, birthday, height, education,
             occupation, income, location, status, profile_score, score_tier,
             face_auth_status, asset_verified_status, role, referral_code, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      code: 0,
      data: {
        list,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取用户列表失败', error: err.message });
  }
});

/**
 * GET /v1/admin/users/:id
 * 用户详情
 */
router.get('/users/:id', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;

  try {
    const user = db.prepare(`
      SELECT id, nickname, avatar_url, phone, gender, birthday, height, education,
             occupation, income, location, status, profile_score, score_tier,
             face_auth_status, asset_verified_status, role, referral_code, created_at,
             wechat_account, marital_status, intro,
             has_property, has_car, smoking, drinking,
             sleep_habit, sport_habit, diet_tags, health_tags,
             expect_age_min, expect_age_max, expect_education, expect_income, marriage_expect
      FROM users
      WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    res.json({ code: 0, data: user });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取用户详情失败', error: err.message });
  }
});

/**
 * PUT /v1/admin/users/:id/status
 * 更新用户状态
 */
router.put('/users/:id/status', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { status } = req.body;

  if (status === undefined || status === null) {
    return res.status(400).json({ code: -1, message: 'status 参数缺失' });
  }

  try {
    const result = db.prepare('UPDATE users SET status = ?, updated_at = datetime("now") WHERE id = ?').run(parseInt(status), id);

    if (result.changes === 0) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    res.json({ code: 0, message: '状态更新成功' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '状态更新失败', error: err.message });
  }
});

module.exports = router;
