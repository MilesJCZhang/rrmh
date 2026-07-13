# 修复订单路由中的状态映射和金额精度
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

# 状态映射：数字 -> 可读字符串
# 旧代码：status: String(or.status),
new_status1 = "status: or.status === 0 || or.status === '0' || !or.status ? 'pending' : or.status === 1 || or.status === '1' ? 'paid' : or.status === 2 || or.status === '2' ? 'refunded' : 'cancelled',"
new_status2 = "status: order.status === 0 || order.status === '0' || !order.status ? 'pending' : order.status === 1 || order.status === '1' ? 'paid' : order.status === 2 || order.status === '2' ? 'refunded' : 'cancelled',"

# 替换第一个和第二个出现的 String(or.status)
count = 0
def replace_status(m):
    global count
    count += 1
    if count == 1:
        return new_status1
    elif count == 2:
        return new_status2
    return m.group(0)

content = re.sub(r"status: String\(or\.status\),", replace_status, content)
count = 0
content = re.sub(r"status: String\(order\.status\),", replace_status, content)

# 金额取整
content = content.replace("total_fee: f * 100,", "total_fee: Math.round(f * 100),")

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('状态映射和金额精度已修复')
