/**
 * routes/payment.js - 支付相关接口 (已集成佣金引擎)
 *
 * 支付成功后自动触发佣金计算:
 * - 单笔建档: 推荐人得99元，平台沉淀100元
 * - 联创入驻: 第2个起推荐人得399元
 * - 专业入驻: 第2个起推荐人得3999元
 * - 城市入驻: 推荐人(专业)得10000元+3%沉淀
 */
const express = require('express');
const crypto = require('crypto');
const { getPool } = require('./config');
const { processCommission } = require('./commission_engine');
const logger = require('../../utils/logger');

// 付费身份类型 → role + codeType 映射
const PAID_TIER_CONFIG = {
  'partner_matchmaker':       { role: 'partner_matchmaker',        codeType: 'creator' },
  'professional_recommender': { role: 'professional_recommender', codeType: 'professional' },
  'city_franchisee':          { role: 'city_franchisee',           codeType: 'city_partner' },
  'community_station':        { role: 'community_station',         codeType: 'community_station' },
  'single_registration':      { role: 'member',                    codeType: 'member' }, // 会员建档费 → 会员身份
};

/**
 * 支付成功后，为付费用户升级身份并生成推荐码
 * @param {Object} pool - db pool
 * @param {string} orderType - orders.type (如 'partner_matchmaker')
 * @param {number} userId - 付款用户ID
 */
async function upgradeUserToPaidTier(pool, orderType, userId) {
  const config = PAID_TIER_CONFIG[orderType];
  if (!config) return; // 非付费身份类型，跳过

  const { role, codeType } = config;

  // 1. 检查用户是否已是该角色（幂等）
  const [users] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!users[0]) {
    logger.warn(`[Payment] upgradeUserToPaidTier: user ${userId} not found`);
    return;
  }
  if (users[0].role === role) {
    logger.debug(`[Payment] user ${userId} already role ${role}, skipping upgrade`);
    return;
  }

  // 2. 生成唯一推荐码
  const CODE_PREFIX_MAP = {
    'creator': 'LCRG', 'professional': 'ZYRG',
    'city_partner': 'CSHH', 'community_station': 'SQZD',
    'member': 'HYDH', // 会员推荐码
  };
  const prefix = CODE_PREFIX_MAP[codeType] || 'LCRG';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code, attempts = 0;
  do {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = prefix + suffix;
    const [existing] = await pool.execute('SELECT id FROM referral_codes WHERE code = ?', [code]);
    if (!existing[0]) break;
    attempts++;
  } while (attempts < 10);
  if (attempts >= 10) code = prefix + Date.now().toString(36).slice(-4).toUpperCase();

  // 3. 写入 referral_codes 表
  await pool.execute(
    `INSERT INTO referral_codes (code, code_type, referrer_id, status, use_count, max_uses, created_by, created_at)
     VALUES (?, ?, ?, 'active', 0, 0, ?, datetime('now'))`,
    [code, codeType, userId, userId]
  );

  // 4. 升级用户身份 + 记录推荐码
  await pool.execute(
    `UPDATE users SET role = ?, referral_code = ?, referral_level = 1, updated_at = datetime('now') WHERE id = ?`,
    [role, code, userId]
  );

  // 4.5 更新访客状态为已支付（即使建档未完成也要标记）
  try {
    const [userRows] = await pool.execute(
      'SELECT openid FROM users WHERE id = ?', [userId]
    );
    if (userRows[0]?.openid) {
      await pool.execute(
        `UPDATE visitor_logs SET reg_status='paid', updated_at=datetime('now')
         WHERE visitor_openid=? AND (reg_status='pending' OR reg_status IS NULL)`,
        [userRows[0].openid]
      );
    }
  } catch (e) {
    logger.warn('[Payment] 更新访客状态失败:', e.message);
  }

  // 5. 更新 apply_records 为 approved（如有）
  await pool.execute(
    `UPDATE apply_records SET status = 'approved', updated_at = datetime('now') WHERE user_id = ? AND target_role = ? AND status = 'pending'`,
    [userId, role]
  );

  logger.info(`[Payment] user ${userId} upgraded to ${role}, referral code: ${code}`);
}

const router = express.Router();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ code: -1, message: '未登录' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ code: -1, message: '服务配置错误' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ code: -1, message: '登录已过期' });
  }
}

