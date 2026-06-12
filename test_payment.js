// test_payment.js - 测试微信支付功能
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'renrenmei-secret-key-2026';

// 测试用户登录并获取token
async function testPayment() {
  try {
    console.log('🧪 开始测试微信支付功能...\n');

    // 1. 模拟微信登录获取token
    console.log('1️⃣ 模拟用户登录...');
    const mockOpenId = 'test_openid_' + Date.now();
    
    // 先注册/登录用户
    const loginResponse = await fetch(`${BASE_URL}/v1/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'mock_code_for_test',
        userInfo: {
          nickName: '测试用户',
          avatarUrl: 'https://example.com/avatar.png'
        }
      })
    });

    let token;
    if (loginResponse.status === 200) {
      const loginData = await loginResponse.json();
      token = loginData.data?.token;
      console.log('✅ 登录成功，获取到token');
    } else {
      // 如果登录接口不可用，使用mock token
      console.log('⚠️ 登录接口不可用，使用mock token');
      token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '7d' });
    }

    console.log(`Token: ${token ? '已获取' : '获取失败'}\n`);

    // 2. 测试创建支付订单
    console.log('2️⃣ 测试创建支付订单...');
    const paymentResponse = await fetch(`${BASE_URL}/v1/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'single_registration'
      })
    });

    const paymentData = await paymentResponse.json();
    console.log('支付订单响应:', JSON.stringify(paymentData, null, 2));

    if (paymentData.code === 0) {
      console.log('✅ 支付订单创建成功！');
      console.log('支付参数:', paymentData.data);
    } else {
      console.log('❌ 支付订单创建失败:', paymentData.message);
    }

    // 3. 检查环境变量配置
    console.log('\n3️⃣ 检查环境变量配置...');
    const requiredEnvVars = [
      'WX_APPID',
      'WX_SECRET',
      'WECHAT_MCH_ID',
      'WECHAT_API_KEY',
      'JWT_SECRET'
    ];

    let allConfigured = true;
    requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (!value || value.includes('XXXX') || value.includes('请修改')) {
        console.log(`❌ ${varName}: 未配置或使用占位符`);
        allConfigured = false;
      } else {
        console.log(`✅ ${varName}: 已配置`);
      }
    });

    if (allConfigured) {
      console.log('\n✅ 所有必需的环境变量已配置！');
    } else {
      console.log('\n⚠️ 部分环境变量未正确配置，请检查 .env 文件');
    }

    // 4. 检查依赖包
    console.log('\n4️⃣ 检查依赖包...');
    const requiredPackages = ['express', 'jsonwebtoken', 'crypto', 'axios'];
    
    for (const pkg of requiredPackages) {
      try {
        require(pkg);
        console.log(`✅ ${pkg}: 已安装`);
      } catch (e) {
        console.log(`❌ ${pkg}: 未安装`);
      }
    }

    console.log('\n📊 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    console.error('错误详情:', error);
  }
}

testPayment();
