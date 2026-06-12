/**
 * test-referral-routes.js - 测试推荐码路由
 */

const express = require('express');
const app = express();

// 导入路由
try {
  const adminReferralRoutes = require('./routes_admin-referral');
  console.log('✅ routes_admin-referral.js loaded successfully');

  // 注册路由
  app.use('/v1/api/admin/referral-codes', adminReferralRoutes);
  console.log('✅ Routes registered');

  // 列出所有路由
  console.log('\n📋 Registered routes:');
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // 路由
      console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
    } else if (middleware.name === 'router') { // 路由器
      middleWare.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          console.log(`${methods} /v1/api/admin/referral-codes${path}`);
        }
      });
    }
  });

} catch (err) {
  console.error('❌ Failed to load routes:', err.message);
  process.exit(1);
}