// 统一下单签名（API v2）
function signV2(params, key) {
  const sorted = Object.keys(params).filter(k => params[k] && k !== 'sign').sort();
  const str = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${key}`;
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

const FEE_MAP = {
  single_registration: 0.19,  // 限时特惠：0.19元成为会员（原价199元，限量199个名额）
  partner_matchmaker: 399,
  professional_recommender: 3999,
  city_franchisee: 10000,
  online_unlock_gold: 199,
  online_unlock_silver: 299,
  salon_signup: 399,
};

const DESC_MAP = {
  single_registration: '会员建档费',
  partner_matchmaker: '联创推荐官入驻费',
  professional_recommender: '专业推荐官入驻费',
  city_franchisee: '城市合伙人入驻费',
  online_unlock_gold: '线上了解-优质会员',
  online_unlock_silver: '线上了解-良好会员',
  salon_signup: '线下沙龙报名费',
};

/**
 * POST /v1/payment/create
 * 创建支付订单
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    // 确保 orders 表存在（幂等，SQLite 兼容）
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        out_trade_no TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        total_fee REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        transaction_id TEXT,
        paid_at TEXT,
        salon_id INTEGER,
        registration_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).catch(() => {});
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)').catch(() => {});
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').catch(() => {});
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_orders_out_trade_no ON orders(out_trade_no)').catch(() => {});
    // 确保 commission_failures 表存在
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS commission_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        out_trade_no TEXT,
        user_id INTEGER NOT NULL,
        pay_type TEXT NOT NULL,
        total_amount REAL NOT NULL,
        referrer_id INTEGER,
        error_message TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `).catch(() => {});
    const { type, amount } = req.body;

    // 服务端金额校验：type 必须合法，且金额必须与服务端定义一致
    if (!type || !FEE_MAP[type]) {
      return res.status(400).json({ code: -1, message: '无效的支付类型' });
    }

    const totalFee = FEE_MAP[type];

    // 校验客户端传入的金额与服务端定义是否一致（防止篡改）
    if (amount !== undefined && parseFloat(amount) !== totalFee) {
      logger.error('[支付] 金额篡改: 客户端', amount, '服务端', totalFee);
      return res.status(400).json({ code: -1, message: '支付金额异常' });
    }

    // 会员建档和付费身份需要推荐人（公益推荐官除外）
    const FEE_TYPES_NEED_REFERRER = ['single_registration', 'partner_matchmaker', 'professional_recommender', 'city_franchisee', 'community_station'];
    if (FEE_TYPES_NEED_REFERRER.includes(type)) {
      const [payers] = await pool.execute(
        'SELECT referrer_id FROM users WHERE id = ?',
        [req.userId]
      );
      const hasReferrer = payers[0]?.referrer_id;
      // 也检查是否系统授权（referred_by_code = 'SYSTEM'）
      let isSystemAuthorized = false;
      if (!hasReferrer) {
        const [codes] = await pool.execute(
          "SELECT referred_by_code FROM referral_codes WHERE referrer_id = ? AND referred_by_code = 'SYSTEM' LIMIT 1",
          [req.userId]
        );
        isSystemAuthorized = codes.length > 0;
      }
      if (!hasReferrer && !isSystemAuthorized) {
        return res.status(400).json({ code: -1, message: '该操作需要先通过推荐码绑定一位推荐人' });
      }
    }

    // 限量控制：会员建档费0.19元限量199个名额
    // 使用独立配额表 + 原子UPDATE保证并发安全
    if (type === 'single_registration' && totalFee === 0.19) {
      // 初始化配额表（幂等）
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS quota_control (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          quota_type TEXT NOT NULL UNIQUE,
          total_limit INTEGER NOT NULL,
          current_count INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `).catch(() => {});
      // 初始化单_registration配额（如果不存在）
      await pool.execute(`
        INSERT OR IGNORE INTO quota_control (id, quota_type, total_limit, current_count)
        VALUES (1, 'single_registration_199', 199, (
          SELECT COALESCE((SELECT COUNT(*) FROM orders WHERE type = 'single_registration' AND status = 'paid'), 0)
        ))
      `).catch(() => {});

      // 原子扣减配额：只有 count < limit 时才扣减成功
      const [updateResult] = await pool.execute(
        `UPDATE quota_control SET current_count = current_count + 1, updated_at = datetime('now')
         WHERE quota_type = 'single_registration_199' AND current_count < total_limit`,
        []
      );
      const affected = Array.isArray(updateResult) ? updateResult[0]?.affectedRows || updateResult[0]?.changes : updateResult?.affectedRows || updateResult?.changes;
      if (!affected || affected === 0) {
        return res.status(400).json({
          code: -1,
          message: '限时特惠名额已满（199/199），请支付原价199元'
        });
      }
    }

    const body = DESC_MAP[type];
    const outTradeNo = `RRM${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 获取用户 openid
    const [users] = await pool.execute('SELECT openid FROM users WHERE id = ?', [req.userId]);
    logger.debug('[支付] 查询结果 users:', JSON.stringify(users));
    if (!users[0]?.openid) {
      logger.error('[支付] 用户openid不存在:', users);
      return res.status(400).json({ code: -1, message: '用户不存在' });
    }
    const openid = users[0].openid;
    logger.debug('[支付] 用户openid:', openid);
    
    // 检查是否使用模拟支付模式
    if (process.env.MOCK_PAYMENT === 'true') {
      logger.debug('[支付] 使用模拟支付模式');
      const mockPrepayId = 'mock_prepay_id_' + Date.now();
      
      // 记录订单
      const [insertResult] = await pool.execute(
        `INSERT INTO orders (out_trade_no, user_id, type, total_fee, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
        [outTradeNo, req.userId, type, totalFee]
      );
      
      const orderId = insertResult.insertId;
      
      // 模拟支付成功，更新订单状态
      await pool.execute(
        `UPDATE orders SET status='paid', paid_at=datetime('now') WHERE id=?`,
        [orderId]
      );
      
      // 触发佣金计算
      try {
        // 获取推荐人ID（从用户表）
        // 降级策略：优先取 referrer_id（通过推荐码绑定），若无则取 parent_id（通过微信登录scene绑定）
        const [payers] = await pool.execute(
          'SELECT referrer_id, parent_id FROM users WHERE id = ?',
          [req.userId]
        );
        const referrerId = payers[0]?.referrer_id || payers[0]?.parent_id || null;
        
        await processCommission({
          orderId: orderId,
          payerId: req.userId,
          payType: type,
          totalAmount: totalFee,
          referrerId: referrerId
        }, pool);
        logger.debug('[支付] 佣金计算成功');

        // 付费身份升级 + 推荐码生成（联创/专业/城市合伙人等）
        await upgradeUserToPaidTier(pool, type, req.userId);
      } catch (commErr) {
        logger.error('[支付] 佣金计算失败:', commErr.message);
        // 记录失败到 commission_failures 表便于重试
        try {
          await pool.execute(
            `INSERT INTO commission_failures (order_id, out_trade_no, user_id, pay_type, total_amount, referrer_id, error_message, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
            [orderId, outTradeNo, req.userId, type, totalFee, referrerId, commErr.message]
          );
        } catch (logErr) {
          logger.error('[支付] 记录佣金失败日志出错:', logErr.message);
        }
      }
      
      return res.json({
        code: 0,
        message: '模拟支付成功',
        data: {
          outTradeNo,
          status: 'paid'
        }
      });
    }
    
    // 调用微信统一下单 API v2
    const MCH_ID = process.env.WECHAT_MCH_ID;
    const API_KEY = process.env.WECHAT_API_KEY;
    const APPID = process.env.WX_APPID;
    
    logger.debug('[支付] 微信配置:', { MCH_ID, APPID, API_KEY: API_KEY ? '已配置' : '未配置' });

    const nonceStr = crypto.randomBytes(16).toString('hex').slice(0, 32);
    const params = {
      appid: APPID,
      mch_id: MCH_ID,
      nonce_str: nonceStr,
      body,
      out_trade_no: outTradeNo,
      total_fee: totalFee * 100,
      spbill_create_ip: '8.8.8.8',
      notify_url: `https://${process.env.API_DOMAIN || 'rrmhdate.cn'}/v1/payment/notify`,
      trade_type: 'JSAPI',
      openid,
    };
    params.sign = signV2(params, API_KEY);

    const xml = require('js2xmlparser');
    const postData = xml.parse('xml', params);

    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: postData,
    });

    const text = await response.text();
    logger.debug('[支付] 微信响应:', text);  // 添加日志
    
    const parseString = require('xml2js').parseString;
    const result = await new Promise((resolve, reject) => {
      parseString(text, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const wxRes = result.xml;
    logger.debug('[支付] 解析后的响应:', JSON.stringify(wxRes, null, 2));
    
    if (wxRes.return_code !== 'SUCCESS') {
      logger.error('[支付] return_code 失败:', wxRes.return_msg);
      return res.status(400).json({ code: -1, message: wxRes.return_msg || '微信支付失败' });
    }
    
    if (wxRes.result_code !== 'SUCCESS') {
      logger.error('[支付] result_code 失败:', wxRes.err_code, wxRes.err_code_des);
      return res.status(400).json({ code: -1, message: wxRes.err_code_des || '微信支付失败' });
    }

    // 返回调起支付所需参数
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const wxNonceStr = crypto.randomBytes(16).toString('hex').slice(0, 32);
    const paySignParams = {
      appId: APPID,
      timeStamp,
      nonceStr: wxNonceStr,
      package: `prepay_id=${wxRes.prepay_id}`,
      signType: 'MD5',
    };
    const paySign = signV2(paySignParams, API_KEY);

    // 记录订单
    await pool.execute(
      `INSERT INTO orders (out_trade_no, user_id, type, total_fee, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
      [outTradeNo, req.userId, type, totalFee]
    );

    res.json({
      code: 0,
      data: {
        timeStamp,
        nonceStr: wxNonceStr,
        package: `prepay_id=${wxRes.prepay_id}`,
        paySign,
        outTradeNo,
      },
    });
  } catch (err) {
    logger.error('payment create error:', err);
    res.status(500).json({ code: -1, message: '支付创建失败' });
  }
});

/**
 * POST /v1/payment/notify
 * 微信支付回调 - 支付成功后触发佣金计算
 */
router.post('/notify', async (req, res) => {
  try {
    let xml = '';
    req.setEncoding('latin1');
    req.on('data', chunk => { xml += chunk; });
    req.on('end', async () => {
      try {
        const parseString = require('xml2js').parseString;
        const result = await new Promise((resolve, reject) => {
          parseString(xml, { explicitArray: false }, (err, r) => err ? reject(err) : resolve(r));
        });

        const wxRes = result.xml;
        if (wxRes.return_code !== 'SUCCESS') {
          return res.send(xmlBuilder({ return_code: 'FAIL', return_msg: '签名失败' }));
        }

        // 验证签名
        const API_KEY = process.env.WECHAT_API_KEY;
        const signObj = {};
        Object.keys(wxRes).forEach(k => { if (k !== 'sign') signObj[k] = wxRes[k]; });
        const mySign = signV2(signObj, API_KEY);
        if (mySign !== wxRes.sign) {
          return res.send(xmlBuilder({ return_code: 'FAIL', return_msg: '签名失败' }));
        }

        const pool = await getPool();
        const { out_trade_no, transaction_id } = wxRes;

        // 更新订单状态
        const [orderResult] = await pool.execute(
          `UPDATE orders SET status='paid', transaction_id=?, paid_at=datetime('now') WHERE out_trade_no=?`,
          [transaction_id, out_trade_no]
        );

        // 查询订单信息
        const [orders] = await pool.execute(
          'SELECT id, user_id, type, total_fee FROM orders WHERE out_trade_no = ?',
          [out_trade_no]
        );

        if (orders[0]) {
          const order = orders[0];

          // 获取付款人信息
          // 降级策略：优先取 referrer_id（通过推荐码绑定），若无则取 parent_id（通过微信登录scene绑定）
          const [payers] = await pool.execute(
            'SELECT id, referrer_id, parent_id FROM users WHERE id = ?',
            [order.user_id]
          );

          if (payers[0]) {
            const payer = payers[0];
            const effectiveReferrerId = payer.referrer_id || payer.parent_id || null;

            // 触发佣金计算
            try {
              await processCommission({
                orderId: order.id,
                payerId: order.user_id,
                payType: order.type,
                totalAmount: parseFloat(order.total_fee),
                referrerId: effectiveReferrerId,
              }, pool);

              logger.debug(`[Commission] Order ${out_trade_no} commission processed`);

              // 付费身份升级 + 推荐码生成（联创/专业/城市合伙人等）
              await upgradeUserToPaidTier(pool, order.type, order.user_id);
            } catch (commErr) {
              logger.error(`[Commission] Error processing commission for order ${out_trade_no}:`, commErr);
              // 佣金计算失败不影响支付回调，但记录到 commission_failures 表便于重试
              try {
                pool.execute(
                  `INSERT INTO commission_failures (order_id, out_trade_no, user_id, pay_type, total_amount, referrer_id, error_message, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
                  [order.id, out_trade_no, order.user_id, order.type, order.total_fee, payer.referrer_id || null, commErr.message]
                );
              } catch (logErr) {
                logger.error('[Commission] Failed to log commission failure:', logErr.message);
              }
            }
          }
        }

        res.send(xmlBuilder({ return_code: 'SUCCESS', return_msg: 'OK' }));
      } catch (e) {
        logger.error('notify parse error:', e);
        res.send(xmlBuilder({ return_code: 'FAIL', return_msg: '解析失败' }));
      }
    });
  } catch (err) {
    logger.error('payment notify error:', err);
    res.send(xmlBuilder({ return_code: 'FAIL', return_msg: '系统错误' }));
  }
});

function xmlBuilder(obj) {
  return Object.entries(obj).map(([k, v]) => `<${k}>${v}</${k}>`).join('');
}

module.exports = router;

/**
 * 确保 commission_failures 表存在（幂等，SQLite 兼容）
 */
function ensureCommissionFailuresTable(pool) {
  pool.execute(`
    CREATE TABLE IF NOT EXISTS commission_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      out_trade_no TEXT,
      user_id INTEGER NOT NULL,
      pay_type TEXT NOT NULL,
      total_amount REAL NOT NULL,
      referrer_id INTEGER,
      error_message TEXT,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `).catch(() => {});
}

// 服务启动时自动建表
ensureCommissionFailuresTable({ execute: async () => {} });
