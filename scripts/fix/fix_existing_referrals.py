# 为已申请公益推荐官但未生成推荐码的用户补发推荐码
const p = require('./dist/models/prisma').default;

async function fix() {
  // 查找 role 为 public_matchmaker 但没有 recommendCode 的用户
  const users = await p.users.findMany({
    where: { role: 'public_matchmaker', recommendCode: null }
  });
  
  console.log('需要补发推荐码的公益推荐官数量:', users.length);
  
  var prefixMap = { public_welfare: 'GYRG', creator: 'LCRG', professional: 'ZYRG', community_station: 'SQZD', city_partner: 'CSHH' };
  var generateReferralCode = function(codeType) {
    var p = prefixMap[codeType] || 'GYRG';
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 4; i++) { s += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return p + s;
  };
  
  for (var u of users) {
    var genCode = generateReferralCode('public_welfare');
    var attempts = 0;
    while (await p.referral_codes.findUnique({ where: { code: genCode } })) {
      genCode = generateReferralCode('public_welfare');
      attempts++;
      if (attempts > 10) break;
    }
    try {
      await p.referral_codes.create({
        data: { code: genCode, codeType: 'public_welfare', status: 'active', referrerId: u.id, maxUses: 0 }
      });
      await p.users.update({ where: { id: u.id }, data: { recommendCode: genCode } });
      console.log('已为用户', u.id, u.nickname, '补发推荐码:', genCode);
    } catch (err) {
      console.error('用户', u.id, '补发失败:', err.message);
    }
  }
  
  console.log('补发完成');
  await p.\$disconnect();
}

fix().catch(e => console.error('错误:', e));
