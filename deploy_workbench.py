#!/usr/bin/env python3
"""Deploy workbench API to production server"""
import os, sys, base64

# The visitor route file content (TypeScript)
visitor_ts = """import { Router } from 'express';
import { success, error } from '../utils/response';
import { default as prisma } from '../models/prisma';

const router = Router();

router.post('/visitor-log', async (req, res) => {
  try {
    const { referrer_code, visitor_openid, visitor_nickname, visitor_avatar } = req.body;
    if (!referrer_code || !visitor_openid) return error(res, '\u63a8\u8350\u7801\u548c\u8bbf\u5ba2openid\u4e0d\u80fd\u4e3a\u7a7a', 400);
    const codeRecord = await prisma.referralCode.findFirst({
      where: { code: String(referrer_code).toUpperCase(), status: 'active', referrerId: { not: null } },
    });
    if (!codeRecord || !codeRecord.referrerId) return error(res, '\u63a8\u8350\u7801\u65e0\u6548\u6216\u672a\u5173\u8054\u63a8\u8350\u5b98', 400);
    const [existing] = await prisma.$queryRawUnsafe('SELECT id FROM visitor_logs WHERE visitor_openid = ? AND referrer_id = ? LIMIT 1', visitor_openid, codeRecord.referrerId);
    if (existing && existing[0] && existing[0].id) {
      await prisma.$executeRawUnsafe('UPDATE visitor_logs SET visit_time = NOW(), updated_at = NOW() WHERE id = ?', existing[0].id);
      return success(res, { id: existing[0].id, updated: true }, '\u66f4\u65b0\u5230\u8bbf\u65f6\u95f4\u6210\u529f');
    }
    await prisma.$executeRawUnsafe('INSERT INTO visitor_logs (referrer_id, referrer_code, visitor_openid, visitor_nickname, visitor_avatar) VALUES (?, ?, ?, ?, ?)', codeRecord.referrerId, String(referrer_code).toUpperCase(), visitor_openid, visitor_nickname || '', visitor_avatar || '');
    success(res, { id: 0 }, '\u8bb0\u5f55\u8bbf\u5ba2\u6210\u529f');
  } catch (err) {
    console.error('[visitor-log] error:', err);
    error(res, '\u8bb0\u5f55\u8bbf\u5ba2\u5931\u8d25', 500);
  }
});

router.put('/visitor-update', async (req, res) => {
  try {
    const { visitor_openid, reg_status, referrer_code } = req.body;
    if (!visitor_openid || !reg_status) return error(res, '\u53c2\u6570\u4e0d\u5b8c\u6574', 400);
    if (!['registered', 'pending'].includes(reg_status)) return error(res, '\u65e0\u6548\u7684\u6ce8\u518c\u72b6\u6001', 400);
    let whereSql = 'visitor_openid = ?';
    let params = [visitor_openid];
    if (referrer_code) { whereSql += ' AND referrer_code = ?'; params.push(String(referrer_code).toUpperCase()); }
    const result = await prisma.$executeRawUnsafe('UPDATE visitor_logs SET reg_status = ?, updated_at = NOW() WHERE ' + whereSql, reg_status, ...params);
    success(res, { updated: result > 0 }, result > 0 ? '\u66f4\u65b0\u6210\u529f' : '\u672a\u627e\u5230\u5339\u914d\u7684\u8bbf\u5ba2\u8bb0\u5f55');
  } catch (err) {
    console.error('[visitor-update] error:', err);
    error(res, '\u66f4\u65b0\u8bbf\u5ba2\u72b6\u6001\u5931\u8d25', 500);
  }
});

export default router;
"""

