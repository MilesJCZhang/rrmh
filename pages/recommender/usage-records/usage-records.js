// pages/recommender/usage-records/usage-records.js
const { request } = require('../../../utils/request');
const authService = require('../../../services/auth.service');

Page({
  data: {
    records: [],
    pagination: {
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0
    },
    loading: false,
    hasMore: true
  },

  onLoad: function() {
    this.loadUsageRecords();
  },

  onPullDownRefresh: function() {
    this.setData({
      'pagination.page': 1,
      records: [],
      hasMore: true
    });
    this.loadUsageRecords().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        'pagination.page': this.data.pagination.page + 1
      });
      this.loadUsageRecords();
    }
  },

  // 加载使用记录
  loadUsageRecords: function() {
    if (this.data.loading) return Promise.resolve();

    const userInfo = authService.getUserInfo();
    const userId = userInfo?.id;
    
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return Promise.resolve();
    }

    this.setData({ loading: true });

    return request({
      url: '/api/referral-codes/usage-records',
      method: 'GET',
      data: {
        user_id: userId,
        page: this.data.pagination.page,
        page_size: this.data.pagination.page_size
      }
    }).then(res => {
      if (res.code === 0 && res.data && res.data.records) {
        const newRecords = res.data.records.map(record => ({
          id: record.id,
          code: record.code,
          user_name: record.user_name || '用户' + record.user_id,
          user_role: record.user_role,
          scene_name: record.scene_name,
          ip_address: record.ip_address,
          created_at: record.created_at,
          time_ago: record.time_ago
        }));

        this.setData({
          records: this.data.pagination.page === 1 ? newRecords : [...this.data.records, ...newRecords],
          pagination: res.data.pagination || this.data.pagination,
          hasMore: res.data.pagination ? this.data.pagination.page < res.data.pagination.total_pages : false,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('[usage-records] 加载失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  }
});
