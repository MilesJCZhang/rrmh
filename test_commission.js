/**
 * 测试佣金引擎脚本
 * 用法: node test_commission.js
 */
const { processCommission } = require('./commission_engine');
const { getPool } = require('./config');

async function runTests() {
  const pool = await getPool();
  const conn = await pool.getConnection();

  try {
    console.log('='.repeat(60));
    console.log('佣金引擎测试 - v5.1');
    console.log('='.repeat(60));

    // ============================================
    // 测试1: 联创B入驻（订单101）- 第1个联创，无佣金
    // 期望: 无佣金记录（第一个联创无推荐佣金）
    // ============================================
    console.log('\n【测试1】联创B入驻（订单101）- 第1个联创');
    console.log('期望: 无佣金记录');
    try {
      await processCommission({
        orderId: 101,
        payerId: 102,
        payType: 'partner_matchmaker',
        totalAmount: 399,
        referrerId: 101,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试2: 普通会员I建档（订单102）- 推荐人=公益A
    // 期望: 公益A得 99 元
    // ============================================
    console.log('\n【测试2】普通会员I建档（订单102）- 推荐人=公益A');
    console.log('期望: 公益A得 99 元佣金');
    try {
      await processCommission({
        orderId: 102,
        payerId: 109,
        payType: 'single_registration',
        totalAmount: 199,
        referrerId: 101,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试3: 普通会员J建档（订单103）- 推荐人=联创B
    // 期望: 联创B得 99 元，有沉淀分配
    // ============================================
    console.log('\n【测试3】普通会员J建档（订单103）- 推荐人=联创B');
    console.log('期望: 联创B得 99 元佣金 + 沉淀分配');
    try {
      await processCommission({
        orderId: 103,
        payerId: 110,
        payType: 'single_registration',
        totalAmount: 199,
        referrerId: 102,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试4: 普通会员K建档（订单104）- 推荐人=社区服务站E
    // 期望: 社区E得 99 元，联创B(社区的上级)得沉淀
    // ============================================
    console.log('\n【测试4】普通会员K建档（订单104）- 推荐人=社区服务站E');
    console.log('期望: 社区E得 99 元 + 联创B得沉淀');
    try {
      await processCommission({
        orderId: 104,
        payerId: 111,
        payType: 'single_registration',
        totalAmount: 199,
        referrerId: 105,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试5: 联创C入驻（订单105）- 推荐人=联创B，第2个联创
    // 期望: 联创B得 399 元佣金
    // ============================================
    console.log('\n【测试5】联创C入驻（订单105）- 第2个联创');
    console.log('期望: 联创B得 399 元佣金');
    try {
      await processCommission({
        orderId: 105,
        payerId: 103,
        payType: 'partner_matchmaker',
        totalAmount: 399,
        referrerId: 102,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试6: 联创D入驻（订单106）- 推荐人=联创B，第3个联创
    // 期望: 联创B得 399 元佣金
    // ============================================
    console.log('\n【测试6】联创D入驻（订单106）- 第3个联创');
    console.log('期望: 联创B得 399 元佣金');
    try {
      await processCommission({
        orderId: 106,
        payerId: 104,
        payType: 'partner_matchmaker',
        totalAmount: 399,
        referrerId: 102,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试7: 城市合伙人G自荐（订单107）- 第1个城市合伙人
    // 期望: G得沉淀 7000 元 (70%)
    // ============================================
    console.log('\n【测试7】城市合伙人G自荐（订单107）- 第1个城市合伙人');
    console.log('期望: 城市合伙人G得沉淀 7000 元');
    try {
      await processCommission({
        orderId: 107,
        payerId: 107,
        payType: 'city_franchisee',
        totalAmount: 10000,
        referrerId: null,  // 自荐
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试8: 专业推荐官F入驻（订单109）- 第1个专业
    // 期望: 无佣金（第一个专业无推荐佣金）
    // ============================================
    console.log('\n【测试8】专业推荐官F入驻（订单109）- 第1个专业');
    console.log('期望: 无佣金记录');
    try {
      await processCommission({
        orderId: 109,
        payerId: 106,
        payType: 'professional_recommender',
        totalAmount: 3999,
        referrerId: 101,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试9: 城市合伙人H入驻（订单108）- 专业F推荐，第2个城市
    // 期望: 专业F得 10000 元 + 3%沉淀(300元)
    // ============================================
    console.log('\n【测试9】城市合伙人H入驻（订单108）- 专业F推荐，第2个城市');
    console.log('期望: 专业F得 10000 元 + 3%沉淀 300 元');
    try {
      await processCommission({
        orderId: 108,
        payerId: 108,
        payType: 'city_franchisee',
        totalAmount: 10000,
        referrerId: 106,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    // ============================================
    // 测试10: 普通会员L建档（订单110）- 推荐人=联创B，第2个建档
    // 期望: 联创B得 99 元
    // ============================================
    console.log('\n【测试10】普通会员L建档（订单110）- 联创B的第2个建档');
    console.log('期望: 联创B得 99 元佣金');
    try {
      await processCommission({
        orderId: 110,
        payerId: 112,
        payType: 'single_registration',
        totalAmount: 199,
        referrerId: 102,
      }, pool);
      console.log('✅ 执行完成');
    } catch (e) {
      console.log('❌ 错误:', e.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试执行完成！');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('测试脚本错误:', err);
  } finally {
    conn.release();
  }
}

runTests();
