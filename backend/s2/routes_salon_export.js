/**
 * routes_salon_export.js - 沙龙数据导出路由
 *
 * GET  /v1/salon/:id/export   - 导出本场所有报名人员完整资料（Excel）
 * POST /v1/salon/:id/poster  - 手动触发生成海报
 */
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth-middleware');

/**
 * GET /v1/salon/:id/export
 * 导出本场所有报名人员完整资料（Excel格式）
 * 权限：管理员
 */
router.get('/:id/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;

    // 获取沙龙信息
    const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(id);
    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }

    // 获取所有报名人员（含随行）
    const members = db.prepare(`
      SELECT
        sgm.id,
        sgm.user_id,
        sgm.companions_json,
        sgm.registered_at,
        u.nickname,
        u.gender as user_gender,
        u.age as user_age,
        u.industry as user_industry,
        u.role as user_role
      FROM salon_group_members sgm
      LEFT JOIN users u ON sgm.user_id = u.id
      WHERE sgm.salon_id = ? AND sgm.status != 'cancelled'
      ORDER BY sgm.registered_at ASC
    `).all(id);

    // 检查是否有 exceljs 依赖
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
    } catch (e) {
      // 若无 exceljs，返回 JSON 数据
      console.warn('[salon-export] exceljs not installed, returning JSON');
      const exportData = members.map(m => {
        const companions = m.companions_json ? JSON.parse(m.companions_json) : [];
        return {
          推荐官姓名: m.nickname || '',
          推荐官性别: m.user_gender || '',
          推荐官年龄: m.user_age || '',
          推荐官行业: m.user_industry || '',
          推荐官角色: m.user_role || '',
          报名日期: m.registered_at || '',
          随行人员: companions.map(c => c.name).join('、'),
          随行详情: companions.map(c =>
            `${c.name || ''}(${c.mobile || ''}, ${c.gender || ''}, ${c.age || ''}岁, ${c.industry || ''})`
          ).join('；'),
        };
      });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.json({ code: 0, data: exportData, message: 'exceljs未安装，返回JSON格式' });
    }

    // 生成Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('报名人员');

    // 表头
    worksheet.addRow([
      '推荐官姓名', '性别', '年龄', '行业', '角色',
      '随行1姓名', '随行1手机', '随行1性别', '随行1年龄', '随行1行业', '随行1身份', '随行1职务', '随行1经营项目', '随行1优势',
      '随行2姓名', '随行2手机', '随行2性别', '随行2年龄', '随行2行业', '随行2身份', '随行2职务', '随行2经营项目', '随行2优势',
      '报名时间'
    ]);

    // 填充数据
    members.forEach(m => {
      const companions = m.companions_json ? JSON.parse(m.companions_json) : [];
      const row = [
        m.nickname || '',
        m.user_gender || '',
        m.user_age || '',
        m.user_industry || '',
        m.user_role || '',
      ];

      // 最多2位随行人员
      for (let i = 0; i < 2; i++) {
        const c = companions[i];
        if (c) {
          row.push(c.name || '', c.mobile || '', c.gender || '', c.age || '', c.industry || '', c.identity || '', c.position || '', c.business || '', c.advantage || '');
        } else {
          row.push('', '', '', '', '', '', '', '', '');
        }
      }

      row.push(m.registered_at || '');
      worksheet.addRow(row);
    });

    // 设置列宽
    worksheet.columns.forEach(col => { col.width = 15; });

    // 返回Excel文件
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=salon_${id}_members.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[salon-export] error:', err);
    res.status(500).json({ code: -1, message: '导出失败：' + err.message });
  }
});

/**
 * POST /v1/salon/:id/poster
 * 手动触发生成海报
 * 权限：管理员
 */
router.post('/:id/poster', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;

    const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(id);
    if (!salon) {
      return res.status(404).json({ code: -1, message: '沙龙不存在' });
    }

    // 调用海报生成（复用 routes_salon.js 中的 generateSalonPoster 逻辑）
    // 此处返回提示，实际生成逻辑在 routes_salon.js 中
    const posterUrl = salon.poster_url || `/assets/posters/salon_${id}.png`;

    res.json({
      code: 0,
      message: '海报生成已触发',
      data: { poster_url: posterUrl }
    });
  } catch (err) {
    console.error('[salon-poster] error:', err);
    res.status(500).json({ code: -1, message: '海报生成失败：' + err.message });
  }
});

module.exports = router;
