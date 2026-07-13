/**
 * 导出推荐关系树为PDF（简化版）
 * POST /api/referral-codes/export-tree-pdf
 */
router.post('/export-tree-pdf', async (req, res) => {
  const { user_id, max_depth = 5 } = req.body;
  
  if (!user_id) {
    return res.json({ code: -1, message: '缺少用户ID' });
  }

  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    
    // 创建PDF文档
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `referral-tree-${user_id}-${Date.now()}.pdf`;
    const dir = path.join(__dirname, 'public', 'pdfs');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filepath = path.join(dir, filename);
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    
    // 添加标题
    doc.fontSize(20).text('推荐关系树报告', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`用户ID: ${user_id}`, { align: 'center' });
    doc.moveDown(2);
    
    // 获取树数据并写入
    const writeTree = (node, level = 0) => {
      if (!node) return;
      const indent = '  '.repeat(level);
      const prefix = level === 0 ? '● ' : '├─ ';
      const text = `${indent}${prefix}${node.name} (${node.role})${node.code ? ' [' + node.code + ']' : ''}`;
      doc.fontSize(10).text(text);
      
      if (node.children) {
        node.children.forEach(child => writeTree(child, level + 1));
      }
    };
    
    // 获取树数据
    const getTree = async (userId, depth = 0) => {
      if (depth >= max_depth) return null;
      
      const downlines = await new Promise((resolve, reject) => {
        db.all(`
          SELECT rr.referee_id, u.nickname, u.role, rc.code as user_code
          FROM referral_relationships rr
          LEFT JOIN users u ON u.id = rr.referee_id
          LEFT JOIN referral_codes rc ON rc.referrer_id = rr.referee_id AND rc.status = 'active'
          WHERE rr.referrer_id = ? AND rr.status = 'active'
        `, [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      if (downlines.length === 0) return null;
      
      const children = [];
      for (const downline of downlines) {
        const child = {
          id: downline.referee_id,
          name: downline.nickname || '用户' + downline.referee_id,
          role: downline.role || 'user',
          code: downline.user_code || '',
          children: null
        };
        
        if (depth < max_depth - 1) {
          child.children = await getTree(downline.referee_id, depth + 1);
        }
        
        children.push(child);
      }
      
      return children;
    };
    
    const rootUser = await new Promise((resolve, reject) => {
      db.get(`
        SELECT u.*, rc.code
        FROM users u
        LEFT JOIN referral_codes rc ON rc.referrer_id = u.id AND rc.status = 'active'
        WHERE u.id = ?
      `, [user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (rootUser) {
      const tree = {
        id: rootUser.id,
        name: rootUser.nickname || '用户' + rootUser.id,
        role: rootUser.role || 'user',
        code: rootUser.code || '',
        level: 0,
        children: await getTree(user_id, 0)
      };
      
      writeTree(tree);
    }
    
    doc.end();
    
    stream.on('finish', () => {
      const pdfUrl = `${req.protocol}://${req.get('host')}/public/pdfs/${filename}`;
      res.json({
        code: 0,
        pdf_url: pdfUrl,
        message: 'PDF生成成功'
      });
    });
    
  } catch (err) {
    console.error('[referral-codes] 导出PDF失败:', err);
    res.json({ code: -1, message: '导出失败：' + err.message });
  }
});

module.exports = router;
