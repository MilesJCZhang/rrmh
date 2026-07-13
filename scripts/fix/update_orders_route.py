# 更新订单路由，修复数据映射
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

marker = 'exports.default = router;'

# 找到旧的订单路由并替换
new_route = '''
// ==================== 订单管理（管理后台）====================
// 获取订单列表
router.get('/orders', async (req, res) => {
    try {
        const { status, type, page = '1', pageSize = '20', startDate, endDate } = req.query;
        const where = {};
        if (status !== undefined && status !== '' && status !== 'all')
            where.status = parseInt(status);
        if (type && type !== 'all')
            where.type = type;
        if (startDate && endDate) {
            where.created_at = { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') };
        }
        const pageNum = parseInt(page) || 1;
        const pageSizeNum = parseInt(pageSize) || 20;
        const skip = (pageNum - 1) * pageSizeNum;
        const [total, orderRecords] = await Promise.all([
            prisma_1.default.payments.count({ where }),
            prisma_1.default.payments.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: pageSizeNum,
                include: { users: { select: { id: true, nickname: true } } }
            })
        ]);
        // 类型统计
        const typeMap = {};
        for (const o of orderRecords) {
            const t = o.type || 'unknown';
            if (!typeMap[t]) typeMap[t] = { type: t, count: 0, total_amount: 0 };
            typeMap[t].count++;
            typeMap[t].total_amount += Number(o.amount || 0);
        }
        // 映射为前端期望字段
        const mappedOrders = orderRecords.map(function(o) {
            var fee = Number(o.amount || 0);
            return {
                id: o.id,
                user_id: o.userId,
                type: o.type,
                status: String(o.status),
                total_fee: fee * 100,
                payer_nickname: (o.users && o.users.nickname) || '',
                payer_avatar: '',
                created_at: o.created_at,
            };
        });
        (0, response_1.success)(res, { list: mappedOrders, total, page: pageNum, pageSize: pageSizeNum, typeStats: Object.values(typeMap) }, '\u83b7\u53d6\u6210\u529f');
    } catch (err) {
        console.error('\u83b7\u53d6\u8ba2\u5355\u5217\u8868\u5931\u8d25:', err);
        (0, response_1.error)(res, '\u83b7\u53d6\u5931\u8d25', 500);
    }
});

// 获取订单详情
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma_1.default.payments.findFirst({
            where: { OR: [{ id: parseInt(id) || 0 }, { orderNo: id }] },
            include: { users: { select: { id: true, nickname: true } } }
        });
        if (!order) return (0, response_1.error)(res, '\u8ba2\u5355\u4e0d\u5b58\u5728', 404);
        var fee = Number(order.amount || 0);
        var mapped = {
            id: order.id,
            user_id: order.userId,
            type: order.type,
            status: String(order.status),
            total_fee: fee * 100,
            payer_nickname: (order.users && order.users.nickname) || '',
            payer_avatar: '',
            created_at: order.created_at,
        };
        (0, response_1.success)(res, mapped, '\u83b7\u53d6\u6210\u529f');
    } catch (err) {
        console.error('\u83b7\u53d6\u8ba2\u5355\u8be6\u60c5\u5931\u8d25:', err);
        (0, response_1.error)(res, '\u83b7\u53d6\u5931\u8d25', 500);
    }
});
'''

# 移除旧的订单路由
old_pattern = r'// ==================== 订单管理（管理后台）====================.*?// 获取订单详情\nrouter\.get\(\'/orders/:id\'.*?}\);'

if re.search(old_pattern, content, re.DOTALL):
    content = re.sub(old_pattern, '', content, flags=re.DOTALL)
    print('已移除旧订单路由')
else:
    print('未找到旧订单路由，尝试行级替换')

# 在 exports.default 前插入新路由
content = content.replace(marker, new_route + '\n' + marker)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('订单路由更新完成')
print('文件行数:', content.count('\\n'))
