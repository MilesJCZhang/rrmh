// Run on server: node tmp_fix_server.js
const fs = require('fs');
const path = '/home/ubuntu/renrenmeihao-api/src/routes/admin-finance.ts';
let c = fs.readFileSync(path, 'utf8');

// Find the last export default router;
const lastExport = c.lastIndexOf('export default router;');
if (lastExport < 0) { console.log('ERROR: no export found'); process.exit(1); }

// Insert new endpoints before export
const beforeExport = c.substring(0, lastExport);
const afterExport = c.substring(lastExport);

// Check if earnings endpoint already exists
if (c.includes("router.get('/earnings'") || c.includes('router.get("/earnings"')) {
  console.log('WARN: earnings endpoint already exists, skipping section 5');
} else {
  const earningsCode = `
// ========== 5. 收益明细(earnings) ==========
router.get('/earnings', [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('userId').optional().isInt(),
  query('type').optional().isString(),
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const where = {};
    if (req.query.userId) where.userId = parseInt(req.query.userId);
    if (req.query.type) where.type = req.query.type;
    if (req.query.startDate || req.query.endDate) {
      where.created_at = {};
      if (req.query.startDate) where.created_at.gte = new Date(req.query.startDate + 'T00:00:00');
      if (req.query.endDate) where.created_at.lte = new Date(req.query.endDate + 'T23:59:59');
    }
    const [earnings, total] = await Promise.all([
      prisma.earnings.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { created_at: 'desc' } }),
      prisma.earnings.count({ where }),
    ]);
    const userIds = [...new Set(earnings.map(e => e.userId).filter(Boolean))];
    const users = userIds.length > 0 ? await prisma.users.findMany({ where: { id: { in: userIds } } }) : [];
    const userMap = {}; users.forEach(u => { userMap[u.id] = u; });
    const mapped = earnings.map(e => ({
      id: e.id, userId: e.userId, userNickname: (userMap[e.userId]?.nickname) || '',
      userPhone: (userMap[e.userId]?.phone) || '', type: e.type || 'other',
      amount: Number(e.amount) || 0, rate: 0.1,
      status: e.status === 1 ? 'confirmed' : 'pending',
      createdAt: e.created_at ? e.created_at.toISOString() : '',
    }));
    success(res, { list: mapped, total, page, pageSize }, '查询收益明细成功');
  } catch (err) { console.error('[earnings] error:', err); error(res, err.message, 400); }
});

`;
  c = c.substring(0, lastExport) + earningsCode + c.substring(lastExport);
  console.log('Added earnings endpoint');
}

// Check if /withdrawals/:id/approve exists
if (c.includes('withdrawals/:id/approve')) {
  console.log('WARN: /withdrawals/:id/approve already exists');
} else {
  lastExport = c.lastIndexOf('export default router;');
  const approveCode = `
// ========== 6. 提现审核(兼容withdrawal.service) ==========
router.put('/withdrawals/:id/approve', [
  authMiddleware, param('id').isInt(), body('approved').isBoolean(),
], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const status = req.body.approved ? 2 : 3;
    const w = await prisma.withdrawals.findUnique({ where: { id } });
    if (!w) return error(res, '提现记录不存在', 404);
    if (w.status !== 0) return error(res, '只能审核待审核的提现', 400);
    await prisma.withdrawals.update({ where: { id }, data: { status, processedAt: new Date() } });
    success(res, { id, status }, req.body.approved ? '审核通过' : '已拒绝');
  } catch (err) { console.error('[withdrawals/approve] error:', err); error(res, err.message, 400); }
});

`;
  c = c.substring(0, lastExport2) + approveCode + c.substring(lastExport2);
  console.log('Added /withdrawals/:id/approve endpoint');
}

// Check if /withdrawals/:id/mark-paid exists
let lastExport3 = c.lastIndexOf('export default router;');
if (c.includes('withdrawals/:id/mark-paid')) {
  console.log('WARN: /withdrawals/:id/mark-paid already exists');
} else {
  const markPaidCode = `
// ========== 7. 标记已打款 ==========
router.put('/withdrawals/:id/mark-paid', [
  authMiddleware, param('id').isInt(),
], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const w = await prisma.withdrawals.findUnique({ where: { id } });
    if (!w) return error(res, '提现记录不存在', 404);
    if (w.status !== 2) return error(res, '只能标记已审核通过的提现', 400);
    await prisma.withdrawals.update({ where: { id }, data: { status: 1, processedAt: new Date() } });
    success(res, { id }, '已标记为打款完成');
  } catch (err) { console.error('[withdrawals/mark-paid] error:', err); error(res, err.message, 400); }
});

`;
  c = c.substring(0, lastExport3) + markPaidCode + c.substring(lastExport3);
  console.log('Added /withdrawals/:id/mark-paid endpoint');
}

fs.writeFileSync(path, c);
console.log('File written successfully');

// Verify
const { execSync } = require('child_process');
try {
  const o = execSync('cd /home/ubuntu/renrenmeihao-api && npx tsc --noEmit 2>&1', { encoding: 'utf8', maxBuffer: 1024*1024 });
  const adminErrs = o.split('\n').filter(l => l.includes('admin-finance'));
  if (adminErrs.length) console.log('Errors:', adminErrs.join('\n'));
  else console.log('No admin-finance errors');
} catch(e) {
  const o = (e.stdout || '') + (e.stderr || '');
  const adminErrs = o.split('\n').filter(l => l.includes('admin-finance'));
  if (adminErrs.length) console.log('Errors:', adminErrs.join('\n'));
  else console.log('TSC failed for non-admin-finance reasons');
}
