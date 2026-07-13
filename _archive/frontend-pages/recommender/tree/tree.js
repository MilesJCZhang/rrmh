// pages/recommender/tree/tree.js
const { request } = require('../../../utils/request');
const authService = require('../../../services/auth.service');

Page({
  data: {
    tree: null,
    stats: null,
    loading: true
  },

  onLoad: function() {
    this.loadTreeData();
  },

  // 加载推荐关系树数据
  loadTreeData: function() {
    const userInfo = authService.getUserInfo();
    let userId = userInfo?.id || userInfo?.userId || userInfo?._id;

    console.log('[tree] userInfo:', userInfo);
    console.log('[tree] userId (from userInfo.id):', userInfo?.id);
    console.log('[tree] userId (final):', userId);

    // 如果 userInfo 中没有 id，尝试从 Storage 直接获取
    if (!userId) {
      const storedUserId = wx.getStorageSync('user_id');
      if (storedUserId) {
        userId = storedUserId;
        console.log('[tree] userId (from Storage):', userId);
      }
    }

    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    request({
      url: '/referral/tree',
      method: 'GET',
      data: {
        max_depth: 5
      }
    }).then(res => {
      console.log('[tree] API response:', res);
      if (res.code === 0 && res.data && res.data.tree) {
        this.setData({
          tree: res.data.tree,
          stats: res.data.stats,
          loading: false
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: res.message || '暂无推荐关系', icon: 'none' });
      }
    }).catch(err => {
      console.error('[tree] 加载失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 导出PDF
  exportPDF: function() {
    wx.showLoading({ title: '生成PDF中...' });

    const userInfo = authService.getUserInfo();
    const userId = userInfo?.id;

    request({
      url: '/referral/export-tree-pdf',
      method: 'POST',
      data: {
        max_depth: 5
      }
    }).then(res => {
      wx.hideLoading();
      if (res.success && res.pdf_url) {
        // 下载PDF文件
        wx.downloadFile({
          url: res.pdf_url,
          success: (downloadRes) => {
            wx.openDocument({
              file_path: downloadRes.tempFilePath,
              show_menu: true,
              success: () => {
                wx.showToast({ title: 'PDF已打开', icon: 'success' });
              },
              fail: () => {
                wx.showToast({ title: '打开PDF失败', icon: 'none' });
              }
            });
          },
          fail: () => {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        });
      } else {
        wx.showToast({ title: res.message || '导出失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('[tree] 导出PDF失败:', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    });
  },

  onShareAppMessage: function() {
    return {
      title: '我的推荐关系树',
      path: '/subpackages/matchmaker/pages/recommender/tree/tree'
    };
  }
});
