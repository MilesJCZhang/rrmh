/**
 * app.js 更新说明
 *
 * 在现有 /var/www/renrenmei/server/app.js 中添加佣金路由:
 *
 * 1. 在文件顶部添加:
 *    const commissionRouter = require('./routes/commission');
 *
 * 2. 在路由注册部分添加:
 *    app.use('/v1/commission', commissionRouter);
 *
 * 位置参考:
 *    app.use('/v1/payment', paymentRouter);
 *    // 添加这行
 *    app.use('/v1/commission', commissionRouter);
 */
