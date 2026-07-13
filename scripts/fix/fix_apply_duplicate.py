# 修复 apply.js 重复推荐码检查逻辑
with open('/home/ubuntu/renrenmeihao-api/dist/routes/apply.js', 'r') as f:
    content = f.read()

old = """        // 6. 生成推荐码
        let finalCode = null;"""

new = """        // 6. 检查用户是否已有推荐码，避免重复
        var existingCheckUser = await prisma_1.default.users.findUnique({ where: { id: userId }, select: { recommendCode: true } });
        if (existingCheckUser && existingCheckUser.recommendCode) {
            console.log('[apply] 用户', userId, '已有推荐码:', existingCheckUser.recommendCode);
            const updatedUser = await prisma_1.default.users.findUnique({ where: { id: userId } });
            return (0, response_1.success)(res, { role: 'public_matchmaker', recommendCode: existingCheckUser.recommendCode }, '申请成功');
        }
        var existingRefCheck = await prisma_1.default.referral_codes.findFirst({
            where: { referrerId: userId, codeType: 'public_welfare' }
        });
        if (existingRefCheck) {
            await prisma_1.default.users.update({ where: { id: userId }, data: { recommendCode: existingRefCheck.code } });
            console.log('[apply] 用户', userId, '已有推荐码记录:', existingRefCheck.code);
            const updatedUser = await prisma_1.default.users.findUnique({ where: { id: userId } });
            return (0, response_1.success)(res, { role: 'public_matchmaker', recommendCode: existingRefCheck.code }, '申请成功');
        }

        // 7. 生成推荐码
        let finalCode = null;"""

content = content.replace(old, new)

# 修改后续编号
content = content.replace('// 7. 获取更新后的用户信息', '// 8. 获取更新后的用户信息')

with open('/home/ubuntu/renrenmeihao-api/dist/routes/apply.js', 'w') as f:
    f.write(content)

print('已修复重复推荐码检查逻辑')
