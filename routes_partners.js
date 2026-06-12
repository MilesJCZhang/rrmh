/**
 * 合伙人管理路由
 * 提供合伙人增删改查、审核、收益查询等API
 * 包含完整的参数验证和认证
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

/**
 * 处理验证错误
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: -1,
      message: '参数验证失败',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * 1. 申请成为合伙人
 * POST /api/partners/apply
 * 公益推荐官（public_welfare）自动通过审核，无需人工审核
 */
router.post('/apply', [
  body('user_id').isInt({ min: 1 }).withMessage('用户ID必须是正整数').toInt(),
  body('type').isIn(['creator', 'public_welfare']).withMessage('类型必须是 creator 或 public_welfare'),
  body('id_card').optional().isLength({ min: 15, max: 18 }).withMessage('身份证号长度不正确'),
  body('id_card_front').optional().isURL().withMessage('身份证正面照片必须是有效URL'),
  body('id_card_back').optional().isURL().withMessage('身份证反面照片必须是有效URL')
:], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { user_id, type, id_card, id_card_front, id_card_back } = req.body;
  
  console.log('[partners] Received request body:', JSON.stringify(req.body));
  console.log('[partners] user_id:', user_id, 'type:', type);
  
  try {
    // 公益推荐官（public_welfare）自动通过审核，其他类型需要审核
    const status = type === 'public_welfare' ? 'approved' : 'pending';
    
    const stmt = db.prepare(`
      INSERT INTO partners (user_id, type, id_card, id_card_front, id_card_back, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(user_id, type, id_card || null, id_card_front || null, id_card_back || null, status);
    
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(info.lastInsertRowid);
    
    // 如果自动通过，同时更新用户角色
    if (status === 'approved') {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('public_matchmaker', user_id);
    }
    
    res.status(201).json({
      code: 0,
      data: partner,
      message: status === 'approved' ? '申请成功，已自动通过审核' : '申请提交成功，等待审核'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        code: -1,
        message: '您已经申请过成为合伙人'
      });
    }
    console.error('[partners] 申请失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 2. 查询我的合伙人信息
 * GET /api/partners/my/:user_id
 */
router.get('/my/:user_id', [
  param('user_id').isInt({ min: 1 }).withMessage('用户ID必须是正整数').toInt()
:], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { user_id } = req.params;
  
  try {
    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(user_id);
    
    if (!partner) {
      return res.status(404).json({
        code: -1,
        message: '未找到合伙人信息'
      });
    }
    
    res.json({
      code: 0,
      data: partner
    });
  } catch (error) {
    console.error('[partners] 查询失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 3. 查询合伙人列表（管理员）
 * GET /api/partners?page=1&limit=10&status=pending&type=creator
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('状态值无效'),
  query('type').optional().isIn(['creator', 'public_welfare']).withMessage('类型值无效'),
  query('keyword').optional().isLength({ max: 100 }).withMessage('关键词不能超过100字符')
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, limit = 10, status, type, keyword } = req.query;
  
  const offset = (page - 1) * limit;
  
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    if (keyword) {
      whereClause += ' AND (nickname LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM partners p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
    `);
    const { total } = countStmt.get(...params);
    
    const queryStmt = db.prepare(`
      SELECT p.*, u.nickname, u.phone, u.avatar
      FROM partners p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const items = queryStmt.all(...params, parseInt(limit), parseInt(offset));
    
    res.json({
      code: 0,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[partners] 查询列表失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 4. 查询合伙人详情（管理员）
 * GET /api/partners/:id
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('合伙人ID必须是正整数').toInt()
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  
  try {
    const partner = db.prepare(`
      SELECT p.*, u.nickname, u.phone, u.avatar
      FROM partners p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(id);
    
    if (!partner) {
      return res.status(404).json({
        code: -1,
        message: '合伙人不存在'
      });
    }
    
    res.json({
      code: 0,
      data: partner
    });
  } catch (error) {
    console.error('[partners] 查询详情失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 5. 更新合伙人信息（管理员）
 * PUT /api/partners/:id
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('合伙人ID必须是正整数').toInt(),
  body('type').optional().isIn(['creator', 'public_welfare']).withMessage('类型值无效'),
  body('level').optional().isInt({ min: 1, max: 10 }).withMessage('等级必须在1-10之间').toInt(),
  body('total_earnings').optional().isFloat({ min: 0 }).withMessage('总收益必须是非负数').toFloat()
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { type, level, total_earnings } = req.body;
  
  try {
    const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        code: -1,
        message: '合伙人不存在'
      });
    }
    
    const updates = [];
    const params = [];
    
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    
    if (level !== undefined) {
      updates.push('level = ?');
      params.push(level);
    }
    
    if (total_earnings !== undefined) {
      updates.push('total_earnings = ?');
      params.push(total_earnings);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        code: -1,
        message: '没有提供要更新的字段'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const stmt = db.prepare(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`);
    params.push(id);
    stmt.run(...params);
    
    const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    
    res.json({
      code: 0,
      data: updated,
      message: '更新成功'
    });
  } catch (error) {
    console.error('[partners] 更新失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 6. 审核合伙人（管理员）
 * PUT /api/partners/:id/approve
 */
router.put('/:id/approve', [
  param('id').isInt({ min: 1 }).withMessage('合伙人ID必须是正整数').toInt(),
  body('status').isIn(['approved', 'rejected']).withMessage('状态值无效，必须是 approved 或 rejected'),
  body('reject_reason').if(body('status').equals('rejected')).notEmpty().withMessage('拒绝时必须提供拒绝原因')
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { status, reject_reason } = req.body;
  
  try {
    const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        code: -1,
        message: '合伙人不存在'
      });
    }
    
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    
    if (status === 'rejected') {
      updates.push('reject_reason = ?');
      params.push(reject_reason);
    } else {
      updates.push('reject_reason = NULL');
    }
    
    const stmt = db.prepare(`UPDATE partners SET ${updates.join(', ')} WHERE id = ?`);
    params.push(id);
    stmt.run(...params);
    
    const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    
    res.json({
      code: 0,
      data: updated,
      message: status === 'approved' ? '审核通过' : '已拒绝'
    });
  } catch (error) {
    console.error('[partners] 审核失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 7. 查询合伙人收益（管理员）
 * GET /api/partners/:id/earnings?start_date=2026-01-01&end_date=2026-12-31
 */
router.get('/:id/earnings', [
  param('id').isInt({ min: 1 }).withMessage('合伙人ID必须是正整数').toInt(),
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确'),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt()
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { start_date, end_date, page = 1, limit = 20 } = req.query;
  
  const offset = (page - 1) * limit;
  
  try {
    let whereClause = 'WHERE partner_id = ?';
    const params = [id];
    
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    const earnings = db.prepare(`
      SELECT * FROM partner_earnings
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));
    
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total, SUM(amount) as total_amount 
      FROM partner_earnings
      ${whereClause}
    `).get(...params);
    
    res.json({
      code: 0,
      data: {
        items: earnings,
        total: totalResult.total || 0,
        total_amount: totalResult.total_amount || 0,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[partners] 查询收益失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 8. 查询合伙人推荐记录（管理员）
 * GET /api/partners/:id/referrals?page=1&limit=10
 */
router.get('/:id/referrals', [
  param('id').isInt({ min: 1 }).withMessage('合伙人ID必须是正整数').toInt(),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt(),
  query('status').optional().isIn(['pending', 'completed', 'expired']).withMessage('状态值无效')
:], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  
  const offset = (page - 1) * limit;
  
  try {
    const partner = db.prepare('SELECT user_id FROM partners WHERE id = ?').get(id);
    if (!partner) {
      return res.status(404).json({
        code: -1,
        message: '合伙人不存在'
      });
    }
    
    let whereClause = 'WHERE referrer_id = ?';
    const params = [partner.user_id];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM user_referrals ${whereClause}`);
    const { total } = countStmt.get(...params);
    
    const queryStmt = db.prepare(`
      SELECT ur.*, u.nickname as referred_user_name
      FROM user_referrals ur
      LEFT JOIN users u ON ur.user_id = u.id
      ${whereClause}
      ORDER BY ur.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const items = queryStmt.all(...params, parseInt(limit), parseInt(offset));
    
    res.json({
      code: 0,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[partners] 查询推荐记录失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

module.exports = router;
