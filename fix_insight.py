# 修复 handleInsight 函数中的 Prisma include 错误
# 运行：python3 fix_insight.py

import re

filepath = '/home/ubuntu/renrenmeihao-api/dist/routes/admin-referral.js'

with open(filepath, 'r') as f:
    content = f.read()

# 替换 include 中错误的 referrerId 和 refereeId 关系字段
# 1. 修改 referral_codes.findUnique 的 include
old_include1 = '''        const referralCode = await prisma_1.default.referral_codes.findUnique({
            where: { code },'''

new_include1 = '''        const referralCode = await prisma_1.default.referral_codes.findUnique({
            where: { code },
            include: {
                usageLogs: {
                    orderBy: { created_at: 'desc' },
                    take: 50,
                }
            }'''

content = content.replace(old_include1, new_include1)

# 2. 找到旧的 include 并移除 referrerId 部分 (在 referral_codes.findUnique 之后还有一个 include)
# 移除旧的 complete include 块
# 实际上是同一个 include 已经替换了，但包含了两层 include (referrerId + usageLogs)
# 现在 usageLogs 保留了，referrerId 移除了

# 3. 修改 referral_relationships.findMany 的 include
old_relationships = '''        const relationships = await prisma_1.default.referral_relationships.findMany({
            where: { referrerCode: code },
            orderBy: { created_at: 'desc' },
            take: 50,
            include: {
                refereeId: { select: { id: true, nickname: true, wechatAccount: true, phone: true } }
            }
        });'''

new_relationships = '''        const relationships = await prisma_1.default.referral_relationships.findMany({
            where: { referrerCode: code },
            orderBy: { created_at: 'desc' },
            take: 50,
        });'''

content = content.replace(old_relationships, new_relationships)

# 4. 添加独立查询 referrerInfo 的代码
# 在 referral_codes.findUnique 之后和 relationships 查询之前添加
old_after_findcode = '''        if (!referralCode)
            return (0, response_1.error)(res, '推荐码不存在', 404);
        // 查询推荐关系'''

new_after_findcode = '''        if (!referralCode)
            return (0, response_1.error)(res, '推荐码不存在', 404);
        // 查询推荐人信息
        let referrerInfo = null;
        if (referralCode.referrerId) {
            try {
                referrerInfo = await prisma_1.default.users.findUnique({
                    where: { id: Number(referralCode.referrerId) },
                    select: { id: true, nickname: true, wechatAccount: true, phone: true, role: true }
                });
            } catch (e) {}
        }
        // 查询推荐关系'''

content = content.replace(old_after_findcode, new_after_findcode)

# 5. 修改 code_info 中引用 referralCode.users 的地方
content = content.replace('referrer_name: referralCode.users?.nickname || null,', 'referrer_name: referrerInfo?.nickname || null,')
content = content.replace('referrer_wechat: referralCode.users?.wechatAccount || null,', 'referrer_wechat: referrerInfo?.wechatAccount || null,')
content = content.replace('referrer_phone: referralCode.users?.phone || null,', 'referrer_phone: referrerInfo?.phone || null,')

# 6. 修改 usage_logs 中引用 log.users 的地方
content = content.replace('user_nickname: log.users?.nickname,', 'user_nickname: null,')

# 7. 修改 referral_chain 和 referred_users 中引用 r.refereeId 的地方（改为单独查询）
# 在 relationships 之后添加批量查询用户信息
old_after_rel = '''        const typeMap = {
            'public_welfare': '公益推荐官',
            'creator': '联创推荐官',
            'professional': '专业推荐官',
            'community_station': '社区服务站',
            'city_partner': '城市合伙人'
        };'''

new_after_rel = '''        // 批量查询被推荐人信息
        const refereeIds = relationships.map(r => Number(r.refereeId)).filter(Boolean);
        let refereeMap = {};
        if (refereeIds.length > 0) {
            try {
                const referees = await prisma_1.default.users.findMany({
                    where: { id: { in: refereeIds } },
                    select: { id: true, nickname: true, wechatAccount: true, phone: true }
                });
                referees.forEach(u => { refereeMap[u.id] = u; });
            } catch (e) {}
        }
        const typeMap = {
            'public_welfare': '公益推荐官',
            'creator': '联创推荐官',
            'professional': '专业推荐官',
            'community_station': '社区服务站',
            'city_partner': '城市合伙人'
        };'''

content = content.replace(old_after_rel, new_after_rel)

# 8. 修改 referral_chain 中引用 r.refereeId 的地方
content = content.replace('''                id: r.refereeId,
                nickname: r.refereeId?.nickname,
                wechatAccount: r.refereeId?.wechatAccount,''', '''                id: r.refereeId,
                nickname: refereeMap[Number(r.refereeId)]?.nickname,
                wechatAccount: refereeMap[Number(r.refereeId)]?.wechatAccount,''')

# 9. 修改 referred_users 中引用 r.refereeId 的地方
content = content.replace('''                id: r.refereeId,
                nickname: r.refereeId?.nickname,
                wechatAccount: r.refereeId?.wechatAccount,
                phone: r.refereeId?.phone,''', '''                id: r.refereeId,
                nickname: refereeMap[Number(r.refereeId)]?.nickname,
                wechatAccount: refereeMap[Number(r.refereeId)]?.wechatAccount,
                phone: refereeMap[Number(r.refereeId)]?.phone,''')

with open(filepath, 'w') as f:
    f.write(content)

print('修复完成！文件已更新')
