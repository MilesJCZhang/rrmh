/**
 * 服务站管理API测试
 * 测试文件：tests/api/stations.test.js
 */

const request = require('supertest');
const express = require('express');
const { createMemoryDatabase, initTestDatabase, seedTestData, cleanTestData } = require('../helpers/database.helper');

describe('服务站管理API测试', () => {
  let app;
  let db;
  let server;

  // 每个测试用例前执行
  beforeEach(() => {
    // 创建内存数据库
    db = createMemoryDatabase();
    
    // 初始化表结构
    initTestDatabase(db);
    
    // 插入测试数据
    seedTestData(db);
    
    // 创建Express应用
    app = express();
    app.use(express.json());
    
    // 将db挂载到app
    app.set('db', db);
    
    // 注册路由
    const stationsRouter = require('../../routes_stations');
    app.use('/api/stations', stationsRouter);
    
    // 错误处理中间件
    app.use((err, req, res, next) => {
      res.status(500).json({
        success: false,
        message: err.message
      });
    });
  });

  // 每个测试用例后执行
  afterEach(() => {
    // 清理数据库
    cleanTestData(db);
    db.close();
  });

  describe('POST /api/stations - 创建服务站', () => {
    test('STATION-001: 创建服务站（完整参数）', async () => {
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: '测试服务站',
          address: '测试地址123号',
          contact_phone: '13800138000',
          manager_id: 1,
          description: '这是一个测试服务站'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('测试服务站');
      expect(response.body.message).toBe('服务站创建成功');
    });

    test('STATION-002: 创建服务站（缺少必填项name）', async () => {
      const response = await request(app)
        .post('/api/stations')
        .send({
          address: '测试地址123号'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站名称和地址为必填项');
    });

    test('STATION-003: 创建服务站（缺少必填项address）', async () => {
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: '测试服务站'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站名称和地址为必填项');
    });

    test('STATION-004: 创建服务站（名称重复）', async () => {
      // 先创建一个服务站
      await request(app)
        .post('/api/stations')
        .send({
          name: '北京服务站',
          address: '测试地址'
        });

      // 尝试创建同名服务站
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: '北京服务站',
          address: '另一个地址'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站名称已存在');
    });

    test('STATION-005: 创建服务站（只有必填项）', async () => {
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: '最小参数服务站',
          address: '测试地址'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('最小参数服务站');
    });
  });

  describe('GET /api/stations - 查询服务站列表', () => {
    test('STATION-006: 查询列表（默认分页）', async () => {
      const response = await request(app)
        .get('/api/stations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    test('STATION-007: 查询列表（状态筛选-active）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      // 验证所有返回的项都是active状态
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('active');
      });
    });

    test('STATION-008: 查询列表（状态筛选-inactive）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ status: 'inactive' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // 验证所有返回的项都是inactive状态
      response.body.data.items.forEach(item => {
        expect(item.status).toBe('inactive');
      });
    });

    test('STATION-009: 查询列表（关键词搜索）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ keyword: '北京' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // 验证搜索结果包含关键词
      if (response.body.data.items.length > 0) {
        const hasKeyword = response.body.data.items.some(item => 
          item.name.includes('北京') || item.address.includes('北京')
        );
        expect(hasKeyword).toBe(true);
      }
    });

    test('STATION-010: 查询列表（分页参数）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    test('STATION-011: 查询列表（不存在的关键词）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ keyword: '不存在的服务站' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(0);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('GET /api/stations/:id - 查询服务站详情', () => {
    test('STATION-012: 查询详情（存在）', async () => {
      const response = await request(app)
        .get('/api/stations/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.id).toBe(1);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('address');
    });

    test('STATION-013: 查询详情（不存在）', async () => {
      const response = await request(app)
        .get('/api/stations/9999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站不存在');
    });

    test('STATION-014: 查询详情（无效ID）', async () => {
      const response = await request(app)
        .get('/api/stations/invalid');

      // 应该返回404或500，具体取决于实现
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/stations/:id - 更新服务站', () => {
    test('STATION-015: 更新服务站（完整参数）', async () => {
      const response = await request(app)
        .put('/api/stations/1')
        .send({
          name: '更新后的名称',
          address: '更新后的地址',
          contact_phone: '13900139000',
          description: '更新后的描述'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('更新后的名称');
      expect(response.body.data.address).toBe('更新后的地址');
      expect(response.body.message).toBe('服务站更新成功');
    });

    test('STATION-016: 更新服务站（不存在）', async () => {
      const response = await request(app)
        .put('/api/stations/9999')
        .send({
          name: '更新后的名称'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站不存在');
    });

    test('STATION-017: 更新服务站（无更新字段）', async () => {
      const response = await request(app)
        .put('/api/stations/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('没有提供要更新的字段');
    });

    test('STATION-018: 更新服务站（部分字段）', async () => {
      const response = await request(app)
        .put('/api/stations/1')
        .send({
          name: '仅更新名称'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('仅更新名称');
    });

    test('STATION-019: 更新服务站（名称重复）', async () => {
      // 先创建两个服务站
      await request(app)
        .post('/api/stations')
        .send({
          name: '服务站A',
          address: '地址A'
        });

      const stationB = await request(app)
        .post('/api/stations')
        .send({
          name: '服务站B',
          address: '地址B'
        });

      // 尝试将服务站B的名称更新为服务站A（会冲突）
      const response = await request(app)
        .put(`/api/stations/${stationB.body.data.id}`)
        .send({
          name: '服务站A'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站名称已存在');
    });
  });

  describe('DELETE /api/stations/:id - 删除服务站', () => {
    test('STATION-020: 删除服务站（存在）', async () => {
      // 先创建一个要删除的服务站
      const createResponse = await request(app)
        .post('/api/stations')
        .send({
          name: '待删除服务站',
          address: '待删除地址'
        });

      const stationId = createResponse.body.data.id;

      // 删除服务站
      const deleteResponse = await request(app)
        .delete(`/api/stations/${stationId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toBe('删除成功');

      // 验证已删除
      const getResponse = await request(app)
        .get(`/api/stations/${stationId}`);

      expect(getResponse.status).toBe(404);
    });

    test('STATION-021: 删除服务站（不存在）', async () => {
      const response = await request(app)
        .delete('/api/stations/9999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站不存在');
    });
  });

  describe('PUT /api/stations/:id/status - 更新服务站状态', () => {
    test('STATION-022: 更新状态（active -> inactive）', async () => {
      const response = await request(app)
        .put('/api/stations/1/status')
        .send({
          status: 'inactive'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
      expect(response.body.message).toBe('状态更新成功');
    });

    test('STATION-023: 更新状态（inactive -> active）', async () => {
      // 先设置为inactive
      await request(app)
        .put('/api/stations/1/status')
        .send({ status: 'inactive' });

      // 再设置为active
      const response = await request(app)
        .put('/api/stations/1/status')
        .send({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });

    test('STATION-024: 更新状态（无效状态值）', async () => {
      const response = await request(app)
        .put('/api/stations/1/status')
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('状态值无效，必须是 active 或 inactive');
    });

    test('STATION-025: 更新状态（缺少status参数）', async () => {
      const response = await request(app)
        .put('/api/stations/1/status')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('状态值无效，必须是 active 或 inactive');
    });

    test('STATION-026: 更新状态（服务站不存在）', async () => {
      const response = await request(app)
        .put('/api/stations/9999/status')
        .send({
          status: 'active'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('服务站不存在');
    });
  });

  describe('边界条件测试', () => {
    test('STATION-027: 创建服务站（名称边界-最长）', async () => {
      const longName = 'A'.repeat(255);
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: longName,
          address: '测试地址'
        });

      // 取决于数据库字段长度限制
      expect([201, 400, 500]).toContain(response.status);
    });

    test('STATION-028: 创建服务站（特殊字符）', async () => {
      const response = await request(app)
        .post('/api/stations')
        .send({
          name: '服务站@#$%',
          address: '地址<>&"'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('STATION-029: 查询列表（page=0）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ page: 0 });

      // page=0应该被处理为1，或者返回错误
      expect([200, 400]).toContain(response.status);
    });

    test('STATION-030: 查询列表（limit=0）', async () => {
      const response = await request(app)
        .get('/api/stations')
        .query({ limit: 0 });

      // limit=0应该被处理，或者返回错误
      expect([200, 400]).toContain(response.status);
    });
  });
});
