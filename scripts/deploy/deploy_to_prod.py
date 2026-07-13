#!/usr/bin/env python3
"""Generate TypeScript code for server deployment"""
import base64, json

# ===== referral-visitor.ts =====
visitor_ts = r'''
import { Router } from 'express';
import { success, error } from '../utils/response';
import { default as prisma } from '../models/prisma';

const router = Router();

router.post('/visitor-log', async (req, res) => {
  try {
    const { referrer_code, visitor_openid, visitor_nickname, visitor_avatar } = req.body;
    if (!referrer_code || !visitor_openid) return error(res, '推荐码和访客openid不能为空', 400);
    const codeRecord = await prisma.referralCode.findFirst({
      where: { code: String(referrer_code).toUpperCase(), status: 'active', referrerId: { not: null } },
    });
    if (!codeRecord || !codeRecord.referrerId) return error(res, '推荐码无效或未关联推荐官', 400);
    const existing = await prisma.$queryRawUnsafe<[{id: number}?]>('SELECT id FROM visitor_logs WHERE visitor_openid = ? AND referrer_id = ? LIMIT 1', visitor_openid, codeRecord.referrerId);
    if (existing && existing.length > 0 && existing[0]?.id) {
      await prisma.$executeRawUnsafe('UPDATE visitor_logs SET visit_time = NOW(), updated_at = NOW() WHERE id = ?', existing[0].id);
      return success(res, { id: existing[0].id, updated: true }, '更新到访时间成功');
    }
    await prisma.$executeRawUnsafe(
      'INSERT INTO visitor_logs (referrer_id, referrer_code, visitor_openid, visitor_nickname, visitor_avatar) VALUES (?, ?, ?, ?, ?)',
      codeRecord.referrerId, String(referrer_code).toUpperCase(), visitor_openid, visitor_nickname || '', visitor_avatar || ''
    );
    success(res, { id: 0 }, '记录访客成功');
  } catch (err: any) {
    console.error('[visitor-log] error:', err);
    error(res, '记录访客失败', 500);
  }
});

router.put('/visitor-update', async (req, res) => {
  try {
    const { visitor_openid, reg_status, referrer_code } = req.body;
    if (!visitor_openid || !reg_status) return error(res, '参数不完整', 400);
    if (!['registered', 'pending'].includes(reg_status)) return error(res, '无效的注册状态', 400);
    let whereSql = 'visitor_openid = ?';
    const params: any[] = [visitor_openid];
    if (referrer_code) { whereSql += ' AND referrer_code = ?'; params.push(String(referrer_code).toUpperCase()); }
    const result = await prisma.$executeRawUnsafe(
      'UPDATE visitor_logs SET reg_status = ?, updated_at = NOW() WHERE ' + whereSql,
      reg_status, ...params
    );
    success(res, { updated: result > 0 }, result > 0 ? '更新成功' : '未找到匹配的访客记录');
  } catch (err: any) {
    console.error('[visitor-update] error:', err);
    error(res, '更新访客状态失败', 500);
  }
});

export default router;
'''.strip()

