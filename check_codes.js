const p = require('/home/ubuntu/renrenmeihao-api/dist/models/prisma').default;

async function main() {
  // 查看用户 32 (冬韵) 的推荐码
  const codes = await p.referral_codes.findMany({
    where: { referrerId: 32 },
    orderBy: { created_at: 'asc' }
  });
  console.log('用户 32 (冬韵) 的推荐码:');
  codes.forEach(c => console.log(`  ID:${c.id} 码:${c.code} 类型:${c.codeType} 状态:${c.status} 创建时间:${c.created_at}`));

  // 查看特定推荐码
  const specificCodes = ['GYRGFZ13', 'GYRGP9P2', 'GYRG7C1G'];
  for (const code of specificCodes) {
    const c = await p.referral_codes.findUnique({ where: { code } });
    if (c) {
      console.log(`${code}: referrerId=${c.referrerId}, codeType=${c.codeType}, status=${c.status}`);
    } else {
      console.log(`${code}: 不存在`);
    }
  }

  // 查看 recommend_officers 表
  const officers = await p.recommend_officers.findMany({ where: { userId: 32 } });
  console.log('\n用户 32 的 recommend_officers 记录:');
  officers.forEach(o => console.log(`  ID:${o.id} type:${o.type} status:${o.status} created:${o.created_at}`));

  await p.$disconnect();
}

main().catch(e => console.error(e));
