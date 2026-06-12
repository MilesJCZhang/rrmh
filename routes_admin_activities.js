/**
 * routes_admin_activities.js - 管理后台-沙龙活动管理路由
 *
 * GET  /v1/admin/activities             - 活动列表（分页+状态筛选）
 * PUT  /v1/salon/:id/approve            - 已有路由（在 routes_salon.js 中）
 */
const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAuth, requireAdmin);

/**
 * GET /v1/admin/activities
 * 查询沙龙活动列表（管理后台用）
 * Query: page, limit, status, keyword, type
 */
router.get('/', (req, res) => {
  try {
    const db = req.app.get('db');
    const { page = 1, limit = 10, status, keyword, type } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    // 状态筛选
    if (status && status !== 'all') {
      conditions.push('s.status = ?');
      params.push(status);
    }

    // 关键字搜索（标题/主办方昵称）
    if (keyword) {
      conditions.push('(s.title LIKE ? OR u.nickname LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 沙龙类型筛选
    if (type) {
      conditions.push('s.type = ? OR s.week_salon_type = ?');
      params.push(type, type);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `
      SELECT COUNT(*) as total
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      ${where}
    `;
    const { total } = db.prepare(countSql).get(...params);

    const listSql = `
      SELECT
        s.id,
        s.title,
        s.description,
        s.type,
        s.score_tier,
        s.is_grouped,
        s.location,
        s.city,
        s.event_date,
        s.start_time,
        s.end_time,
        s.max_participants,
        s.male_count,
        s.female_count,
        s.max_per_gender,
        s.max_recommenders,
        s.max_companions_per_person,
        s.total_cap,
        s.registration_fee,
        s.status,
        s.week_salon_type,
        s.week_day,
        s.poster_url,
        s.reject_reason,
        s.created_at,
        s.updated_at,
        u.nickname as organizer_name,
        u.id as organizer_id
      FROM salons s
      LEFT JOIN users u ON s.organizer_id = u.id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(Number(limit), offset);
    const list = db.prepare(listSql).all(...params);

    res.json({
      code: 0,
      data: { list, total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error('[admin-activities] list error:', err);
    res.status(500).json({ code: -1, message: '获取活动列表失败' });
  }
});

module.exports = router;
