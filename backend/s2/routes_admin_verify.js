/**
 * routes_admin_verify.js - 管理后台实名认证审核路由
 *
 * 端点：
 *   GET  /stats                        认证统计
 *   GET  /                             认证列表（分页+状态筛选）
 *   GET  /:userId                      认证详情
 *   PUT  /:userId/review               审核认证（通过/拒绝）
 *
 * 数据来源：users 表的 face_auth_status / real_name / id_number / face_image 等字段
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 状态枚举映射
const STATUS_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

/**
 * GET /stats - 认证统计
 */
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  try {
    let stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    try {
      const rows = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN face_auth_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN face_auth_status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN face_auth_status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM users
        WHERE face_auth_status IS NOT NULL AND face_auth_status != ''
      `).get();
      if (rows) {
        stats = { total: rows.total || 0, pending: rows.pending || 0, approved: rows.approved || 0, rejected: rows.rejected || 0 };
      }
    } catch (e) {
      logger.error('[admin_verify] stats query error:', e.message);
    }
    res.json({ code: 0, data: stats });
  } catch (err) {
    logger.error('[admin_verify] stats error:', err.message);
    res.json({ code: 0, data: { total: 0, pending: 0, approved: 0, rejected: 0 } });
  }
});

/**
 * GET / - 认证列表（分页+状态筛选）
 * 返回字段与前端 Verification 接口对齐
 */
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, pageSize = 20, status } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize)));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    let where = "WHERE face_auth_status IS NOT NULL AND face_auth_status != ''";
    const params = [];
    if (status && status !== 'all') {
      where += ' AND face_auth_status = ?';
      params.push(status);
    }

    let total = 0, list = [];
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM users ${where}`).get(...params);
      total = countRow?.total || 0;

      list = db.prepare(`
        SELECT id, nickname, phone, avatar, face_auth_status, real_name, id_number,
               face_image, created_at, remark
        FROM users ${where}
        ORDER BY CASE face_auth_status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END, updated_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pageSizeNum, offset);
    } catch (e) {
      logger.error('[admin_verify] list query error:', e.message);
    }

    // 转换为前端 Verification 格式
    const items = list.map(u => ({
      id: u.id,
      user_id: u.id,
      user_nickname: u.nickname || '',
      user_phone: u.phone || '',
      user_avatar: u.avatar || '',
      verify_type: 'online',
      id_card_front: u.id_number ? `/api/admin/verifications/${u.id}/id-card-front` : '',
      id_card_back: '',
      face_image: u.face_image || '',
      status: u.face_auth_status || 'none',
      reject_reason: u.remark || '',
      created_at: u.created_at || '',
    }));

    res.json({ code: 0, data: { items, total, page: pageNum, pageSize: pageSizeNum } });
  } catch (err) {
    logger.error('[admin_verify] list error:', err.message);
    res.json({ code: 0, data: { items: [], total: 0 } });
  }
});

/**
 * GET /:userId - 认证详情
 */
router.get('/:userId', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.userId);

  try {
    const user = db.prepare(`
      SELECT id, nickname, phone, avatar, face_auth_status, real_name, id_number,
             face_image, created_at, remark
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    res.json({
      code: 0,
      data: {
        id: user.id,
        user_id: user.id,
        user_nickname: user.nickname || '',
        user_phone: user.phone || '',
        user_avatar: user.avatar || '',
        verify_type: 'online',
        id_card_front: '',
        id_card_back: '',
        face_image: user.face_image || '',
        status: user.face_auth_status || 'none',
        reject_reason: user.remark || '',
        created_at: user.created_at || '',
      },
    });
  } catch (err) {
    logger.error('[admin_verify] detail error:', err.message);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * PUT /:userId/review - 审核认证
 * 请求体: { status: 'approved'|'rejected', remark?: string }
 */
router.put('/:userId/review', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.userId);
  const { status: reviewStatus, remark } = req.body;

  if (!reviewStatus || !['approved', 'rejected'].includes(reviewStatus)) {
    return res.status(400).json({ code: -1, message: '状态无效，必须是 approved 或 rejected' });
  }

  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: -1, message: '用户不存在' });
    }

    db.prepare(`
      UPDATE users SET face_auth_status = ?, remark = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(reviewStatus, remark || '', userId);

    logger.info(`[admin_verify] 用户${userId}认证审核: ${reviewStatus}`);
    res.json({
      code: 0,
      message: reviewStatus === 'approved' ? '审核通过' : '已拒绝',
    });
  } catch (err) {
    logger.error('[admin_verify] review error:', err.message);
    res.status(500).json({ code: -1, message: '审核失败' });
  }
});

module.exports = router;
