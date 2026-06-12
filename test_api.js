/**
 * 测试沙龙配置 API
 * 运行：node test_api.js
 */

const http = require('http');

const PORT = 3001;
const HOST = 'localhost';

// 测试 1：不带认证访问 /api/admin/salon-configs（应该返回 401 或 403，而不是 404）
function test1() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/admin/salon-configs',
      method: 'GET',
    };

    console.log('\n测试 1：GET /api/admin/salon-configs（不带认证）');
    
    const req = http.request(options, (res) => {
      console.log(`  状态码: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`  响应体: ${data.substring(0, 200)}...`);
        
        if (res.statusCode === 404) {
          console.log('  ✗ 路由未找到（404）- 说明路由没有正确注册');
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          console.log('  ✓ 路由已注册（返回 401/403 认证错误）');
        } else {
          console.log(`  ? 意外的状态码 ${res.statusCode}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error(`  ✗ 请求失败: ${err.message}`);
      reject(err);
    });
    
    req.end();
  });
}

// 测试 2：不带认证访问 /v1/admin/salon-configs（应该返回 401 或 403，而不是 404）
function test2() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/v1/admin/salon-configs',
      method: 'GET',
    };

    console.log('\n测试 2：GET /v1/admin/salon-configs（不带认证）');
    
    const req = http.request(options, (res) => {
      console.log(`  状态码: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`  响应体: ${data.substring(0, 200)}...`);
        
        if (res.statusCode === 404) {
          console.log('  ✗ 路由未找到（404）- 说明路由没有正确注册');
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          console.log('  ✓ 路由已注册（返回 401/403 认证错误）');
        } else {
          console.log(`  ? 意外的状态码 ${res.statusCode}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error(`  ✗ 请求失败: ${err.message}`);
      reject(err);
    });
    
    req.end();
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('=== 开始测试沙龙配置 API ===');
  
  try {
    await test1();
    await test2();
    
    console.log('\n=== 测试完成 ===');
    console.log('\n如果两次测试都返回 404，说明路由没有正确注册。');
    console.log('如果返回 401/403，说明路由已注册，只是需要认证。');
  } catch (err) {
    console.error('测试失败:', err.message);
  }
}

runAllTests();
