const p = require('/home/ubuntu/renrenmeihao-api/dist/models/prisma').default;

Promise.all([
  p.users.count({ where: { status: 1 } }),
  p.payments.findMany({ where: { status: 1 }, select: { userId: true }, distinct: ['userId'] }).then(r => r.length),
  p.users.count({ where: { role: { not: 'user' }, status: 1 } })
]).then(r => {
  console.log('totalUsers:', r[0]);
  console.log('totalMembers:', r[1]);
  console.log('totalMatchmakers:', r[2]);
  console.log('未支付用户（注册但非会员）:', r[0] - r[1]);
}).catch(e => console.log('Error:', e.message))
.finally(() => p.$disconnect());
