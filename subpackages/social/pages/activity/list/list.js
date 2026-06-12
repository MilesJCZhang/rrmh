// pages/activity/list/list.js - 活动列表页面
const authService = require('../../../../../services/auth.service');
const util = require('../../../../../utils/util.js');

Page({
  data: {
    // 筛选条件
    filters: {
      date: '',           // 日期筛选
      location: '',       // 地点筛选
      priceRange: '',     // 价格区间
      gender: '',         // 性别筛选
      status: 'open'      // 状态筛选：open-报名中，closed-已结束，all-全部
    },
    
    // 活动列表
    activities: [],
    
    // 分页信息
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      loading: false,
      hasMore: true
    },
    
    // 用户位置
    userLocation: '',
    
    // 页面状态
    loading: true,
    showFilters: false,
    
    // 筛选选项
    filterOptions: {
      dateOptions: [
        { label: '全部时间', value: '' },
        { label: '今天', value: 'today' },
        { label: '明天', value: 'tomorrow' },
        { label: '本周', value: 'week' },
        { label: '本月', value: 'month' }
      ],
      
      locationOptions: [
        { label: '全部地点', value: '' },
        { label: '市中心', value: 'downtown' },
        { label: '东城区', value: 'east' },
        { label: '西城区', value: 'west' },
        { label: '南城区', value: 'south' },
        { label: '北城区', value: 'north' }
      ],
      
      priceOptions: [
        { label: '全部价格', value: '' },
        { label: '0-199元', value: '0-199' },
        { label: '200-399元', value: '200-399' },
        { label: '400元以上', value: '400+' }
      ],
      
      genderOptions: [
        { label: '全部性别', value: '' },
        { label: '女士专场', value: 'female' },
        { label: '男士专场', value: 'male' }
      ],
      
      statusOptions: [
        { label: '报名中', value: 'open' },
        { label: '已结束', value: 'closed' },
        { label: '全部活动', value: 'all' }
      ]
    },
    
    // 当前活动
    currentActivity: null
  },

  onLoad: function(options) {
    this.initPage();
  },

  onShow: function() {
    // 检查登录状态，如果需要的话
  },

  onPullDownRefresh: function() {
    this.refreshActivities();
    wx.stopPullDownRefresh();
  },

  onReachBottom: function() {
    this.loadMoreActivities();
  },

  // 初始化页面
  initPage: function() {
    this.setData({ loading: true });
    
    // 获取用户位置
    this.getUserLocation();
    
    // 加载活动数据
    this.refreshActivities();
  },

  // 获取用户位置
  getUserLocation: function() {
    const that = this;
    
    wx.getLocation({
      type: 'wgs84',
      success: function(res) {
        // 这里应该调用逆地理编码API获取具体地址
        // 暂时使用模拟数据
        const location = '威海市环翠区';
        
        that.setData({
          userLocation: location
        });
      },
      fail: function() {
        that.setData({
          userLocation: '未知位置'
        });
      }
    });
  },

  // 刷新活动列表
  refreshActivities: function() {
    this.setData({
      'pagination.page': 1,
      'pagination.loading': true,
      'pagination.hasMore': true
    });
    
    this.loadActivities(true);
  },

  // 加载更多活动
  loadMoreActivities: function() {
    if (!this.data.pagination.hasMore || this.data.pagination.loading) {
      return;
    }
    
    this.setData({
      'pagination.page': this.data.pagination.page + 1,
      'pagination.loading': true
    });
    
    this.loadActivities(false);
  },

  // 加载活动数据
  loadActivities: function(refresh = true) {
    const that = this;
    const { page, pageSize } = this.data.pagination;
    const filters = this.data.filters;
    
    // 模拟API请求
    setTimeout(() => {
      // 模拟数据
      const mockActivities = this.generateMockActivities(page, pageSize, filters);
      const total = 35; // 模拟总条数
      
      let activities = refresh ? mockActivities : [...that.data.activities, ...mockActivities];
      const hasMore = activities.length < total;
      
      that.setData({
        activities: activities,
        'pagination.total': total,
        'pagination.loading': false,
        'pagination.hasMore': hasMore,
        loading: false
      });
    }, 800);
  },

  // 生成模拟活动数据
  generateMockActivities: function(page, pageSize, filters) {
    const activities = [];
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    for (let i = startIndex; i < endIndex && i < 35; i++) {
      const id = i + 1;
      const status = i % 3 === 0 ? 'closed' : 'open';
      
      // 根据筛选条件过滤
      if (filters.status === 'open' && status === 'closed') continue;
      if (filters.status === 'closed' && status === 'open') continue;
      
      const activity = {
        id: id,
        title: this.getActivityTitle(id),
        date: this.getFutureDate(i),
        time: this.getActivityTime(i),
        location: this.getLocation(i),
        fee: this.getActivityFee(i),
        femaleCount: Math.floor(Math.random() * 4) + 1,
        maleCount: Math.floor(Math.random() * 8) + 2,
        femaleLimit: 5,
        maleLimit: 10,
        status: status,
        type: i % 3 === 0 ? 'indoor' : 'outdoor',
        tags: this.getActivityTags(i),
        organizer: '平台官方',
        description: 'AI大数据360维度深度推荐，同城纯私密、小范围精准见面，每场仅限3对'
      };
      
      activities.push(activity);
    }
    
    return activities;
  },

  // 获取活动标题
  getActivityTitle: function(index) {
    const titles = [
      'AI推荐 · 70/80后上午场',
      'AI推荐 · 90/00后下午场',
      '私密沙龙 · 周一上午场',
      '私密沙龙 · 周二下午场',
      '精准推荐 · 周三上午场',
      '精准推荐 · 周四下午场',
      '私密见面 · 周五上午场',
      'AI推荐 · 下周预约中',
      '私密沙龙 · 下周预约中',
      '精准推荐 · 下周预约中'
    ];
    return titles[index % titles.length];
  },

  // 获取未来日期
  getFutureDate: function(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return util.formatTime(date, 'YYYY-MM-DD');
  },

  // 获取活动时间
  getActivityTime: function(index) {
    const times = ['14:00-17:00', '15:00-18:00', '19:00-22:00', '10:00-16:00'];
    return times[index % times.length];
  },

  // 获取地点
  getLocation: function(index) {
    const locations = [
      '市中心咖啡馆',
      '郊野公园',
      '创意园区',
      '商业广场',
      '主题餐厅',
      '图书馆',
      '手工作坊',
      '音乐酒吧',
      '烹饪教室',
      '电影院'
    ];
    return locations[index % locations.length];
  },

  // 获取活动费用
  getActivityFee: function(index) {
    const fees = [199, 299, 399, 499, 199, 299, 399, 199, 299, 399];
    return fees[index % fees.length];
  },

  // 获取活动标签
  getActivityTags: function(index) {
    const tagSets = [
      ['精准推荐', '3对私密'],
      ['同城见面', 'AI推荐'],
      ['私密沙龙', '深度交流'],
      ['AI推荐', '专属推荐官'],
      ['精准推荐', '3对私密'],
      ['同城见面', 'AI推荐'],
      ['私密沙龙', '深度交流'],
      ['AI推荐', '专属推荐官'],
      ['精准推荐', '3对私密'],
      ['同城见面', 'AI推荐']
    ];
    return tagSets[index % tagSets.length];
  },

  // 切换筛选面板
  onToggleFilters: function() {
    this.setData({
      showFilters: !this.data.showFilters
    });
  },

  // 筛选条件变化
  onFilterChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`filters.${field}`]: value
    });
    
    // 如果筛选面板打开，立即应用筛选
    if (this.data.showFilters) {
      this.applyFilters();
    }
  },

  // 应用筛选
  onApplyFilters: function() {
    this.setData({
      showFilters: false
    });
    
    this.applyFilters();
  },

  // 重置筛选
  onResetFilters: function() {
    this.setData({
      filters: {
        date: '',
        location: '',
        priceRange: '',
        gender: '',
        status: 'open'
      }
    });
    
    this.applyFilters();
  },

  // 应用筛选条件
  applyFilters: function() {
    this.refreshActivities();
  },

  // 点击活动卡片
  onActivityTap: function(e) {
    const id = e.currentTarget.dataset.id;
    const activity = this.data.activities.find(item => item.id === id);
    
    if (!activity) return;
    
    // 检查登录状态
    if (!authService.isLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      const { requireLogin } = require('../../../../../utils/auth');
      requireLogin('请先登录后再报名', false);
      return;
    }
    
    // 检查活动状态
    if (activity.status === 'closed') {
      wx.showToast({ title: '该活动已结束', icon: 'none' });
      return;
    }
    
    // 检查用户性别和活动名额
    this.checkActivityAvailability(activity);
  },

  // 检查活动可用性
  checkActivityAvailability: function(activity) {
    const userInfo = authService.getUserInfo();
    
    if (!userInfo) {
      wx.showToast({ title: '请先完善个人信息', icon: 'none' });
      wx.navigateTo({
        url: '/subpackages/user/pages/user/profile/profile'
      });
      return;
    }
    
    // 检查用户性别对应的名额
    const userGender = userInfo.gender;
    let available = true;
    let message = '';
    
    if (userGender === 'female') {
      if (activity.femaleCount >= activity.femaleLimit) {
        available = false;
        message = '女士名额已满';
      }
    } else if (userGender === 'male') {
      if (activity.maleCount >= activity.maleLimit) {
        available = false;
        message = '男士名额已满';
      }
    }
    
    if (!available) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }
    
    // 跳转到活动详情
    wx.navigateTo({
      url: `/subpackages/social/pages/activity/detail/detail?id=${activity.id}`
    });
  },

  // 创建新活动（管理员功能）
  onCreateActivity: function() {
    const permission = authService.checkPermission('admin:events');
    
    if (!permission) {
      wx.showToast({ title: '无权限', icon: 'none' });
      return;
    }
    
    wx.navigateTo({
      url: '/subpackages/social/pages/activity/create/create'
    });
  },

  // 搜索活动
  onSearchActivities: function() {
    wx.navigateTo({
      url: '/subpackages/social/pages/activity/search/search'
    });
  },

  // 查看已报名活动
  onViewMyRegistrations: function() {
    if (!authService.isLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      const { requireLogin } = require('../../../../../utils/auth');
      requireLogin('请先登录后再查看', false);
      return;
    }
    
    wx.navigateTo({
      url: '/subpackages/user/pages/user/orders/orders?type=activities'
    });
  },

  // 分享活动
  onShareActivity: function(e) {
    const id = e.currentTarget.dataset.id;
    const activity = this.data.activities.find(item => item.id === id);
    
    if (!activity) return;
    
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '人人好媒 - AI精准推荐沙龙',
      query: '',
      imageUrl: '/images/share.jpg'
    };
  },

  // 获取距离信息
  getDistanceInfo: function(location) {
    // 这里应该计算实际距离
    // 暂时返回模拟数据
    const distances = ['1.2km', '2.5km', '3.8km', '5.1km', '7.3km'];
    return distances[Math.floor(Math.random() * distances.length)];
  },

  // 获取活动状态文本
  getActivityStatusText: function(status) {
    const statusMap = {
      'open': '报名中',
      'closed': '已结束',
      'full': '名额已满'
    };
    return statusMap[status] || '未知状态';
  },

  // 获取活动类型图标
  getActivityTypeIcon: function(type) {
    const iconMap = {
      'indoor': '/images/icon/indoor.png',
      'outdoor': '/images/icon/outdoor.png'
    };
    return iconMap[type] || '/images/icon/activity.png';
  }
});