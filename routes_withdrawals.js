/**
 * 提现管理路由
 * 提供提现申请、审核、查询等API
 * 包含完整的参数验证、佣金余额检查、冻结/解冻逻辑
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const { calculateWithdrawalFee } = require('./commission_engine');

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
 * 获取用户可提现佣金余额（从 commissions 表计算）
 */
function getAvailableCommission(db, userId) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM commissions
     WHERE recipient_id = ? AND status = 'pending' AND recipient_type != 'platform'`
  ).get(userId);
  return parseFloat(row?.total || 0);
}

/**
 * 1. 申请提现（用户端）
 * POST /api/withdrawals
 */
router.post('/', [
  body('amount').isFloat({ min: 0.01 }).withMessage('提现金额必须大于0').toFloat(),
  body('bank_account').notEmpty().withMessage('银行卡号不能为空').isLength({ min: 10, max: 50 }).withMessage('银行卡号长度不正确'),
  body('bank_name').notEmpty().withMessage('开户行不能为空').isLength({ max: 100 }).withMessage('开户行名称不能超过100字符'),
  body('account_holder').notEmpty().withMessage('开户人不能为空').isLength({ max: 50 }).withMessage('开户人姓名不能超过50字符')
], handleValidationErrors, requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  const { amount, bank_account, bank_name, account_holder } = req.body;

  try {
    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({
        code: -1,
        message: '用户不存在'
      });
    }

    // 检查可用佣金是否足够
    const available = getAvailableCommission(db, user_id);
    if (available < amount) {
      return res.status(400).json({
        code: -1,
        message: `可用佣金不足，当前可提现 ${available.toFixed(2)} 元`
      });
    }

    // 计算手续费
    const feeCalc = calculateWithdrawalFee(user.role || 'user', amount);
    const fee = feeCalc.fee;
    const actualAmount = feeCalc.netAmount;

    // 使用事务：创建提现申请 + 冻结佣金
    const doWithdrawal = db.transaction(() => {
      // 创建提现申请
      const stmt = db.prepare(`
        INSERT INTO withdrawals (user_id, amount, fee, actual_amount, bank_account, bank_name, account_holder, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `);
      const info = stmt.run(user_id, amount, fee, actualAmount, bank_account, bank_name, account_holder);
      const withdrawalId = Number(info.lastInsertRowid);

      // 冻结佣金：将对应金额的 pending 佣金记录标记为 frozen
      const pendingCommissions = db.prepare(
        `SELECT id, amount FROM commissions
         WHERE recipient_id = ? AND status = 'pending' AND recipient_type != 'platform'
         ORDER BY created_at ASC`
      ).all(user_id);

      let remaining = amount;
      for (const comm of pendingCommissions) {
        if (remaining <= 0) break;
        db.prepare(
          `UPDATE commissions SET status = 'frozen', withdrawal_id = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(withdrawalId, comm.id);
        remaining -= parseFloat(comm.amount);
      }

      return withdrawalId;
    });

    const withdrawalId = doWithdrawal();
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);

    res.status(201).json({
      code: 0,
      data: {
        ...withdrawal,
        fee,
        actualAmount,
        feeDescription: feeCalc.description,
      },
      message: '提现申请提交成功，等待审核'
    });
  } catch (error) {
    console.error('[withdrawals] 申请失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 2. 查询我的提现记录（用户端）
 * GET /api/withdrawals/my
 */
router.get('/my', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'paid', 'cancelled']).withMessage('状态值无效')
], handleValidationErrors, requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user_id = req.user.userId;
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE user_id = ?';
    const params = [user_id];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM withdrawals ${whereClause}`);
    const { total } = countStmt.get(...params);

    const queryStmt = db.prepare(`
      SELECT * FROM withdrawals
      ${whereClause}
      ORDER BY created_at DESC
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
    console.error('[withdrawals] 查询失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 3. 查询提现详情（用户端）
 * GET /api/withdrawals/:id
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('提现记录ID必须是正整数').toInt()
], handleValidationErrors, requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const user_id = req.user.userId;

  try {
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ? AND user_id = ?').get(id, user_id);

    if (!withdrawal) {
      return res.status(404).json({
        code: -1,
        message: '提现记录不存在'
      });
    }

    res.json({
      code: 0,
      data: withdrawal
    });
  } catch (error) {
    console.error('[withdrawals] 查询详情失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 4. 取消提现申请（用户端）
 * PUT /api/withdrawals/:id/cancel
 */
router.put('/:id/cancel', [
  param('id').isInt({ min: 1 }).withMessage('提现记录ID必须是正整数').toInt()
], handleValidationErrors, requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const user_id = req.user.userId;

  try {
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ? AND user_id = ?').get(id, user_id);

    if (!withdrawal) {
      return res.status(404).json({
        code: -1,
        message: '提现记录不存在'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        code: -1,
        message: '只能取消待审核的提现申请'
      });
    }

    // 使用事务：取消提现 + 解冻佣金
    const doCancel = db.transaction(() => {
      // 更新状态为已取消
      db.prepare('UPDATE withdrawals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('cancelled', id);

      // 解冻佣金：将冻结的佣金恢复为 pending
      db.prepare(
        `UPDATE commissions SET status = 'pending', withdrawal_id = NULL, updated_at = datetime('now')
         WHERE withdrawal_id = ? AND status = 'frozen'`
      ).run(id);
    });

    doCancel();

    const updated = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    res.json({
      code: 0,
      data: updated,
      message: '提现申请已取消，佣金已解冻'
    });
  } catch (error) {
    console.error('[withdrawals] 取消失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 5. 查询提现列表（管理员）
 * GET /api/withdrawals/admin/list
 */
router.get('/admin/list', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间').toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'paid', 'cancelled']).withMessage('状态值无效'),
  query('user_id').optional().isInt({ min: 1 }).withMessage('用户ID必须是正整数').toInt(),
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确')
], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { page = 1, limit = 10, status, user_id, start_date, end_date } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }

    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM withdrawals ${whereClause}`);
    const { total } = countStmt.get(...params);

    const queryStmt = db.prepare(`
      SELECT w.*, u.nickname as user_name, u.phone as user_phone
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      ${whereClause}
      ORDER BY w.created_at DESC
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
    console.error('[withdrawals] 查询列表失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 6. 审核提现申请（管理员）
 * PUT /api/withdrawals/admin/:id/approve
 */
router.put('/admin/:id/approve', [
  param('id').isInt({ min: 1 }).withMessage('提现记录ID必须是正整数').toInt(),
  body('status').isIn(['approved', 'rejected']).withMessage('状态值无效，必须是 approved 或 rejected'),
  body('reject_reason').if(body('status').equals('rejected')).notEmpty().withMessage('拒绝时必须提供拒绝原因')
], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { status, reject_reason } = req.body;

  try {
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    if (!withdrawal) {
      return res.status(404).json({
        code: -1,
        message: '提现记录不存在'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        code: -1,
        message: '只能审核待审核的提现申请'
      });
    }

    const doApprove = db.transaction(() => {
      const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [status];

      if (status === 'rejected') {
        updates.push('reject_reason = ?');
        params.push(reject_reason);

        // 拒绝时返还佣金：将冻结的佣金恢复为 pending
        db.prepare(
          `UPDATE commissions SET status = 'pending', withdrawal_id = NULL, updated_at = datetime('now')
           WHERE withdrawal_id = ? AND status = 'frozen'`
        ).run(id);
      }

      if (status === 'approved') {
        updates.push('processed_at = CURRENT_TIMESTAMP');
        // 审核通过：将冻结的佣金标记为 withdrawn（已提现）
        db.prepare(
          `UPDATE commissions SET status = 'withdrawn', updated_at = datetime('now')
           WHERE withdrawal_id = ? AND status = 'frozen'`
        ).run(id);
      }

      const stmt = db.prepare(`UPDATE withdrawals SET ${updates.join(', ')} WHERE id = ?`);
      params.push(id);
      stmt.run(...params);
    });

    doApprove();

    const updated = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    res.json({
      code: 0,
      data: updated,
      message: status === 'approved' ? '审核通过' : '已拒绝，佣金已解冻'
    });
  } catch (error) {
    console.error('[withdrawals] 审核失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 7. 标记已打款（管理员）
 * PUT /api/withdrawals/admin/:id/mark-paid
 */
router.put('/admin/:id/mark-paid', [
  param('id').isInt({ min: 1 }).withMessage('提现记录ID必须是正整数').toInt()
], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;

  try {
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    if (!withdrawal) {
      return res.status(404).json({
        code: -1,
        message: '提现记录不存在'
      });
    }

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({
        code: -1,
        message: '只能标记已审核通过的提现'
      });
    }

    db.prepare('UPDATE withdrawals SET status = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('paid', id);

    // 标记佣金为已支付
    db.prepare(
      `UPDATE commissions SET status = 'paid', updated_at = datetime('now')
       WHERE withdrawal_id = ? AND status = 'withdrawn'`
    ).run(id);

    const updated = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);

    res.json({
      code: 0,
      data: updated,
      message: '已标记为打款完成'
    });
  } catch (error) {
    console.error('[withdrawals] 标记打款失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

/**
 * 8. 获取提现统计（管理员）
 * GET /api/withdrawals/admin/stats
 */
router.get('/admin/stats', [
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确')
], handleValidationErrors, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { start_date, end_date } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount
      FROM withdrawals
      ${whereClause}
    `).get(...params);

    res.json({
      code: 0,
      data: {
        total_count: stats.total_count || 0,
        pending_count: stats.pending_count || 0,
        approved_count: stats.approved_count || 0,
        rejected_count: stats.rejected_count || 0,
        paid_count: stats.paid_count || 0,
        total_amount: stats.total_amount || 0,
        pending_amount: stats.pending_amount || 0,
        paid_amount: stats.paid_amount || 0
      }
    });
  } catch (error) {
    console.error('[withdrawals] 统计失败:', error);
    res.status(500).json({
      code: -1,
      message: '服务器错误'
    });
  }
});

module.exports = router;