# ===== Workbench code to append to referral.ts =====
workbench_ts = r'''

// ==================== 推荐官工作台数据看板 ====================

router.get('/workbench-stats', async (req, res) => {
  try {
    const userId = getUserId(req.headers.authorization);
    if (!userId) return error(res, '请先登录', 401);
    const rels = await prisma.referralRelationship.findMany({ where: { referrerId: userId }, select: { refereeId: true } });
    const refIds = rels.map(r => r.refereeId);
    let partnerCount = 0, publicCount = 0, memberCount = 0, visitorCount = 0;
    if (refIds.length > 0) {
      partnerCount = await prisma.user.count({ where: { id: { in: refIds }, role: 'partner_matchmaker' } });
      publicCount = await prisma.user.count({ where: { id: { in: refIds }, role: 'public_matchmaker' } });
      const nonMatchmaker = await prisma.user.findMany({ where: { id: { in: refIds }, role: { notIn: ['partner_matchmaker', 'public_matchmaker', 'professional_recommender', 'community_station', 'city_franchisee'] } }, select: { id: true } });
      const nuids = nonMatchmaker.map(u => u.id);
      if (nuids.length > 0) memberCount = await prisma.payment.count({ where: { userId: { in: nuids }, type: 'archive_fee', status: 1 } });
    }
    try {
      const r = await prisma.$queryRawUnsafe<[{count: number}]>('SELECT COUNT(*) as count FROM visitor_logs WHERE referrer_id = ? AND reg_status = ?', userId, 'pending');
      visitorCount = Number(r && r[0] ? r[0].count : 0);
    } catch(e) { visitorCount = 0; }
    success(res, { partner_matchmaker_count: partnerCount, public_matchmaker_count: publicCount, registered_member_count: memberCount, visitor_count: visitorCount }, '获取成功');
  } catch (err: any) { console.error('[workbench-stats] error:', err); error(res, '获取统计数据失败', 500); }
});

router.get('/workbench-detail', async (req, res) => {
  try {
    const userId = getUserId(req.headers.authorization);
    if (!userId) return error(res, '请先登录', 401);
    const type = (req.query.type as string) || 'partner_matchmaker';
    const page = Math.max(1, parseInt(req.query.page as string || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size as string || '10')));
    const offset = (page - 1) * pageSize;
    const keyword = (req.query.keyword as string) || '';
    const searchFilter = keyword ? { nickname: { contains: keyword } } : {};
    const rels = await prisma.referralRelationship.findMany({ where: { referrerId: userId }, select: { refereeId: true } });
    const refIds = rels.map(r => r.refereeId);
    if (refIds.length === 0 && type !== 'visitor') return success(res, { list: [], total: 0, page, page_size: pageSize, has_more: false });
    let list: any[] = [], total = 0;
    if (type === 'partner_matchmaker') {
      const where = { id: { in: refIds }, role: 'partner_matchmaker', ...searchFilter };
      total = await prisma.user.count({ where });
      const users = await prisma.user.findMany({ where, skip: offset, take: pageSize, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
      list = users.map(u => ({ id: u.id, name: u.nickname || '未设置', avatar: u.avatar || '', role: u.role, joinTime: u.createdAt ? u.createdAt.toISOString().split('T')[0] : '' }));
    } else if (type === 'public_matchmaker') {
      const where = { id: { in: refIds }, role: 'public_matchmaker', ...searchFilter };
      total = await prisma.user.count({ where });
      const users = await prisma.user.findMany({ where, skip: offset, take: pageSize, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
      list = users.map(u => ({ id: u.id, name: u.nickname || '未设置', avatar: u.avatar || '', role: u.role, joinTime: u.createdAt ? u.createdAt.toISOString().split('T')[0] : '' }));
    } else if (type === 'registered_member') {
      const regularUsers = await prisma.user.findMany({ where: { id: { in: refIds }, ...searchFilter, role: { notIn: ['partner_matchmaker', 'public_matchmaker', 'professional_recommender', 'community_station', 'city_franchisee'] } }, select: { id: true } });
      const regIds = regularUsers.map(u => u.id);
      if (regIds.length > 0) {
        const payments = await prisma.payment.findMany({ where: { userId: { in: regIds }, type: 'single_registration', status: 1 }, select: { userId: true, paidAt: true } });
        const paidIds = [...new Set(payments.map(p => p.userId))];
        total = paidIds.length;
        const paginatedIds = paidIds.slice(offset, offset + pageSize);
        if (paginatedIds.length > 0) {
          const users = await prisma.user.findMany({ where: { id: { in: paginatedIds } }, select: { id: true, nickname: true, avatar: true, role: true, createdAt: true } });
          const paidAtMap = new Map(payments.map(p => [p.userId, p.paidAt]));
          users.sort((a, b) => (paidAtMap.get(b.id)?.getTime() || 0) - (paidAtMap.get(a.id)?.getTime() || 0));
          list = users.map(u => ({ id: u.id, name: u.nickname || '未设置', avatar: u.avatar || '', role: u.role, joinTime: paidAtMap.get(u.id) ? paidAtMap.get(u.id).toISOString().split('T')[0] : '' }));
        }
      }
    } else if (type === 'visitor') {
      try {
        const countParams = keyword ? [userId, 'pending', '%' + keyword + '%'] : [userId, 'pending'];
        const countSql = keyword ? 'SELECT COUNT(*) as total FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? AND visitor_nickname LIKE ?' : 'SELECT COUNT(*) as total FROM visitor_logs WHERE referrer_id = ? AND reg_status = ?';
        const cr = await prisma.$queryRawUnsafe<[{total: number}]>(countSql, ...countParams);
        total = Number(cr && cr[0] ? cr[0].total : 0);
        const listParams = keyword ? [userId, 'pending', '%' + keyword + '%', pageSize, offset] : [userId, 'pending', pageSize, offset];
        const listSql = keyword ? 'SELECT id, visitor_openid, visitor_nickname, visitor_avatar, visit_time FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? AND visitor_nickname LIKE ? ORDER BY visit_time DESC LIMIT ? OFFSET ?' : 'SELECT id, visitor_openid, visitor_nickname, visitor_avatar, visit_time FROM visitor_logs WHERE referrer_id = ? AND reg_status = ? ORDER BY visit_time DESC LIMIT ? OFFSET ?';
        const rows = await prisma.$queryRawUnsafe<Array<{id: number, visitor_openid: string, visitor_nickname: string, visitor_avatar: string, visit_time: Date}>>(listSql, ...listParams);
        list = (rows || []).map(r => ({ id: r.id, visitor_nickname: r.visitor_nickname || '访客', visitor_avatar: r.visitor_avatar || '', visit_time: r.visit_time ? new Date(r.visit_time).toISOString() : '' }));
      } catch(e) { list = []; total = 0; }
    } else return error(res, '无效的分类类型', 400);
    success(res, { list, total, page, page_size: pageSize, has_more: offset + pageSize < total });
  } catch (err: any) { console.error('[workbench-detail] error:', err); error(res, '查询明细失败', 500); }
});
'''.strip()

# Save locally for verification
with open('/tmp/visitor_route.ts', 'w') as f:
    f.write(visitor_ts)
with open('/tmp/workbench_code.ts', 'w') as f:
    f.write(workbench_ts)

print("VISITOR:" + base64.b64encode(visitor_ts.encode()).decode())
print("WORKBENCH:" + base64.b64encode(workbench_ts.encode()).decode())
