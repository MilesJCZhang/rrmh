/**
 * 测试沙龙配置 API
 * 使用管理后台的 JWT token 来测试
 */

const axios = require('axios');

const BASE_URL = '<INTERNAL_HOST_REMOVED>
const LOGIN_URL = `${BASE_URL}/api/admin/login`;
const CONFIG_URL = `${BASE_URL}/api/admin/salon-configs`;

// 管理员账号密码（需要根据实际情况修改）
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123', // 修改为实际密码
};

async function test() {
  try {
    // 1. 登录获取 token
    console.log('1. 登录管理后台...');
    const loginRes = await axios.post(LOGIN_URL, ADMIN_CREDENTIALS);
    
    let <SECRET_REDACTED>
    if (loginRes.data && loginRes.data.token) {
      <SECRET_REDACTED>
    } else if (loginRes.data && loginRes.data.data && loginRes.data.data.token) {
      <SECRET_REDACTED>
    } else {
      console.error('登录响应格式不正确:', loginRes.data);
      return;
    }
    
    console.log('✓ 登录成功, token:', token.substring(0, 20) + '...');
    
    // 2. 测试获取沙龙配置列表
    console.log('\n2. 测试获取沙龙配置列表...');
    const configRes = await axios.get(CONFIG_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ 获取成功！');
    console.log('   配置数量:', configRes.data.length);
    console.log('   配置列表:');
    configRes.data.forEach(config => {
      console.log(`   - [${config.type}] ${config.name} (${config.status})`);
    });
    
  } catch (error) {
    console.error('✗ 测试失败:');
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   错误:', error.message);
    }
  }
}

test();
