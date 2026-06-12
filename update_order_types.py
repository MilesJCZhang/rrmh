# 在后端将 type 映射为中文名称
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

# 类型映射函数
type_map_func = '''
        var typeNameMap = {
            'online_unlock_gold': '线上解锁(优质)',
            'online_unlock_silver': '线上解锁(良好)',
            'salon_signup': '沙龙报名',
            'single_registration': '会员建档',
            'membership': '会员建档',
            'partner_upgrade': '合伙人升级',
            'premium_verify': '验资服务',
            'fund_custody': '基金托管',
        };
'''

# 在列表映射中添加类型映射
old_mapped = "var mappedOrders = [];"
new_mapped = type_map_func + "\n        var mappedOrders = [];"

content = content.replace(old_mapped, new_mapped)

# 在 push 中添加中文类型名
old_push = "mappedOrders.push({"
new_push = """            mappedOrders.push({
                type_name: typeNameMap[or.type] || or.type,"""

content = content.replace(old_push, new_push)

# 在 typeStats 中统计时也使用中文类型名
old_typestat = "typeMap[t] = { type: t, count: 0, total_amount: 0 };"
new_typestat = "typeMap[t] = { type: typeNameMap[t] || t, count: 0, total_amount: 0 };"
content = content.replace(old_typestat, new_typestat)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('类型中文映射已添加')
