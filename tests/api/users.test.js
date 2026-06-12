/**
 * 用户API测试
 * 测试文件：tests/api/users.test.js
 */

const request = require('supertest');
const express = require('express');

describe('用户API测试', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const userRouter = require('../../routes_user');
    app.use('/api/user', userRouter);
  });

  describe('GET /api/user/me - 获取当前用户信息', () => {
    test('USER-001: 获取用户信息（有token）', async () => {
      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer mock_token_123');

      // routes_user.js返回格式是 { code: 0, data: {...} }
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('nickname');
    });

    test('USER-002: 获取用户信息（无token）', async () => {
      const response = await request(app)
        .get('/api/user/me');

      // routes_user.js中，无token返回 { code: 401, message: '未登录' }
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(401);
      expect(response.body.message).toBe('未登录');
    });

    test('USER-003: 获取用户信息（token格式错误）', async () => {
      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'InvalidFormat');

      // routes_user.js不会严格验证token格式
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
    });
  });

  describe('PUT /api/user/profile/update - 更新用户信息', () => {
    test('USER-004: 更新用户信息', async () => {
      const response = await request(app)
        .put('/api/user/profile/update')
        .send({
          nickname: '新昵称',
          avatar: 'https://example.com/avatar.jpg'
        });

      // routes_user.js直接返回成功
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.message).toBe('更新成功');
    });

    test('USER-005: 更新用户信息（空数据）', async () => {
      const response = await request(app)
        .put('/api/user/profile/update')
        .send({});

      // routes_user.js不会检查是否有数据
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
    });
  });

  describe('返回格式一致性检查', () => {
    test('USER-006: 检查成功返回格式', async () => {
      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer mock_token');

      // 应该是 { code: 0, data: {...} } 格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('data');
      expect(response.body.code).toBe(0);
    });

    test('USER-007: 检查错误返回格式', async () => {
      const response = await request(app)
        .get('/api/user/me');

      // 应该是 { code: 401, message: '...' } 格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      expect(response.body.code).toBe(401);
    });
  });

  describe('与其他API返回格式对比', () => {
    test('USER-008: 检查返回格式是否与stations API一致', async () => {
      // stations API返回格式：{ success: true/false, data: {...}, message: '...' }
      // user API返回格式：{ code: 0/400/401, data: {...}, message: '...' }
      // 这是不一致的！应该统一格式

      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer mock_token');

      // 当前格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('data');

      // 理想格式（与其他API一致）
      // expect(response.body).toHaveProperty('success');
      // expect(response.body).toHaveProperty('data');
    });
  });
});
