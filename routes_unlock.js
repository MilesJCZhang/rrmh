/**
 * routes_unlock.js - 线上解锁路由
 *
 * POST /v1/unlock/online  - 线上解锁（199/299元）
 * GET  /v1/unlock/status - 查询解锁状态
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth-middleware');
const { canOnlineUnlock, getOnlineUnlockPrice, getUnlockPaymentType } = require('./utils/pricing');

// 确保unlock_records表存在
function ensureUnlockTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS unlock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      unlock_type TEXT NOT NULL,
      order_id INTEGER,
      price INTEGER NOT NULL,
      is_permanent INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id),
      UNIQUE(user_id, target_user_id, unlock_type)
    );
    CREATE INDEX IF NOT EXISTS idx_unlock_user ON unlock_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_unlock_target ON unlock_records(target_user_id);
  `);
}

/**
 * POST /v1/unlock/online
 * 线上解锁对方资料（付费）
 *
 * Body:
 *  - target_user_id: 要解锁的用户ID
 *
 * 流程：
 *  1. 校验viewer的tier允许线上解锁
 *  2. 校验viewer的tier允许解锁target的tier
 *  3. 检查是否已解锁
 *  4. 创建支付订单
 *  5. 返回支付参数（前端调起微信支付）
 *  6. 支付成功后由notify回调写入unlock_records
 */
router.post('/online', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureUnlockTable(db);

    const userId = req.user.userId;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      return res.status(400).json({ code: -1, message: '缺少target_user_id' });
    }

    if (userId === target_user_id) {
      return res.status(400).json({ code: -1, message: '不能解锁自己' });
    }

    // 获取双方信息
    const viewer = db.prepare('SELECT id, score_tier, profile_score FROM users WHERE id = ?').get(userId);
    const target = db.prepare('SELECT id, score_tier, profile_score, nickname FROM users WHERE id = ?').get(target_user_id);

    if (!viewer) {
      return res.status(404).json({ code: -1, message: '当前用户不存在' });
    }
    if (!target) {
      return res.status(404).json({ code: -1, message: '目标用户不存在' });
    }

    const viewerTier = viewer.score_tier || 'unrated';
    const targetTier = target.score_tier || 'unrated';

    // 检查viewer tier是否允许线上解锁
    if (!canOnlineUnlock(viewerTier, targetTier)) {
      return res.status(403).json({
        code: -1,
        message: viewerTier === 'bronze' || viewerTier === 'unrated'
          ? '您的资料评分不足60分，暂不可线上解锁，请完善资料或参加线下沙龙'
          : '您的评分等级不允许解锁该用户',
      });
    }

    // 检查是否已解锁
    const existing = db.prepare(
      'SELECT id, status FROM unlock_records WHERE user_id = ? AND target_user_id = ? AND unlock_type = \'online\''
    ).get(userId, target_user_id);

    if (existing && existing.status === 'active') {
      return res.json({
        code: 0,
        message: '已解锁',
        data: { unlock_id: existing.id, already_unlocked: true },
      });
    }

    // 计算价格
    const price = getOnlineUnlockPrice(targetTier);
    if (price <= 0) {
      return res.status(400).json({ code: -1, message: '该用户不可线上解锁' });
    }

    // 创建支付订单
    const paymentType = getUnlockPaymentType(targetTier);
    const outTradeNo = `UL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 写入订单
    const orderResult = db.prepare(`
      INSERT INTO orders (out_trade_no, user_id, type, total_fee, status, unlock_target_user_id, score_tier_at_purchase, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
    `).run(outTradeNo, userId, paymentType, price, target_user_id, viewerTier);

    const orderId = orderResult.lastInsertRowid;

    // 如果模拟支付模式，直接写入unlock_records
    if (process.env.MOCK_PAYMENT === 'true') {
      db.prepare(`
        INSERT OR REPLACE INTO unlock_records (user_id, target_user_id, unlock_type, order_id, price, is_permanent, status, created_at)
        VALUES (?, ?, 'online', ?, ?, 1, 'active', datetime('now'))
      `).run(userId, target_user_id, orderId, price * 100);

      // 更新订单状态
      db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(orderId);

      return res.json({
        code: 0,
        message: '模拟支付成功，已解锁',
        data: { order_id: orderId, out_trade_no: outTradeNo, status: 'paid', price },
      });
    }

    // 真实支付：返回订单信息，前端调起微信支付
    res.json({
      code: 0,
      data: {
        order_id: orderId,
        out_trade_no: outTradeNo,
        payment_type: paymentType,
        price,
        target_nickname: target.nickname,
        target_tier: targetTier,
      },
    });
  } catch (err) {
    console.error('[unlock] online error:', err);
    res.status(500).json({ code: -1, message: '解锁操作失败' });
  }
});

/**
 * GET /v1/unlock/status
 * 查询对指定用户的解锁状态
 *
 * Query:
 *  - target_user_id: 目标用户ID（单个查询）
 *  - target_user_ids: 逗号分隔的ID列表（批量查询）
 */
router.get('/status', requireAuth, (req, res) => {
  try {
    const db = req.app.get('db');
    ensureUnlockTable(db);

    const userId = req.user.userId;
    const { target_user_id, target_user_ids } = req.query;

    if (target_user_id) {
      // 单个查询
      const unlock = db.prepare(
        'SELECT id, unlock_type, status, created_at FROM unlock_records WHERE user_id = ? AND target_user_id = ? AND status = \'active\''
      ).get(userId, target_user_id);

      return res.json({
        code: 0,
        data: {
          target_user_id: Number(target_user_id),
          isUnlocked: !!unlock,
          unlockType: unlock?.unlock_type || null,
          unlockedAt: unlock?.created_at || null,
        },
      });
    }

    if (target_user_ids) {
      // 批量查询
      const ids = target_user_ids.split(',').map(Number).filter(n => !isNaN(n));
      if (ids.length === 0) {
        return res.json({ code: 0, data: {} });
      }
      const placeholders = ids.map(() => '?').join(',');
      const unlocks = db.prepare(
        `SELECT target_user_id, unlock_type, status, created_at FROM unlock_records WHERE user_id = ? AND target_user_id IN (${placeholders}) AND status = 'active'`
      ).all(userId, ...ids);

      const unlockMap = {};
      for (const u of unlocks) {
        unlockMap[u.target_user_id] = {
          isUnlocked: true,
          unlockType: u.unlock_type,
          unlockedAt: u.created_at,
        };
      }
      // 未解锁的填默认值
      for (const id of ids) {
        if (!unlockMap[id]) {
          unlockMap[id] = { isUnlocked: false, unlockType: null, unlockedAt: null };
        }
      }

      return res.json({ code: 0, data: unlockMap });
    }

    // 无参数：返回所有已解锁列表
    const allUnlocks = db.prepare(
      'SELECT target_user_id, unlock_type, status, created_at FROM unlock_records WHERE user_id = ? AND status = \'active\' ORDER BY created_at DESC'
    ).all(userId);

    res.json({
      code: 0,
      data: allUnlocks,
    });
  } catch (err) {
    console.error('[unlock] status error:', err);
    res.status(500).json({ code: -1, message: '查询解锁状态失败' });
  }
});

module.exports = router;
