# 修复 MOCK_PAYMENT 模式下 payType 设置
import re

# 修改 1: payment.js - 在 MOCK_PAYMENT 时设置 payType: 'mock'
with open('/home/ubuntu/renrenmeihao-api/dist/routes/payment.js', 'r') as f:
    content = f.read()

# 找到 MOCK_PAYMENT 的 update 代码
old_mock = """            await prisma_1.default.payments.update({
                where: { id: payment.id },
                data: { status: 1, updated_at: new Date() }
            });"""

new_mock = """            await prisma_1.default.payments.update({
                where: { id: payment.id },
                data: { status: 1, payType: 'mock', updated_at: new Date() }
            });"""

content = content.replace(old_mock, new_mock)
print('payment.js 已更新 MOCK_PAYMENT 逻辑')

with open('/home/ubuntu/renrenmeihao-api/dist/routes/payment.js', 'w') as f:
    f.write(content)


# 修改 2: admin.js - 在订单管理路由中排除 mock 记录（默认只显示真实支付）
with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

# 在 where 条件中添加默认排除 mock
# 找到 status/filter 处理代码附近
old_filter = """        if (status && status !== '' && status !== 'all') where.status = parseInt(status);
        if (type && type !== 'all') where.type = type;"""

new_filter = """        if (status && status !== '' && status !== 'all') where.status = parseInt(status);
        if (type && type !== 'all') where.type = type;
        // 默认排除模拟支付记录，只显示真实交易
        where.payType = { not: 'mock' };"""

content = content.replace(old_filter, new_filter)

# 在返回的 mappedOrders 中添加 payType
old_push_fields = """            mappedOrders.push({
                id: or.id,"""
new_push_fields = """            mappedOrders.push({
                id: or.id,
                payType: or.payType || null,"""
content = content.replace(old_push_fields, new_push_fields)

# 同时在订单详情中也返回 payType
old_detail_fields = """        var mapped = {
            id: order.id,"""
new_detail_fields = """        var mapped = {
            id: order.id,
            payType: order.payType || null,"""
content = content.replace(old_detail_fields, new_detail_fields)

# 排除标记可以添加一个查询参数 allowMock，允许管理员查看所有订单
# 在解析 query 参数处
old_query_parse = """        var { status, type, page, pageSize, startDate, endDate } = req.query;"""
new_query_parse = """        var { status, type, page, pageSize, startDate, endDate, showAll } = req.query;
        var includeMock = showAll === 'true';"""
content = content.replace(old_query_parse, new_query_parse)

# 根据 includeMock 决定是否排除 mock
old_where_paytype = """        where.payType = { not: 'mock' };"""
new_where_paytype = """        if (!includeMock) where.payType = { not: 'mock' };"""
content = content.replace(old_where_paytype, new_where_paytype)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('admin.js 已更新订单筛选逻辑')
print('修复完成')
