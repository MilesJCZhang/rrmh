# 修复订单路由：调整 typeNameMap 位置，修复所有问题
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

# 找到订单路由的完整块（从注释到下一个注释或 exports.default）
start_marker = '// ==================== 订单管理（管理后台）===================='
end_marker = '\nexports.default = router;'

start_idx = content.find(start_marker)

if start_idx == -1:
    print('未找到订单路由')
    exit(1)

# 找到订单详情路由的结束位置
end_idx = content.rfind('});', start_idx)
# 再往后找到真正结束点（有 exports.default 前可能的空行）
exports_idx = content.find('\nexports.default = router;', start_idx)

# 新的完整订单路由代码（修正顺序）
new_route_block = '''
// ==================== 订单管理（管理后台）====================
// 获取订单列表
router.get('/orders', async (req, res) => {
    try {
        var typeNameMap = {};
        typeNameMap['online_unlock_gold'] = '线上解锁(优质)';
        typeNameMap['online_unlock_silver'] = '线上解锁(良好)';
        typeNameMap['salon_signup'] = '沙龙报名';
        typeNameMap['single_registration'] = '会员建档';
        typeNameMap['membership'] = '会员建档';
        typeNameMap['partner_upgrade'] = '合伙人升级';
        typeNameMap['premium_verify'] = '验资服务';
        typeNameMap['fund_custody'] = '基金托管';
        var statusMap = {};
        statusMap['0'] = 'pending';
        statusMap['1'] = 'paid';
        statusMap['2'] = 'refunded';
        statusMap['3'] = 'cancelled';
        var { status, type, page, pageSize, startDate, endDate } = req.query;
        if (!page) page = '1';
        if (!pageSize) pageSize = '20';
        var where = {};
        if (status && status !== '' && status !== 'all') where.status = parseInt(status);
        if (type && type !== 'all') where.type = type;
        if (startDate && endDate) {
            where.created_at = { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') };
        }
        var pageNum = parseInt(page) || 1;
        var pageSizeNum = parseInt(pageSize) || 20;
        var skip = (pageNum - 1) * pageSizeNum;
        var [total, orderRecords] = await Promise.all([
            prisma_1.default.payments.count({ where }),
            prisma_1.default.payments.findMany({
                where: where,
                orderBy: { created_at: 'desc' },
                skip: skip,
                take: pageSizeNum,
                include: { users: { select: { id: true, nickname: true } } }
            })
        ]);
        var typeMap = {};
        for (var oi = 0; oi < orderRecords.length; oi++) {
            var o = orderRecords[oi];
            var t = o.type || 'unknown';
            if (!typeMap[t]) typeMap[t] = { type: typeNameMap[t] || t, count: 0, total_amount: 0 };
            typeMap[t].count++;
            typeMap[t].total_amount += Math.round(Number(o.amount || 0) * 100);
        }
        var mappedOrders = [];
        for (var mi = 0; mi < orderRecords.length; mi++) {
            var or = orderRecords[mi];
            var fee = Number(or.amount || 0);
            var statusStr = statusMap[String(or.status)] || 'pending';
            mappedOrders.push({
                id: or.id,
                user_id: or.userId,
                type: or.type,
                status: statusStr,
                total_fee: Math.round(fee * 100),
                payer_nickname: (or.users && or.users.nickname) || '',
                payer_avatar: '',
                created_at: or.created_at,
            });
        }
        (0, response_1.success)(res, { list: mappedOrders, total: total, page: pageNum, pageSize: pageSizeNum, typeStats: Object.values(typeMap) }, '获取成功');
    } catch (err) {
        console.error('获取订单列表失败:', err);
        (0, response_1.error)(res, '获取失败', 500);
    }
});

// 获取订单详情
router.get('/orders/:id', async (req, res) => {
    try {
        var statusDetailMap = {};
        statusDetailMap['0'] = 'pending';
        statusDetailMap['1'] = 'paid';
        statusDetailMap['2'] = 'refunded';
        statusDetailMap['3'] = 'cancelled';
        const { id } = req.params;
        const order = await prisma_1.default.payments.findFirst({
            where: { OR: [{ id: parseInt(id) || 0 }, { orderNo: id }] },
            include: { users: { select: { id: true, nickname: true } } }
        });
        if (!order) return (0, response_1.error)(res, '订单不存在', 404);
        var fee = Number(order.amount || 0);
        var mapped = {
            id: order.id,
            user_id: order.userId,
            type: order.type,
            status: statusDetailMap[String(order.status)] || 'pending',
            total_fee: Math.round(fee * 100),
            payer_nickname: (order.users && order.users.nickname) || '',
            payer_avatar: '',
            created_at: order.created_at,
        };
        (0, response_1.success)(res, mapped, '获取成功');
    } catch (err) {
        console.error('获取订单详情失败:', err);
        (0, response_1.error)(res, '获取失败', 500);
    }
});
'''

# 替换从 start_marker 到 exports.default 之间的所有内容
old_block = content[start_idx:exports_idx]
content = content.replace(old_block, new_route_block)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('订单路由已完整重写')
