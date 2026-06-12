/**
 * routes_avatar.js - 用户画像相关路由
 * 提供用户头像、活动历史等数据
 */

const express = require('express');
const router = express.Router();

// GET /v1/avatar/info
router.get('/info', (req, res) => {
  // 返回当前用户信息（mock数据，实际应该从数据库读取）
  res.json({
    code: 0,
    data: {
      id: req.query.user_id || 'mock_user_id',
      nickname: '测试用户',
      avatar: '',
      age: 28,
      gender: 'female',
      city: '上海',
      occupation: '互联网',
      education: '本科',
      income: '20-30万',
      height: 165,
      weight: 52,
     婚姻状况: '未婚',
      about: '喜欢旅行、美食、看电影',
      expect: '希望找到一个性格合得来的人',
      photos: [],
    }
  });
});

// GET /v1/avatar/activities
router.get('/activities', (req, res) => {
  const { limit = 5 } = req.query;
  
  // 返回用户活动历史（mock数据）
  const activities = [];
  const types = ['view', 'like', 'match', 'message'];
  const contents = ['查看了你的资料', '点赞了你', '你们匹配成功', '给你发了消息'];
  
  for (let i = 0; i < Math.min(limit, 10); i++) {
    activities.push({
      id: i + 1,
      type: types[i % types.length],
      content: contents[i % contents.length],
      time: new Date(Date.now() - i * 86400000).toISOString(),
      user: {
        id: `user_${i}`,
        nickname: `用户${i + 1}`,
        avatar: '',
      }
    });
  }
  
  res.json({
    code: 0,
    data: activities,
  });
});

module.exports = router;