# The workbench code to append to referral.ts (TypeScript)
workbench_code = """
// ==================== \\u63a8\\u8350\\u5b98\\u5de5\\u4f5c\\u53f0\\u6570\\u636e\\u770b\\u677f ====================
router.get('/workbench-stats', async (req, res) => {
  try {
    const userId = getUserId(req.headers.authorization);
    if (!userId) return error(res, '\\u8bf7\\u5148\\u767b\\u5f55', 401);
    const rels = await prisma.referralRelationship.findMany({ where: { referrerId: userId }, select: { refereeId: true } });
    const ids = rels.map(r => r.refereeId);
    let pc = 0, puc = 0, mc = 0, vc = 0;
    if (ids.length > 0) {
      pc = await prisma.user.count({ where: { id: { in: ids }, role: 'partner_matchmaker' } });
      puc = await prisma.user.count({ where: { id: { in: ids }, role: 'public_matchmaker' } });
      const nu = await prisma.user.findMany({ where: { id: { in: ids }, role: { notIn: ['partner_matchmaker', 'public_matchmaker', 'professional_recommender', 'community_station', 'city_franchisee'] } }, select: { id: true } });
      const nuids = nu.map(u => u.id);
      if (nuids.length > 0) mc = await prisma.payment.count({ where: { userId: { in: nuids }, type: 'archive_fee', status: 1 } });
    }
    try {
      const [vr] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM visitor_logs WHERE referrer_id = ? AND reg_status = ?', userId, 'pending');
      vc = Number(vr && vr[0] ? vr[0].count : 0);
    } catch(e) { vc = 0; }
    success(res, { partner_matchmaker_count: pc, public_matchmaker_count: puc, registered_member_count: mc, visitor_count: vc }, '\\u83b7\\u53d6\\u6210\\u529f');
  } catch (err) { console.error('[workbench-stats] error:', err); error(res, '\\u83b7\\u53d6\\u7edf\\u8ba1\\u6570\\u636e\\u5931\\u8d25', 500); }
});

router.get('/workbench-detail', async (req, res) => {
  try {
    const userId = getUserId(req.headers.authorization);
    if (!userId) return error(res, '\\u8bf7\\u5148\\u767b\\u5f55', 401);
    const type = req.query.type || 'partner_matchmaker';
    const pn = Math.max(1, parseInt(req.query.page || '1'));
    const ps = Math.min(50, Math.max(1, parseInt(req.query.page_size || '10')));
    const ofs = (pn - 1) * ps;
    const kw = req.query.keyword || '';
    const sf = kw ? { nickname: { contains: kw } } : {};
    const rels = await prisma.referralRelationship.findMany({ where: { referrerId: userId }, select: { refereeId: true } });
    const ids = rels.map(r => r.refereeId);
    if (ids.length === 0 && type !== 'visitor') return success(res, { list: [], total: 0, page: pn, page_size: ps, has_more: false });
    let list = [], total = 0;
    if (type === 'partner_matchmaker') {
      const wh = { id: { in: ids }, role: 'partner_matchmaker', ...sf };
      total = await prisma.user.count({ where: wh });
      const users = await prisma.user.findMany({ where: wh, skip: ofs, take: ps, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
      list = users.map(u => ({ id: u.id, name: u.nickname || '\\u672a\\u8bbe\\u7f6e', avatar: u.avatar || '', role: u.role, joinTime: u.createdAt ? u.createdAt.toISOString().split('T')[0] : '' }));
    } else if (type === 'public_matchmaker') {
      const wh = { id: { in: ids }, role: 'public_matchmaker', ...sf };
      total = await prisma.user.count({ where: wh });
      const users = await prisma.user.findMany({ where: wh, skip: ofs, take: ps, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
      list = users.map(u => ({ id: u.id, name: u.nickname || '\\u672a\\u8bbe\\u7f6e', avatar: u.avatar || '', role: u.role, joinTime: u.createdAt ? u.createdAt.toISOString().split('T')[0] : '' }));
    } else if (type === 'registered_member') {
      const nu = await prisma.user.findMany({ where: { id: { in: ids }, ...sf, role: { notIn: ['partner_matchmaker', 'public_matchmaker', 'professional_recommender', 'community_station', 'city_franchisee'] } }, select: { id: true } });
      const nuids = nu.map(u => u.id);
      if (nuids.length > 0) {
        const pms = await prisma.payment.findMany({ where: { userId: { in: nuids }, type: 'single_registration', status: 1 }, select: { userId: true, paidAt: true } });
        const paidIds = [...new Set(pms.map(p => p.userId))];
        total = paidIds.length;
        const pagIds = paidIds.slice(ofs, ofs + ps);
        if (pagIds.length > 0) {
          const users = await prisma.user.findMany({ where: { id: { in: pagIds } }, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true } });
          const pmap = new Map(pms.map(p => [p.userId, p.paidAt]));
          users.sort((a, b) => (pmap.get(b.id)?.getTime() || 0) - (pmap.get(a.id)?.getTime() || 0));
          list = users.map(u => ({ id: u.id, name: u.nickname || '\\u672a\\u8bbe\\u7f6e', avatar: u.avatar || '', role: u.role, joinTime: pmap.get(u.id) ? pmap.get(u.id).toISOString().split('T')[0] : '' }));
        }
      }
    } else if (type === 'visitor') {
      try {
        const cp = kw ? [userId, 'pending', '%' + kw + '%'] : [userId, 'pending'];
        const cs = kw ? 'SELECT COUNT(*) as total FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? AND visitor_nickname LIKE ?' : 'SELECT COUNT(*) as total FROM visitor_logs WHERE referrer_id = ? AND reg_status = ?';
        const [cr] = await prisma.$queryRawUnsafe(cs, ...cp);
        total = Number(cr && cr[0] ? cr[0].total : 0);
        const lp = kw ? [userId, 'pending', '%' + kw + '%', ps, ofs] : [userId, 'pending', ps, ofs];
        const ls = kw ? 'SELECT id, visitor_openid, visitor_nickname, visitor_avatar, visit_time FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? AND visitor_nickname LIKE ? ORDER BY visit_time DESC LIMIT ? OFFSET ?' : 'SELECT id, visitor_openid, visitor_nickname, visitor_avatar, visit_time FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? ORDER BY visit_time DESC LIMIT ? OFFSET ?';
        const [rows] = await prisma.$queryRawUnsafe(ls, ...lp);
        list = (rows || []).map(r => ({ id: r.id, visitor_nickname: r.visitor_nickname || '\\u8bbf\\u5ba2', visitor_avatar: r.visitor_avatar || '', visit_time: r.visit_time ? new Date(r.visit_time).toISOString() : '' }));
      } catch(e) { list = []; total = 0; }
    } else return error(res, '\\u65e0\\u6548\\u7684\\u5206\\u7c7b\\u7c7b\\u578b', 400);
    success(res, { list, total, page: pn, page_size: ps, has_more: ofs + ps < total });
  } catch (err) { console.error('[workbench-detail] error:', err); error(res, '\\u67e5\\u8be2\\u660e\\u7ec6\\u5931\\u8d25', 500); }
});
"""

# Encode to base64 to avoid shell escaping
visitor_b64 = base64.b64encode(visitor_ts.encode('utf-8')).decode('ascii')
workbench_b64 = base64.b64encode(workbench_code.encode('utf-8')).decode('ascii')

print("VISITOR_B64=" + visitor_b64)
print("---")
print("WORKBENCH_B64=" + workbench_b64)
