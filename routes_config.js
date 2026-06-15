/**
 * routes_config.js - 配置相关路由
 * 提供小程序公共配置
 */

const express = require('express');
const router = express.Router();

// GET /v1/config/public-map
router.get('/public-map', (req, res) => {
  // 返回公共配置
  res.json({
    code: 0,
    data: {
      // 小程序基础配置
      appName: '人人媒好',
      version: '1.0.13',
      
      // 功能开关
      enableReferral: true,        // 推荐码功能
      enableCommission: true,      // 佣金功能
      enablePayment: true,         // 支付功能
      
      // 业务配置
      maxReferralCodes: 100,      // 每个用户最多推荐码数量
      commissionRate: 0.1,        // 佣金比例 10%
      minWithdrawAmount: 100,     // 最低提现金额（分）
      
      // 联系方式
      servicePhone: '400-xxx-xxxx',
      serviceWechat: 'renrenmei_service',
      
      // 关于页面链接
      aboutUrl: 'https://www.renrenmei.com/about',
      privacyUrl: 'https://www.renrenmei.com/privacy',
      agreementUrl: 'https://www.renrenmei.com/agreement'
    }
  });
});

// GET /v1/config/commission-rules
router.get('/commission-rules', (req, res) => {
  res.json({
    code: 0,
    data: {
      rules: [
        {
          type: 'referral',
          name: '推荐奖励',
          rate: 0.1,
          description: '成功推荐用户注册可获得10%奖励'
        },
        {
          type: 'matchmaker',
          name: '红娘服务',
          rate: 0.15,
          description: '红娘成功撮合可获得15%奖励'
        }
      ]
    }
  });
});

// GET /v1/config/commission-rules
router.get('/commission-rules', (req, res) => {
  res.json({
    code: 0,
    data: {
      rules: [
        {
          type: 'referral',
          name: '推荐奖励',
          rate: 0.1,
          description: '成功推荐用户注册可获得10%奖励'
        },
        {
          type: 'matchmaker',
          name: '红娘服务',
          rate: 0.15,
          description: '红娘成功撮合可获得15%奖励'
        }
      ]
    }
  });
});

// GET /v1/config/map - 所有配置键值对（需登录）
router.get('/map', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ code: -1, message: '未登录' });
  }
  res.json({
    code: 0,
    data: {
      enableReferral: true,
      enableCommission: true,
      enablePayment: true,
      maxReferralCodes: 100,
      commissionRate: 0.1,
      minWithdrawAmount: 100,
      servicePhone: '400-xxx-xxxx',
      serviceWechat: 'renrenmei_service',
      aboutUrl: 'https://www.renrenmei.com/about',
      privacyUrl: 'https://www.renrenmei.com/privacy',
      agreementUrl: 'https://www.renrenmei.com/agreement',
    },
  });
});

module.exports = router;
