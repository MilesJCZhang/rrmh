/**
 * routes/commission.js - 佣金相关接口
 */
const express = require('express');
const { getPool } = require('./config');
const { getWithdrawableCommission, getPlatformFundBalance, getCommissionList } = require('./commission_engine');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[routes_commission] FATAL: JWT_SECRET 环境变量必须设置');
  process.exit(1);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ code: -1, message: '未登录' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ code: -1, message: '登录已过期' });
  }
}

/**
 * GET /v1/commission/summary
 * 获取佣金概览
 */
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.userId;

    // 获取用户信息
    const [users] = await pool.execute(
      'SELECT id, role, matchmaker_level FROM users WHERE id = ?',
      [userId]
    );
    const user = users[0];
    if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });

    // 待结算佣金
    const pendingCommission = await getWithdrawableCommission(userId, pool);

    // 沉淀资金余额 (城市合伙人/专业推荐官)
    let settlementBalance = 0;
    if (user.role === 'city_franchisee') {
      settlementBalance = await getPlatformFundBalance(userId, 'city_partner', pool);
    } else if (user.role === 'professional_recommender') {
      settlementBalance = await getPlatformFundBalance(userId, 'professional_partner', pool);
    }

    // 已结算佣金总额
    const [settled] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM commissions
       WHERE recipient_id = ? AND status = 'settled'`,
      [userId]
    );

    // 获取下级推荐统计
    const [referralStats] = await pool.execute(
      `SELECT
         SUM(registration_count) as total_registrations,
         SUM(partner_count) as total_partners,
         SUM(professional_count) as total_professionals,
         SUM(city_count) as total_cities,
         SUM(registration_amount) as registration_income,
         SUM(partner_amount) as partner_income,
         SUM(professional_amount) as professional_income,
         SUM(city_amount) as city_income
       FROM referral_stats
       WHERE referrer_id = ?`,
      [userId]
    );

    res.json({
      code: 0,
      data: {
        role: user.role,
        level: user.matchmaker_level,
        pending_commission: parseFloat(pendingCommission),
        settlement_balance: settlementBalance,
        total_settled: parseFloat(settled[0]?.total || 0),
        referral_stats: {
          total_registrations: referralStats[0]?.total_registrations || 0,
          total_partners: referralStats[0]?.total_partners || 0,
          total_professionals: referralStats[0]?.total_professionals || 0,
          total_cities: referralStats[0]?.total_cities || 0,
          total_income: parseFloat(
            (referralStats[0]?.registration_income || 0) +
            (referralStats[0]?.partner_income || 0) +
            (referralStats[0]?.professional_income || 0) +
            (referralStats[0]?.city_income || 0)
          ),
        }
      }
    });
  } catch (err) {
    console.error('commission summary error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * GET /v1/commission/list
 * 获取佣金明细列表
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    const list = await getCommissionList(req.userId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      code: 0,
      data: {
        list,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (err) {
    console.error('commission list error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * POST /v1/commission/settle
 * 结算佣金 (管理员接口或自动结算)
 */
router.post('/settle', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const { commission_ids } = req.body;

    if (commission_ids && commission_ids.length > 0) {
      // 指定结算
      await pool.execute(
        `UPDATE commissions SET status = 'settled', settled_at = NOW()
         WHERE id IN (?) AND status = 'pending'`,
        [commission_ids]
      );
    } else {
      // 结算当前用户所有待结算佣金
      await pool.execute(
        `UPDATE commissions SET status = 'settled', settled_at = NOW()
         WHERE recipient_id = ? AND status = 'pending'`,
        [req.userId]
      );
    }

    res.json({ code: 0, data: { code: 0 } });
  } catch (err) {
    console.error('commission settle error:', err);
    res.status(500).json({ code: -1, message: '结算失败' });
  }
});

/**
 * GET /v1/commission/platform-fund
 * 获取沉淀资金记录
 */
router.get('/platform-fund', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const [rows] = await pool.execute(
      `SELECT * FROM platform_fund
       WHERE owner_id = ? AND owner_type IN ('city_partner', 'professional_partner')
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.userId]
    );

    res.json({ code: 0, data: { list: rows } });
  } catch (err) {
    console.error('platform fund error:', err);
    res.status(500).json({ code: -1, message: '查询失败' });
  }
});

/**
 * POST /v1/commission/withdraw
 * 申请提现
 */
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ code: -1, message: '请输入正确的提现金额' });
    }

    // 获取用户信息和费率
    const [users] = await pool.execute(
      'SELECT id, role, matchmaker_level FROM users WHERE id = ?',
      [req.userId]
    );
    const user = users[0];
    if (!user) return res.status(404).json({ code: -1, message: '用户不存在' });

    // 提现手续费率
    const feeRates = {
      city_franchisee: 0,  // 0%（沉淀资金净额直接提取，无额外扣费）
      professional_recommender: 0.13,  // 13%
      partner_matchmaker: 0.13,
      community_station: 0.13,
      public_matchmaker: 0.13,
      user: 0.13,
    };
    const feeRate = feeRates[user.role] || 0.13;

    // 计算可提现金额
    const available = await getWithdrawableCommission(req.userId, pool);

    // 沉淀资金也计入可提现
    let settlementAvailable = 0;
    if (user.role === 'city_franchisee') {
      settlementAvailable = await getPlatformFundBalance(req.userId, 'city_partner', pool);
    } else if (user.role === 'professional_recommender') {
      settlementAvailable = await getPlatformFundBalance(req.userId, 'professional_partner', pool);
    }

    const totalAvailable = available + settlementAvailable;

    if (amount > totalAvailable) {
      return res.status(400).json({
        code: -1,
        message: `可提现余额不足，当前可提现: ¥${totalAvailable.toFixed(2)}`
      });
    }

    const fee = amount * feeRate;
    const actualAmount = amount - fee;

    // 创建提现记录
    const [result] = await pool.execute(
      `INSERT INTO withdrawals (user_id, amount, fee, actual_amount, fee_rate, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.userId, amount, fee, actualAmount, feeRate]
    );

    res.json({
      code: 0,
      data: {
        code: 0,
        message: '提现申请已提交',
        withdraw_id: result.insertId
      }
    });
  } catch (err) {
    console.error('withdraw error:', err);
    res.status(500).json({ code: -1, message: '提现申请失败' });
  }
});

module.exports = router;
