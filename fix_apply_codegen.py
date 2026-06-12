# 修复公益推荐官申请流程，补全推荐码生成逻辑
import re

with open('/home/ubuntu/renrenmeihao-api/dist/routes/apply.js', 'r') as f:
    content = f.read()

# 找到申请成功后的代码位置（在 updatedUser 查询之后，success 返回之前）
old_success_code = """        // 6. 获取更新后的用户信息（包含推荐码）
        const updatedUser = await prisma_1.default.users.findUnique({ where: { id: userId } });

        (0, response_1.success)(res, { role: 'public_matchmaker', recommendCode: updatedUser?.recommendCode }, '申请成功，已自动通过审核');"""

new_success_code = """        // 6. 生成推荐码
        let finalCode = null;
        try {
            const prefixMap = { 'public_welfare': 'GYRG', 'creator': 'LCRG', 'professional': 'ZYRG', 'community_station': 'SQZD', 'city_partner': 'CSHH' };
            var generateReferralCode = function(codeType) {
                var p = prefixMap[codeType] || 'GYRG';
                var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                var s = '';
                for (var i = 0; i < 4; i++) { s += chars.charAt(Math.floor(Math.random() * chars.length)); }
                return p + s;
            };
            var genCode = generateReferralCode('public_welfare');
            var attempts = 0;
            while (await prisma_1.default.referral_codes.findUnique({ where: { code: genCode } })) {
                genCode = generateReferralCode('public_welfare');
                attempts++;
                if (attempts > 10) break;
            }
            await prisma_1.default.referral_codes.create({
                data: {
                    code: genCode,
                    codeType: 'public_welfare',
                    status: 'active',
                    referrerId: userId,
                    maxUses: 0,
                },
            });
            // 更新用户的 recommendCode
            await prisma_1.default.users.update({ where: { id: userId }, data: { recommendCode: genCode } });
            finalCode = genCode;
            console.log('[apply] 已为推荐官用户', userId, '生成推荐码:', genCode);
        } catch (err) {
            console.warn('[apply] 生成推荐码失败:', err.message);
        }

        // 7. 获取更新后的用户信息
        const updatedUser = await prisma_1.default.users.findUnique({ where: { id: userId } });

        (0, response_1.success)(res, { role: 'public_matchmaker', recommendCode: finalCode || updatedUser?.recommendCode }, '申请成功，已自动通过审核');"""

content = content.replace(old_success_code, new_success_code)

with open('/home/ubuntu/renrenmeihao-api/dist/routes/apply.js', 'w') as f:
    f.write(content)

print('公益推荐官申请流程已修复：补全推荐码生成逻辑')
