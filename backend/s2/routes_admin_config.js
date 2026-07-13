/**
 * routes_admin_config.js - 管理后台系统配置路由（本地开发版）
 *
 * 端点：
 *   GET  /v1/admin/config/map  获取配置键值对
 *   PUT  /v1/admin/config/set  设置配置项
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * GET /v1/admin/config/map - 获取所有配置键值对
 */
router.get('/config/map', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');

  try {
    let configs = {};
    try {
      const rows = db.prepare('SELECT config_key, config_value FROM system_configs').all();
      for (const r of rows) configs[r.config_key] = r.config_value;
    } catch (e) {
      // system_configs 表可能不存在
    }

    res.json({ code: 0, data: configs });
  } catch (err) {
    logger.error('[admin_config] map error:', err.message);
    res.json({ code: 0, data: {} });
  }
});

/**
 * PUT /v1/admin/config/set - 设置配置项
 */
router.put('/config/set', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { key, value } = req.body;

  if (!key) return res.status(400).json({ code: -1, message: 'key 不能为空' });

  try {
    try {
      db.prepare(`UPDATE system_configs SET config_value = ?, updated_at = datetime('now') WHERE config_key = ?`).run(value, key);
      if (db.prepare('SELECT changes()').get()['changes()'] === 0) {
        db.prepare(`INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(key, value);
      }
    } catch (e) {
      // 表不存在，创建后重试
      if (e.message && e.message.includes('no such table')) {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS system_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT UNIQUE NOT NULL,
            config_value TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        db.prepare(`INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(key, value);
      } else {
        throw e;
      }
    }

    logger.info(`[admin_config] set ${key}=${value}`);
    res.json({ code: 0, message: '配置已更新' });
  } catch (err) {
    logger.error('[admin_config] set error:', err.message);
    res.status(500).json({ code: -1, message: '更新配置失败' });
  }
});

/**
 * PUT /config - 设置配置项（兼容前端 call: PUT /v1/admin/config with Record<string,string>）
 */
router.put('/config', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const configData = req.body;

  if (!configData || typeof configData !== 'object') {
    return res.status(400).json({ code: -1, message: '请求体必须是键值对对象' });
  }

  try {
    // 确保 system_configs 表存在
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS system_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT UNIQUE NOT NULL,
          config_value TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
    } catch (e) { /* 表可能已存在 */ }

    const stmtUpsert = db.prepare(`
      INSERT INTO system_configs (config_key, config_value, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = datetime('now')
    `);

    const keys = Object.keys(configData);
    for (const key of keys) {
      stmtUpsert.run(key, String(configData[key]));
    }

    logger.info(`[admin_config] bulk set ${keys.length} configs`);
    res.json({ code: 0, message: `已更新 ${keys.length} 个配置项`, data: { updated: keys.length } });
  } catch (err) {
    logger.error('[admin_config] bulk set error:', err.message);
    res.status(500).json({ code: -1, message: '更新配置失败' });
  }
});

module.exports = router;
