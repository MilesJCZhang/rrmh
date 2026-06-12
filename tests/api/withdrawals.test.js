/**
 * 提现管理API测试
 * 测试文件：tests/api/withdrawals.test.js
 */

const request = require('supertest');
const express = require('express');
const { createMemoryDatabase, initTestDatabase, seedTestData, cleanTestData } = require('../helpers/database.helper');

describe('提现管理API测试', () => {
  let app;
  let db;

  beforeEach(() => {
    db = createMemoryDatabase();
    initTestDatabase(db);
    seedTestData(db);

    app = express();
    app.use(express.json());
    app.set('db', db);

    // Mock 认证中间件
    app.use('/api/withdrawals', (req, res, next) => {
      // 从header获取user-id，如果没有则使用默认值1
      const userId = req.headers['user-id'] || req.body.user_id || req.query.user_id;
      if (userId) {
        req.user_id = parseInt(userId);
      }
      next();
    });

    app.use('/api/withdrawals', (req, res, next) => {
      // 检查管理员权限
      const userRole = req.headers['user-role'] || 'user';
      if (req.path.startsWith('/admin') && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '权限不足，需要管理员权限'
        });
      }
      next();
    });

    const withdrawalsRouter = require('../../routes_withdrawals');
    app.use('/api/withdrawals', withdrawalsRouter);
  });

  afterEach(() => {
    cleanTestData(db);
    db.close();
  });

  describe('POST /api/withdrawals - 申请提现（用户端）', () => {
    test('WITHDRAW-001: 申请提现（完整参数）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.message).toBe('提现申请提交成功，等待审核');
    });

    test('WITHDRAW-002: 申请提现（缺少amount）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现金额、银行卡号、开户行、开户人为必填项');
    });

    test('WITHDRAW-003: 申请提现（缺少bank_account）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('WITHDRAW-004: 申请提现（金额≤0）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 0,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现金额必须大于0');
    });

    test('WITHDRAW-005: 申请提现（金额为负数）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: -10.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现金额必须大于0');
    });

    test('WITHDRAW-006: 申请提现（未授权）', async () => {
      const response = await request(app)
        .post('/api/withdrawals')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('未授权，请先登录');
    });
  });

  describe('GET /api/withdrawals/my - 查询我的提现记录（用户端）', () => {
    test('WITHDRAW-007: 查询我的提现记录', async () => {
      const response = await request(app)
        .get('/api/withdrawals/my')
        .set('user-id', '4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    test('WITHDRAW-008: 查询我的提现记录（按状态筛选）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/my')
        .set('user-id', '4')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('pending');
      });
    });

    test('WITHDRAW-009: 查询我的提现记录（分页）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/my')
        .set('user-id', '4')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });
  });

  describe('GET /api/withdrawals/:id - 查询提现详情（用户端）', () => {
    test('WITHDRAW-010: 查询详情（存在且属于当前用户）', async () => {
      // 先创建一个提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/withdrawals/${withdrawalId}`)
        .set('user-id', '2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(withdrawalId);
    });

    test('WITHDRAW-011: 查询详情（不属于当前用户）', async () => {
      // 用户2创建的提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      // 用用户3去查询
      const response = await request(app)
        .get(`/api/withdrawals/${withdrawalId}`)
        .set('user-id', '3');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现记录不存在');
    });

    test('WITHDRAW-012: 查询详情（不存在）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/9999')
        .set('user-id', '2');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现记录不存在');
    });
  });

  describe('PUT /api/withdrawals/:id/cancel - 取消提现申请（用户端）', () => {
    test('WITHDRAW-013: 取消申请（pending状态）', async () => {
      // 先创建一个pending状态的提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/withdrawals/${withdrawalId}/cancel`)
        .set('user-id', '2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('提现申请已取消');
    });

    test('WITHDRAW-014: 取消申请（非pending状态）', async () => {
      // 创建一个已审核的提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      // 先审核通过
      await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({ status: 'approved' });

      // 尝试取消
      const response = await request(app)
        .put(`/api/withdrawals/${withdrawalId}/cancel`)
        .set('user-id', '2');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('只能取消待审核的提现申请');
    });

    test('WITHDRAW-015: 取消申请（不存在）', async () => {
      const response = await request(app)
        .put('/api/withdrawals/9999/cancel')
        .set('user-id', '2');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现记录不存在');
    });
  });

  describe('GET /api/withdrawals/admin/list - 查询提现列表（管理员）', () => {
    test('WITHDRAW-016: 查询列表（管理员）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/list')
        .set('user-role', 'admin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    test('WITHDRAW-017: 查询列表（按状态筛选）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/list')
        .set('user-role', 'admin')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('pending');
      });
    });

    test('WITHDRAW-018: 查询列表（非管理员）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/list')
        .set('user-role', 'user');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('权限不足，需要管理员权限');
    });
  });

  describe('PUT /api/withdrawals/admin/:id/approve - 审核提现申请（管理员）', () => {
    test('WITHDRAW-019: 审核（通过）', async () => {
      // 先创建一个提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({ status: 'approved' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('审核通过');
    });

    test('WITHDRAW-020: 审核（拒绝，有原因）', async () => {
      // 先创建一个提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({
          status: 'rejected',
          reject_reason: '资料不完整'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('已拒绝');
    });

    test('WITHDRAW-021: 审核（拒绝，无原因）', async () => {
      // 先创建一个提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({
          status: 'rejected'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('拒绝时必须提供拒绝原因');
    });

    test('WITHDRAW-022: 审核（状态无效）', async () => {
      const response = await request(app)
        .put('/api/withdrawals/admin/1/approve')
        .set('user-role', 'admin')
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('状态值无效，必须是 approved 或 rejected');
    });

    test('WITHDRAW-023: 审核（不存在）', async () => {
      const response = await request(app)
        .put('/api/withdrawals/admin/9999/approve')
        .set('user-role', 'admin')
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现记录不存在');
    });

    test('WITHDRAW-024: 审核（重复处理）', async () => {
      // 先创建一个提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      // 第一次审核
      await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({ status: 'approved' });

      // 第二次审核（应该失败）
      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({ status: 'approved' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('该提现申请已经处理过，不能重复处理');
    });
  });

  describe('PUT /api/withdrawals/admin/:id/mark-paid - 标记已打款（管理员）', () => {
    test('WITHDRAW-025: 标记已打款', async () => {
      // 先创建一个提现记录并审核通过
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      // 审核通过
      await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/approve`)
        .set('user-role', 'admin')
        .send({ status: 'approved' });

      // 标记已打款
      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/mark-paid`)
        .set('user-role', 'admin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('paid');
      expect(response.body.message).toBe('标记成功，提现已打款');
    });

    test('WITHDRAW-026: 标记已打款（非approved状态）', async () => {
      // 创建一个pending状态的提现记录
      const createResponse = await request(app)
        .post('/api/withdrawals')
        .set('user-id', '2')
        .send({
          amount: 50.00,
          bank_account: '6222021234567890',
          bank_name: '工商银行',
          account_holder: '测试用户'
        });

      const withdrawalId = createResponse.body.data.id;

      // 尝试标记已打款（应该失败，因为还是pending状态）
      const response = await request(app)
        .put(`/api/withdrawals/admin/${withdrawalId}/mark-paid`)
        .set('user-role', 'admin');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('只能标记已审核通过的提现为已打款');
    });

    test('WITHDRAW-027: 标记已打款（不存在）', async () => {
      const response = await request(app)
        .put('/api/withdrawals/admin/9999/mark-paid')
        .set('user-role', 'admin');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('提现记录不存在');
    });
  });

  describe('GET /api/withdrawals/admin/stats - 获取提现统计（管理员）', () => {
    test('WITHDRAW-028: 获取统计（管理员）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/stats')
        .set('user-role', 'admin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_count');
      expect(response.body.data).toHaveProperty('pending_count');
      expect(response.body.data).toHaveProperty('approved_count');
      expect(response.body.data).toHaveProperty('rejected_count');
      expect(response.body.data).toHaveProperty('paid_count');
      expect(response.body.data).toHaveProperty('total_paid_amount');
    });

    test('WITHDRAW-029: 获取统计（非管理员）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/stats')
        .set('user-role', 'user');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('权限不足，需要管理员权限');
    });

    test('WITHDRAW-030: 获取统计（按日期筛选）', async () => {
      const response = await request(app)
        .get('/api/withdrawals/admin/stats')
        .set('user-role', 'admin')
        .query({
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
