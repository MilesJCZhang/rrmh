/**
 * 沙龙配置管理路由（管理后台）
 * 提供沙龙配置的CRUD API
 */

const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const router = express.Router();

/**
 * 获取所有沙龙配置
 * GET /api/admin/salon-configs
 */
router.get('/salon-configs', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  
  try {
    const configs = db.prepare('SELECT * FROM salon_configs ORDER BY id').all();
    
    // 解析JSON字段
    const parsedConfigs = configs.map(config => ({
      ...config,
      features: config.features ? JSON.parse(config.features) : null,
      registration: config.registration ? JSON.parse(config.registration) : null,
      permissions: config.permissions ? JSON.parse(config.permissions) : null,
      commission: config.commission ? JSON.parse(config.commission) : null,
      api: config.api ? JSON.parse(config.api) : null,
      theme: {
        color: config.theme_color,
        lightColor: config.theme_light_color,
        gradient: config.theme_gradient,
        bannerBg: config.theme_banner_bg,
        icon: config.theme_icon,
      },
      page: {
        list: config.page_list,
        detail: config.page_detail,
        create: config.page_create,
      },
    }));
    
    res.json(parsedConfigs);
  } catch (error) {
    console.error('[salon-config] 获取配置列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置列表失败'
    });
  }
});

/**
 * 获取单个沙龙配置
 * GET /api/admin/salon-configs/:type
 */
router.get('/salon-configs/:type', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { type } = req.params;
  
  try {
    const config = db.prepare('SELECT * FROM salon_configs WHERE type = ?').get(type);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '配置不存在'
      });
    }
    
    // 解析JSON字段
    const parsedConfig = {
      ...config,
      features: config.features ? JSON.parse(config.features) : null,
      registration: config.registration ? JSON.parse(config.registration) : null,
      permissions: config.permissions ? JSON.parse(config.permissions) : null,
      commission: config.commission ? JSON.parse(config.commission) : null,
      api: config.api ? JSON.parse(config.api) : null,
      theme: {
        color: config.theme_color,
        lightColor: config.theme_light_color,
        gradient: config.theme_gradient,
        bannerBg: config.theme_banner_bg,
        icon: config.theme_icon,
      },
      page: {
        list: config.page_list,
        detail: config.page_detail,
        create: config.page_create,
      },
    };
    
    res.json(parsedConfig);
  } catch (error) {
    console.error('[salon-config] 获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
});

/**
 * 创建沙龙配置
 * POST /api/admin/salon-configs
 */
router.post('/salon-configs', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const {
    type,
    name,
    description,
    emoji,
    theme,
    page,
    features,
    registration,
    permissions,
    commission,
    api,
    status,
  } = req.body;
  
  try {
    const insertConfig = db.prepare(`
      INSERT INTO salon_configs (
        type, name, description, emoji,
        theme_color, theme_light_color, theme_gradient, theme_banner_bg, theme_icon,
        page_list, page_detail, page_create,
        features, registration, permissions, commission, api,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertConfig.run(
      type,
      name,
      description,
      emoji,
      theme?.color,
      theme?.lightColor,
      theme?.gradient,
      theme?.bannerBg,
      theme?.icon,
      page?.list,
      page?.detail,
      page?.create,
      JSON.stringify(features),
      JSON.stringify(registration),
      JSON.stringify(permissions),
      JSON.stringify(commission),
      JSON.stringify(api),
      status || 'active'
    );
    
    const newConfig = db.prepare('SELECT * FROM salon_configs WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: '配置创建成功',
      data: newConfig
    });
  } catch (error) {
    console.error('[salon-config] 创建配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建配置失败'
    });
  }
});

/**
 * 更新沙龙配置
 * PUT /api/admin/salon-configs/:type
 */
router.put('/salon-configs/:type', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { type } = req.params;
  const {
    name,
    description,
    emoji,
    theme,
    page,
    features,
    registration,
    permissions,
    commission,
    api,
    status,
  } = req.body;
  
  try {
    const updateConfig = db.prepare(`
      UPDATE salon_configs SET
        name = ?,
        description = ?,
        emoji = ?,
        theme_color = ?,
        theme_light_color = ?,
        theme_gradient = ?,
        theme_banner_bg = ?,
        theme_icon = ?,
        page_list = ?,
        page_detail = ?,
        page_create = ?,
        features = ?,
        registration = ?,
        permissions = ?,
        commission = ?,
        api = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE type = ?
    `);
    
    updateConfig.run(
      name,
      description,
      emoji,
      theme?.color,
      theme?.lightColor,
      theme?.gradient,
      theme?.bannerBg,
      theme?.icon,
      page?.list,
      page?.detail,
      page?.create,
      JSON.stringify(features),
      JSON.stringify(registration),
      JSON.stringify(permissions),
      JSON.stringify(commission),
      JSON.stringify(api),
      status,
      type
    );
    
    const updatedConfig = db.prepare('SELECT * FROM salon_configs WHERE type = ?').get(type);
    
    res.json({
      success: true,
      message: '配置更新成功',
      data: updatedConfig
    });
  } catch (error) {
    console.error('[salon-config] 更新配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新配置失败'
    });
  }
});

/**
 * 删除沙龙配置
 * DELETE /api/admin/salon-configs/:type
 */
router.delete('/salon-configs/:type', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { type } = req.params;
  
  try {
    const result = db.prepare('DELETE FROM salon_configs WHERE type = ?').run(type);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '配置不存在'
      });
    }
    
    res.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error) {
    console.error('[salon-config] 删除配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除配置失败'
    });
  }
});

/**
 * 启用/禁用沙龙配置
 * PATCH /api/admin/salon-configs/:type/status
 */
router.patch('/salon-configs/:type/status', requireAuth, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { type } = req.params;
  const { status } = req.body;
  
  try {
    const result = db.prepare('UPDATE salon_configs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE type = ?').run(status, type);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '配置不存在'
      });
    }
    
    const updatedConfig = db.prepare('SELECT * FROM salon_configs WHERE type = ?').get(type);
    
    res.json({
      success: true,
      message: `配置已${status === 'active' ? '启用' : '禁用'}`,
      data: updatedConfig
    });
  } catch (error) {
    console.error('[salon-config] 更新状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新状态失败'
    });
  }
});

module.exports = router;
