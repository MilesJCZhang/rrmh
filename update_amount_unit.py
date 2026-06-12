# 修复 total_amount 单位为分，修复精度
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'r') as f:
    content = f.read()

# 将 total_amount 累加改为分单位
old_amount = "typeMap[t].total_amount += Number(o.amount || 0);"
new_amount = "typeMap[t].total_amount += Math.round(Number(o.amount || 0) * 100);"
content = content.replace(old_amount, new_amount)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/admin.js', 'w') as f:
    f.write(content)

print('total_amount 单位已改为分')
