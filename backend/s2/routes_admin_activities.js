/**
 * routes_admin_activities.js - 管理后台-沙龙活动管理路由
 *
 * GET  /v1/admin/activities             - 活动列表（分页+状态筛选）
 * PUT  /v1/admin/activities/:id/approve - 活动审核（管理后台路径）
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

    if (status && status !== 'all') {
      conditions.push('s.status = ?');
      params.push(status);
    }
    if (keyword) {
      conditions.push('(s.title LIKE ? OR u.nickname LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (type) {
      conditions.push('(s.type = ? OR s.week_salon_type = ?)');
      params.push(type, type);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const { total } = db.prepare(`
      SELECT COUNT(*) as total FROM salons s LEFT JOIN users u ON s.organizer_id = u.id ${where}
    `).get(...params);

    params.push(Number(limit), offset);
    const list = db.prepare(`
      SELECT s.*, u.nickname as organizer_name, u.id as organizer_id
      FROM salons s LEFT JOIN users u ON s.organizer_id = u.id ${where}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `).all(...params);

    res.json({ code: 0, data: { list, total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    console.error('[admin-activities] list error:', err);
    res.status(500).json({ code: -1, message: '获取活动列表失败' });
  }
});

/**
 * PUT /v1/admin/activities/:id/approve - 审核活动（管理后台统一路径）
 * 请求体: { action: 'approve'|'reject', reject_reason?: string }
 */
router.put('/:id/approve', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { action } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ code: -1, message: '操作类型无效，需为 approve 或 reject' });
  }

  try {
    const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(id);
    if (!salon) return res.status(404).json({ code: -1, message: '活动不存在' });

    if (salon.status !== 'pending') {
      return res.status(400).json({ code: -1, message: '只能审核待审核的活动' });
    }

    const newStatus = action === 'approve' ? 'published' : 'rejected';
    const rejectReason = action === 'reject' ? (req.body.reject_reason || '') : '';

    db.prepare(`
      UPDATE salons SET status = ?, reject_reason = ?, audit_status = ?,
        audit_time = datetime('now'), auditor_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, rejectReason, action === 'approve' ? 'approved' : 'rejected', req.user?.userId || 0, id);

    res.json({ code: 0, message: action === 'approve' ? '审核通过' : '已拒绝', data: { id, status: newStatus } });
  } catch (err) {
    console.error('[admin-activities] approve error:', err);
    res.status(500).json({ code: -1, message: '审核失败' });
  }
});

module.exports = router;
