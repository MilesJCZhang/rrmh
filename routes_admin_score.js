/**
 * routes_admin_score.js - 评分规则管理 + 评分分布统计 API
 * 管理员专用
 */
const express = require('express');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const scoreEngine = require('./utils/scoreEngine');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAuth, requireAdmin);

/**
 * GET /v1/admin/score/rules
 * 获取评分规则列表
 */
router.get('/rules', (req, res) => {
  const db = req.app.get('db');
  try {
    const rules = db.prepare('SELECT * FROM score_rules WHERE status = ? ORDER BY field_group, sort_order').all('active');
    res.json({ code: 0, data: rules });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取评分规则失败', error: err.message });
  }
});

/**
 * PUT /v1/admin/score/rules/:id
 * 更新评分规则（分值、启用/禁用）
 */
router.put('/rules/:id', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;
  const { max_score, status, field_label } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM score_rules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ code: -1, message: '规则不存在' });
    }

    const updates = [];
    const values = [];
    if (max_score !== undefined) { updates.push('max_score = ?'); values.push(max_score); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (field_label !== undefined) { updates.push('field_label = ?'); values.push(field_label); }
    updates.push("updated_at = datetime('now')");

    if (updates.length === 1) {
      return res.json({ code: 0, message: '无更新' });
    }

    values.push(id);
    db.prepare(`UPDATE score_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '更新失败', error: err.message });
  }
});

/**
 * POST /v1/admin/score/rules/:id/toggle
 * 启用/禁用规则
 */
router.post('/rules/:id/toggle', (req, res) => {
  const db = req.app.get('db');
  const { id } = req.params;

  try {
    const rule = db.prepare('SELECT status FROM score_rules WHERE id = ?').get(id);
    if (!rule) {
      return res.status(404).json({ code: -1, message: '规则不存在' });
    }
    const newStatus = rule.status === 'active' ? 'inactive' : 'active';
    db.prepare("UPDATE score_rules SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
    res.json({ code: 0, message: newStatus === 'active' ? '已启用' : '已禁用', data: { status: newStatus } });
  } catch (err) {
    res.status(500).json({ code: -1, message: '操作失败', error: err.message });
  }
});

/**
 * GET /v1/admin/score/overview
 * 评分分布统计
 */
router.get('/overview', (req, res) => {
  const db = req.app.get('db');
  try {
    // 各tier人数
    const tierDistribution = db.prepare(`
      SELECT score_tier, COUNT(*) as count
      FROM user_scores
      GROUP BY score_tier
    `).all();

    // 平均分
    const avgScore = db.prepare(`
      SELECT AVG(total_score) as avg_score, MAX(total_score) as max_score, MIN(total_score) as min_score
      FROM user_scores WHERE total_score > 0
    `).get();

    // 各维度平均分
    const groupAvg = db.prepare(`
      SELECT
        AVG(basic_score) as avg_basic,
        AVG(career_score) as avg_career,
        AVG(hobby_score) as avg_hobby,
        AVG(preference_score) as avg_preference,
        AVG(verification_score) as avg_verification,
        AVG(asset_score) as avg_asset
      FROM user_scores WHERE total_score > 0
    `).get();

    // 总用户数 + 已评分数
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const scoredUsers = db.prepare('SELECT COUNT(*) as count FROM user_scores WHERE total_score > 0').get().count;

    // 分数段分布（每10分一段）
    const scoreBuckets = db.prepare(`
      SELECT
        CASE
          WHEN total_score >= 90 THEN '90-100'
          WHEN total_score >= 80 THEN '80-89'
          WHEN total_score >= 70 THEN '70-79'
          WHEN total_score >= 60 THEN '60-69'
          WHEN total_score >= 50 THEN '50-59'
          WHEN total_score >= 40 THEN '40-49'
          WHEN total_score >= 30 THEN '30-39'
          WHEN total_score >= 20 THEN '20-29'
          WHEN total_score >= 10 THEN '10-19'
          ELSE '0-9'
        END as score_range,
        COUNT(*) as count
      FROM user_scores
      GROUP BY score_range
      ORDER BY score_range DESC
    `).all();

    res.json({
      code: 0,
      data: {
        tierDistribution,
        avgScore: {
          avg: parseFloat(avgScore?.avg_score || 0).toFixed(1),
          max: avgScore?.max_score || 0,
          min: avgScore?.min_score || 0,
        },
        groupAvg,
        totalUsers,
        scoredUsers,
        scoreBuckets,
      },
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: '获取统计失败', error: err.message });
  }
});

/**
 * POST /v1/admin/score/recalculate-all
 * 批量重算所有用户评分
 */
router.post('/recalculate-all', (req, res) => {
  const db = req.app.get('db');
  try {
    const users = db.prepare('SELECT id FROM users').all();
    let updated = 0;
    for (const u of users) {
      scoreEngine.recalculateAndSave(u.id, db);
      updated++;
    }
    res.json({ code: 0, message: `已重算 ${updated} 个用户评分`, data: { count: updated } });
  } catch (err) {
    res.status(500).json({ code: -1, message: '批量重算失败', error: err.message });
  }
});

module.exports = router;
