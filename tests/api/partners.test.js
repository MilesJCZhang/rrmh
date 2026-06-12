/**
 * 合伙人管理API测试
 * 测试文件：tests/api/partners.test.js
 */

const request = require('supertest');
const express = require('express');
const { createMemoryDatabase, initTestDatabase, seedTestData, cleanTestData } = require('../helpers/database.helper');

describe('合伙人管理API测试', () => {
  let app;
  let db;

  beforeEach(() => {
    db = createMemoryDatabase();
    initTestDatabase(db);
    seedTestData(db);

    app = express();
    app.use(express.json());
    app.set('db', db);

    const partnersRouter = require('../../routes_partners');
    app.use('/api/partners', partnersRouter);
  });

  afterEach(() => {
    cleanTestData(db);
    db.close();
  });

  describe('POST /api/partners/apply - 申请成为合伙人', () => {
    test('PARTNER-001: 申请合伙人（完整参数）', async () => {
      const response = await request(app)
        .post('/api/partners/apply')
        .send({
          user_id: 2,
          type: 'creator',
          id_card: '110101199001011234',
          id_card_front: 'https://example.com/front.jpg',
          id_card_back: 'https://example.com/back.jpg'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.message).toBe('申请提交成功，等待审核');
    });

    test('PARTNER-002: 申请合伙人（缺少user_id）', async () => {
      const response = await request(app)
        .post('/api/partners/apply')
        .send({
          type: 'creator'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户ID和类型为必填项');
    });

    test('PARTNER-003: 申请合伙人（缺少type）', async () => {
      const response = await request(app)
        .post('/api/partners/apply')
        .send({
          user_id: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户ID和类型为必填项');
    });

    test('PARTNER-004: 申请合伙人（类型无效）', async () => {
      const response = await request(app)
        .post('/api/partners/apply')
        .send({
          user_id: 2,
          type: 'invalid_type'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('类型值无效');
    });

    test('PARTNER-005: 重复申请', async () => {
      // user_id=4 已经是合伙人
      const response = await request(app)
        .post('/api/partners/apply')
        .send({
          user_id: 4,
          type: 'creator'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('您已经申请过合伙人，请勿重复申请');
    });
  });

  describe('GET /api/partners/my/:user_id - 查询我的合伙人信息', () => {
    test('PARTNER-006: 查询我的合伙人信息（存在）', async () => {
      const response = await request(app)
        .get('/api/partners/my/4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('user_id', 4);
    });

    test('PARTNER-007: 查询我的合伙人信息（不存在）', async () => {
      const response = await request(app)
        .get('/api/partners/my/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('您还不是合伙人');
    });
  });

  describe('GET /api/partners - 查询合伙人列表（管理员）', () => {
    test('PARTNER-008: 查询列表（默认分页）', async () => {
      const response = await request(app)
        .get('/api/partners');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    test('PARTNER-009: 查询列表（状态筛选-pending）', async () => {
      const response = await request(app)
        .get('/api/partners')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('pending');
      });
    });

    test('PARTNER-010: 查询列表（类型筛选-creator）', async () => {
      const response = await request(app)
        .get('/api/partners')
        .query({ type: 'creator' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.items.forEach(item => {
        expect(item.type).toBe('creator');
      });
    });

    test('PARTNER-011: 查询列表（关键词搜索）', async () => {
      const response = await request(app)
        .get('/api/partners')
        .query({ keyword: '合伙人' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/partners/:id - 查询合伙人详情（管理员）', () => {
    test('PARTNER-012: 查询详情（存在）', async () => {
      const response = await request(app)
        .get('/api/partners/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 1);
    });

    test('PARTNER-013: 查询详情（不存在）', async () => {
      const response = await request(app)
        .get('/api/partners/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('合伙人不存在');
    });
  });

  describe('PUT /api/partners/:id - 更新合伙人信息（管理员）', () => {
    test('PARTNER-014: 更新合伙人信息（有效数据）', async () => {
      const response = await request(app)
        .put('/api/partners/1')
        .send({
          type: 'public_welfare',
          level: 'senior'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('public_welfare');
    });

    test('PARTNER-015: 更新合伙人信息（不存在）', async () => {
      const response = await request(app)
        .put('/api/partners/999')
        .send({
          type: 'creator'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('合伙人不存在');
    });

    test('PARTNER-016: 更新合伙人信息（类型无效）', async () => {
      const response = await request(app)
        .put('/api/partners/1')
        .send({
          type: 'invalid_type'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('类型值无效');
    });

    test('PARTNER-017: 更新合伙人信息（状态无效）', async () => {
      const response = await request(app)
        .put('/api/partners/1')
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('状态值无效');
    });

    test('PARTNER-018: 更新合伙人信息（无更新字段）', async () => {
      const response = await request(app)
        .put('/api/partners/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('没有提供要更新的字段');
    });
  });

  describe('PUT /api/partners/:id/approve - 审核合伙人（管理员）', () => {
    test('PARTNER-019: 审核合伙人（通过）', async () => {
      const response = await request(app)
        .put('/api/partners/2/approve')
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('审核通过');
    });

    test('PARTNER-020: 审核合伙人（拒绝，有原因）', async () => {
      const response = await request(app)
        .put('/api/partners/2/approve')
        .send({
          status: 'rejected',
          reject_reason: '资料不完整'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('已拒绝');
    });

    test('PARTNER-021: 审核合伙人（拒绝，无原因）', async () => {
      const response = await request(app)
        .put('/api/partners/2/approve')
        .send({
          status: 'rejected'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('拒绝时必须提供拒绝原因');
    });

    test('PARTNER-022: 审核合伙人（状态无效）', async () => {
      const response = await request(app)
        .put('/api/partners/2/approve')
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('状态值无效，必须是 approved 或 rejected');
    });

    test('PARTNER-023: 审核合伙人（不存在）', async () => {
      const response = await request(app)
        .put('/api/partners/999/approve')
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('合伙人不存在');
    });
  });

  describe('GET /api/partners/:id/earnings - 查询合伙人收益（管理员）', () => {
    test('PARTNER-024: 查询收益（有数据）', async () => {
      // 先插入一些收益数据
      db.prepare(`
        INSERT INTO partner_earnings (partner_id, user_id, amount)
        VALUES (1, 2, 50.00)
      `).run();

      const response = await request(app)
        .get('/api/partners/1/earnings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_amount');
      expect(response.body.data).toHaveProperty('items');
    });

    test('PARTNER-025: 查询收益（合伙人不存在）', async () => {
      const response = await request(app)
        .get('/api/partners/999/earnings');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('合伙人不存在');
    });
  });

  describe('GET /api/partners/:id/referrals - 查询推荐记录（管理员）', () => {
    test('PARTNER-026: 查询推荐记录（有数据）', async () => {
      // 先插入一些推荐数据
      db.prepare(`
        INSERT INTO partner_referrals (partner_id, referred_user_id, status)
        VALUES (1, 2, 'completed')
      `).run();

      const response = await request(app)
        .get('/api/partners/1/referrals');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
    });

    test('PARTNER-027: 查询推荐记录（合伙人不存在）', async () => {
      const response = await request(app)
        .get('/api/partners/999/referrals');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('合伙人不存在');
    });

    test('PARTNER-028: 查询推荐记录（按状态筛选）', async () => {
      const response = await request(app)
        .get('/api/partners/1/referrals')
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
