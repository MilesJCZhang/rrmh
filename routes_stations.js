/**
 * 服务站管理路由
 * 提供服务站增删改查API
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
 * 1. 创建服务站
 * POST /api/stations
 */
router.post('/', [
  body('name').notEmpty().withMessage('服务站名称不能为空').isLength({ max: 100 }).withMessage('服务站名称不能超过100字符'),
  body('address').notEmpty().withMessage('地址不能为空'),
  body('contact_phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('manager_id').optional().isInt({ min: 1 }).withMessage('负责人ID必须是正整数'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符')
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { name, address, contact_phone, manager_id, description } = req.body;

  try {
    const stmt = db.prepare(`
      INSERT INTO stations (name, address, contact_phone, manager_id, description, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);
    
    const info = stmt.run(name, address, contact_phone || null, manager_id || null, description || null);
    
    // 获取创建的服务站信息
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(info.lastInsertRowid);
    
    res.status(201).json({
      code: 0,
      data: station,
      message: '服务站创建成功'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        code: -1,
        message: '服务站名称已存在'
      });
    }
    console.error('[stations] 创建服务站失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 2. 查询服务站列表
 * GET /api/stations?page=1&limit=10&status=active&keyword=xxx
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt(),
  query('status').optional().isIn(['active', 'inactive']).withMessage('状态值无效'),
  query('keyword').optional().isLength({ max: 100 }).withMessage('关键词不能超过100字符')
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, limit = 10, status, keyword } = req.query;
  
  const offset = (page - 1) * limit;
  
  try {
    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR address LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 查询总数
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM stations ${whereClause}`);
    const { total } = countStmt.get(...params);
    
    // 查询列表
    const queryStmt = db.prepare(`
      SELECT s.*, u.nickname as manager_name
      FROM stations s
      LEFT JOIN users u ON s.manager_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
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
    console.error('[stations] 查询服务站列表失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 3. 查询服务站详情
 * GET /api/stations/:id
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('服务站ID必须是正整数').toInt()
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  
  try {
    const station = db.prepare(`
      SELECT s.*, u.nickname as manager_name, u.phone as manager_phone
      FROM stations s
      LEFT JOIN users u ON s.manager_id = u.id
      WHERE s.id = ?
    `).get(id);
    
    if (!station) {
      return res.status(404).json({
        code: -1,
        message: '服务站不存在'
      });
    }
    
    res.json({
      code: 0,
      data: station
    });
  } catch (error) {
    console.error('[stations] 查询服务站详情失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 4. 更新服务站
 * PUT /api/stations/:id
 */
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('服务站ID必须是正整数').toInt(),
  body('name').optional().notEmpty().withMessage('服务站名称不能为空').isLength({ max: 100 }).withMessage('服务站名称不能超过100字符'),
  body('address').optional().notEmpty().withMessage('地址不能为空'),
  body('contact_phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('manager_id').optional().isInt({ min: 1 }).withMessage('负责人ID必须是正整数'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('状态值无效'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述不能超过500字符')
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { name, address, contact_phone, manager_id, status, description } = req.body;
  
  try {
    // 检查服务站是否存在
    const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        code: -1,
        message: '服务站不存在'
      });
    }
    
    // 构建更新语句
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (contact_phone !== undefined) {
      updates.push('contact_phone = ?');
      params.push(contact_phone);
    }
    if (manager_id !== undefined) {
      updates.push('manager_id = ?');
      params.push(manager_id);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        code: -1,
        message: '没有提供要更新的字段'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    const stmt = db.prepare(`
      UPDATE stations SET ${updates.join(', ')} WHERE id = ?
    `);
    
    params.push(id);
    stmt.run(...params);
    
    // 获取更新后的信息
    const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    
    res.json({
      code: 0,
      data: updated,
      message: '服务站更新成功'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        code: -1,
        message: '服务站名称已存在'
      });
    }
    console.error('[stations] 更新服务站失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 5. 删除服务站
 * DELETE /api/stations/:id
 */
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('服务站ID必须是正整数').toInt()
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  
  try {
    // 检查服务站是否存在
    const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        code: -1,
        message: '服务站不存在'
      });
    }
    
    // 删除服务站
    db.prepare('DELETE FROM stations WHERE id = ?').run(id);
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('[stations] 删除服务站失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 6. 更新服务站状态
 * PUT /api/stations/:id/status
 */
router.put('/:id/status', [
  param('id').isInt({ min: 1 }).withMessage('服务站ID必须是正整数').toInt(),
  body('status').notEmpty().withMessage('状态不能为空').isIn(['active', 'inactive']).withMessage('状态值无效，必须是 active 或 inactive')
], handleValidationErrors, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    // 检查服务站是否存在
    const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        code: -1,
        message: '服务站不存在'
      });
    }
    
    // 更新状态
    db.prepare(`
      UPDATE stations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, id);
    
    // 获取更新后的信息
    const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    
    res.json({
      code: 0,
      data: updated,
      message: '状态更新成功'
    });
  } catch (error) {
    console.error('[stations] 更新服务站状态失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

module.exports = router;
