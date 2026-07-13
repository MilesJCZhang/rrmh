/**
 * routes_verify.js - 实名认证路由（本地开发版）
 *
 * 端点：
 *   POST /v1/verify/submit  提交实名认证
 *   GET  /v1/verify/status  查询认证状态
 */

const express = require('express');
const { requireAuth } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /v1/verify/submit - 提交实名认证
 */
router.post('/submit', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;
  const { realName, idNumber } = req.body;

  try {
    // 检查是否已有认证记录
    const existing = db.prepare("SELECT * FROM users WHERE id = ? AND face_auth_status = 'approved'").get(userId);
    if (existing) {
      return res.json({ code: 0, data: { status: 'approved', isVerified: true, level: 1 } });
    }

    // 更新用户认证状态
    db.prepare(`
      UPDATE users SET face_auth_status = 'pending', real_name = ?, id_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(realName || '', idNumber || '', userId);

    logger.info(`[verify] 用户${userId}提交实名认证`);
    res.json({ code: 0, data: { status: 'pending', isVerified: false, level: 1 } });
  } catch (err) {
    logger.error('[verify] submit error:', err.message);
    res.status(500).json({ code: -1, message: '提交失败' });
  }
});

/**
 * GET /v1/verify/status - 查询认证状态
 */
router.get('/status', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = req.user.userId;

  try {
    const user = db.prepare('SELECT face_auth_status, real_name FROM users WHERE id = ?').get(userId);
    const status = user?.face_auth_status || 'none';
    const isVerified = status === 'approved';

    res.json({
      code: 0,
      data: {
        status,
        level: isVerified ? 1 : 0,
        isVerified,
        realName: user?.real_name || '',
        rejectReason: '',
      },
    });
  } catch (err) {
    logger.error('[verify] status error:', err.message);
    res.json({ code: 0, data: { status: 'none', level: 0, isVerified: false, rejectReason: '' } });
  }
});

module.exports = router;
