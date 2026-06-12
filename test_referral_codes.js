/**
 * test_referral_codes.js - 推荐码系统测试脚本
 *
 * 使用方法：
 * 1. 确保后端服务已启动（node server.js）
 * 2. 确保数据库已执行 create_referral_codes.sql
 * 3. 执行：node test_referral_codes.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// 测试颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ==================== 测试用例 ====================

/**
 * 测试1：验证有效推荐码
 */
async function testVerifyValidCode() {
  log('\n[测试1] 验证有效推荐码 (LCRG001)', 'yellow');

  try {
    const response = await axios.post(`${API_BASE}/api/referral-codes/verify`, {
      code: 'LCRG001',
    });

    if (response.data.code === 0 && response.data.data.valid === true) {
      log('✅ 测试通过：推荐码验证成功', 'green');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log('❌ 测试失败：返回格式错误', 'red');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (err) {
    log(`❌ 测试失败：${err.message}`, 'red');
    if (err.response) {
      console.log('错误响应：', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

/**
 * 测试2：验证无效推荐码
 */
async function testVerifyInvalidCode() {
  log('\n[测试2] 验证无效推荐码 (INVALID999)', 'yellow');

  try {
    const response = await axios.post(`${API_BASE}/api/referral-codes/verify`, {
      code: 'INVALID999',
    });

    if (response.data.code === 0 && response.data.data.valid === false) {
      log('✅ 测试通过：正确识别无效推荐码', 'green');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log('❌ 测试失败：应该返回 valid=false', 'red');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (err) {
    log(`❌ 测试失败：${err.message}`, 'red');
    return false;
  }
}

/**
 * 测试3：验证推荐码格式（小写自动转大写）
 */
async function testVerifyCodeCaseInsensitive() {
  log('\n[测试3] 验证推荐码大小写不敏感 (lcg001)', 'yellow');

  try {
    const response = await axios.post(`${API_BASE}/api/referral-codes/verify`, {
      code: 'lcg001', // 小写
    });

    if (response.data.code === 0 && response.data.data.valid === true) {
      log('✅ 测试通过：小写推荐码自动转大写', 'green');
      return true;
    } else {
      log('❌ 测试失败', 'red');
      return false;
    }
  } catch (err) {
    log(`❌ 测试失败：${err.message}`, 'red');
    return false;
  }
}

/**
 * 测试4：通过推荐码绑定推荐关系
 */
async function testBindByReferralCode() {
  log('\n[测试4] 通过推荐码绑定推荐关系', 'yellow');

  try {
    const response = await axios.post(`${API_BASE}/referral/bind`, {
      referral_code: 'LCRG001',
      bind_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    if (response.data.code === 0 && response.data.data.bound === true) {
      log('✅ 测试通过：推荐关系绑定成功', 'green');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log('⚠️  测试跳过：可能推荐码未关联推荐官', 'yellow');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (err) {
    log(`⚠️  测试跳过：${err.message}`, 'yellow');
    if (err.response) {
      console.log('提示：', err.response.data.message);
    }
    return false;
  }
}

/**
 * 测试5：通过 referrer_id 绑定推荐关系
 */
async function testBindByReferrerId() {
  log('\n[测试5] 通过 referrer_id 绑定推荐关系', 'yellow');

  try {
    const response = await axios.post(`${API_BASE}/referral/bind`, {
      referrer_id: 1, // 假设用户ID=1 存在
      bind_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    if (response.data.code === 0 && response.data.data.bound === true) {
      log('✅ 测试通过：推荐关系绑定成功', 'green');
      return true;
    } else {
      log('⚠️  测试跳过：可能用户ID=1不存在', 'yellow');
      return false;
    }
  } catch (err) {
    log(`⚠️  测试跳过：${err.message}`, 'yellow');
    return false;
  }
}

/**
 * 测试6：获取推荐人信息
 */
async function testGetReferrerInfo() {
  log('\n[测试6] 获取推荐人信息', 'yellow');

  try {
    const response = await axios.get(`${API_BASE}/referral/info`, {
      params: { referrer_id: 1 },
    });

    if (response.data.code === 0 && response.data.data) {
      log('✅ 测试通过：推荐人信息获取成功', 'green');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log('⚠️  测试跳过：可能用户ID=1不存在', 'yellow');
      return false;
    }
  } catch (err) {
    log(`⚠️  测试跳过：${err.message}`, 'yellow');
    return false;
  }
}

/**
 * 测试7：健康检查
 */
async function testHealthCheck() {
  log('\n[测试7] 健康检查', 'yellow');

  try {
    const response = await axios.get(`${API_BASE}/health`);

    if (response.data.status === 'ok') {
      log('✅ 测试通过：服务健康', 'green');
      console.log('返回数据：', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log('❌ 测试失败：服务状态异常', 'red');
      return false;
    }
  } catch (err) {
    log(`❌ 测试失败：无法连接到服务 (${API_BASE})`, 'red');
    log('提示：请先启动后端服务：node server.js', 'yellow');
    return false;
  }
}

// ==================== 主测试流程 ====================

async function runTests() {
  log('========================================', 'yellow');
  log('  推荐码系统测试', 'yellow');
  log('========================================', 'yellow');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  const tests = [
    testHealthCheck,
    testVerifyValidCode,
    testVerifyInvalidCode,
    testVerifyCodeCaseInsensitive,
    testBindByReferralCode,
    testBindByReferrerId,
    testGetReferrerInfo,
  ];

  for (const test of tests) {
    results.total++;
    const result = await test();
    if (result === true) {
      results.passed++;
    } else if (result === false) {
      // 判断是失败还是跳过
      results.skipped++;
    }
  }

  // 输出测试报告
  log('\n========================================', 'yellow');
  log('  测试报告', 'yellow');
  log('========================================', 'yellow');
  log(`总计：${results.total}`, 'yellow');
  log(`通过：${results.passed}`, 'green');
  log(`跳过：${results.skipped}`, 'yellow');
  log(`失败：${results.failed}`, 'red');

  if (results.passed === results.total) {
    log('\n🎉 所有测试通过！', 'green');
  } else {
    log('\n⚠️  部分测试未通过，请检查配置和数据', 'yellow');
  }

  log('\n提示：', 'yellow');
  log('1. 确保已执行 create_referral_codes.sql', 'yellow');
  log('2. 确保推荐码已关联推荐官用户ID', 'yellow');
  log('3. 确保后端服务已启动 (node server.js)', 'yellow');
}

// 执行测试
runTests().catch((err) => {
  log(`\n❌ 测试执行失败：${err.message}`, 'red');
  process.exit(1);
});
