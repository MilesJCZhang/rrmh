/**
 * routes_moderation.js - 内容安全检测路由
 *
 * 端点：
 *   POST /v1/moderation/text-check      文本安全检测
 *   POST /v1/moderation/image-check     图片安全检测
 *   POST /v1/moderation/user-risk-rank  用户风险评级
 *
 * 在本地开发环境中，始终返回安全结果。
 * 生产环境应接入微信内容安全 API (msgSecCheck / imgSecCheck)。
 */

const express = require('express');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /v1/moderation/text-check
 * 文本安全检测（开发模式始终返回安全）
 */
router.post('/text-check', (req, res) => {
  const { content } = req.body;
  logger.debug(`[moderation] text-check: "${(content || '').slice(0, 30)}..."`);

  res.json({
    code: 0,
    message: '检测通过',
    data: {
      safe: true,
      label: 'clean',
    },
  });
});

/**
 * POST /v1/moderation/image-check
 * 图片安全检测（开发模式始终返回安全）
 */
router.post('/image-check', (req, res) => {
  logger.debug('[moderation] image-check: received');
  res.json({
    code: 0,
    message: '检测通过',
    data: {
      safe: true,
      label: 'clean',
    },
  });
});

/**
 * POST /v1/moderation/user-risk-rank
 * 用户风险评级（开发模式始终返回安全）
 */
router.post('/user-risk-rank', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      risk_rank: 0,
      risk_type: 'unknown',
      desc: '',
    },
  });
});

module.exports = router;
