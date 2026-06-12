// 推荐官列表页面
const authService = require('../../../../../services/auth.service');

Page({
  data: {
    // 推荐官类型筛选
    matchmakerTypes: [
      { id: 'all', name: '全部', active: true },
      { id: 'warm', name: '公益推荐官', active: false },
      { id: 'aid', name: '联创推荐官', active: false }
    ],
    
    // 筛选条件
    filters: {
      region: '',
      rating: '',
      serviceType: '',
      keyword: ''
    },
    
    // 推荐官列表数据
    matchmakers: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 10,
    
    // 用户权限信息
    userRole: '',
    hasApplyRight: false,
    
    // 高级筛选弹窗
    showFilterModal: false
  },

  onLoad() {
    this.loadMatchmakerList();
    this.checkUserPermission();
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      matchmakers: []
    });
    this.loadMatchmakerList();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreMatchmakers();
    }
  },

  // 检查用户权限
  checkUserPermission() {
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      this.setData({
        userRole: userInfo.role || 'user',
        hasApplyRight: userInfo.verified && userInfo.age >= 25
      });
    }
  },

  // 加载推荐官列表
  loadMatchmakerList() {
    this.setData({ loading: true });
    
    // 模拟API调用
    setTimeout(() => {
      const mockMatchmakers = this.generateMockMatchmakers(this.data.page, this.data.pageSize);
      
      this.setData({
        matchmakers: mockMatchmakers,
        loading: false,
        hasMore: mockMatchmakers.length === this.data.pageSize
      });
    }, 800);
  },

  // 加载更多推荐官
  loadMoreMatchmakers() {
    const nextPage = this.data.page + 1;
    this.setData({ page: nextPage });
    
    // 模拟API调用
    setTimeout(() => {
      const newMatchmakers = this.generateMockMatchmakers(nextPage, this.data.pageSize);
      const allMatchmakers = [...this.data.matchmakers, ...newMatchmakers];
      
      this.setData({
        matchmakers: allMatchmakers,
        loading: false,
        hasMore: newMatchmakers.length === this.data.pageSize
      });
    }, 800);
  },

  // 生成模拟推荐官数据
  generateMockMatchmakers(page, pageSize) {
    const matchmakers = [];
    const startIndex = (page - 1) * pageSize;
    
    for (let i = 0; i < pageSize; i++) {
      const index = startIndex + i;
      const isWarmType = index % 3 !== 0; // 2/3是公益推荐官，1/3是联创推荐官
      const matchmakerType = isWarmType ? 'warm' : 'aid';
      
      const matchmaker = {
        id: `matchmaker_${index}`,
        name: this.getRandomName(),
        type: matchmakerType,
        typeName: isWarmType ? '公益推荐官' : '联创推荐官',
        avatar: `/images/matchmaker${(index % 5) + 1}.jpg`,
        rating: (4.5 + Math.random() * 0.5).toFixed(1),
        years: 2 + Math.floor(Math.random() * 10),
        matches: 50 + Math.floor(Math.random() * 300),
        successRate: (60 + Math.random() * 30).toFixed(0),
        region: ['威海', '青岛', '烟台', '济南', '潍坊'][index % 5],
        serviceType: ['线上咨询', '线下约见', '活动组织', '情感指导'][index % 4],
        introduction: `${isWarmType ? '专注80-90后情感问题解决' : '专业情感社交创业指导'}，${['性格分析', '职业规划', '家庭关系', '情感心理'][index % 4]}领域专家`,
        certification: index % 3 === 0 ? '平台认证' : '高级认证',
        online: index % 4 !== 0,
        fee: isWarmType ? 0 : 199 + Math.floor(Math.random() * 300),
        commissionRate: isWarmType ? 0 : (10 + Math.floor(Math.random() * 10)) + '%'
      };
      
      matchmakers.push(matchmaker);
    }
    
    return matchmakers;
  },

  // 获取随机姓名
  getRandomName() {
    const surnames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴'];
    const givenNames = ['小红', '丽华', '美玲', '秀英', '桂英', '玉兰', '菊花', '荷花', '梅梅', '芳芳'];
    return surnames[Math.floor(Math.random() * surnames.length)] + 
           givenNames[Math.floor(Math.random() * givenNames.length)];
  },

  // 切换推荐官类型
  switchMatchmakerType(e) {
    const index = e.currentTarget.dataset.index;
    const matchmakerTypes = this.data.matchmakerTypes.map((item, idx) => ({
      ...item,
      active: idx === index
    }));
    
    this.setData({
      matchmakerTypes,
      page: 1,
      matchmakers: []
    });
    
    this.loadMatchmakerList();
  },

  // 搜索推荐官
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      'filters.keyword': keyword
    });
    
    // 防抖搜索
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.refreshList();
    }, 500);
  },

  // 筛选条件变化
  onFilterChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    const filters = { ...this.data.filters };
    filters[field] = value;
    
    this.setData({ filters });
    this.refreshList();
  },

  // 刷新列表
  refreshList() {
    this.setData({
      page: 1,
      matchmakers: []
    });
    this.loadMatchmakerList();
  },

  // 打开筛选弹窗
  openFilterModal() {
    this.setData({ showFilterModal: true });
  },

  // 关闭筛选弹窗
  closeFilterModal() {
    this.setData({ showFilterModal: false });
  },

  // 应用筛选条件
  applyFilters() {
    this.refreshList();
    this.closeFilterModal();
  },

  // 重置筛选条件
  resetFilters() {
    this.setData({
      filters: {
        region: '',
        rating: '',
        serviceType: '',
        keyword: ''
      }
    });
    
    this.refreshList();
  },

  // 前往推荐官详情
  goToDetail(e) {
    const matchmakerId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/matchmaker/pages/matchmaker/detail/detail?id=${matchmakerId}`
    });
  },

  // 申请成为推荐官
  applyToBeMatchmaker() {
    // 检查用户权限
    if (!this.data.hasApplyRight) {
      wx.showModal({
        title: '申请条件不符',
        content: '需年满25岁且完成实名认证才能申请成为推荐官',
        confirmText: '去认证',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/subpackages/user/pages/verify/verify'
            });
          }
        }
      });
      return;
    }
    
    // 前往申请页面
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/matchmaker/apply/apply'
    });
  },

  // 联系推荐官
  contactMatchmaker(e) {
    const matchmakerId = e.currentTarget.dataset.id;
    const matchmaker = this.data.matchmakers.find(m => m.id === matchmakerId);
    
    wx.showActionSheet({
      itemList: ['在线聊天', '预约咨询', '拨打电话'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 在线聊天
          wx.navigateTo({
            url: `/subpackages/social/pages/chat/chat?type=matchmaker&id=${matchmakerId}`
          });
        } else if (res.tapIndex === 1) {
          // 预约咨询
          wx.navigateTo({
            url: `/pages/matchmaker/appointment/appointment?id=${matchmakerId}`
          });
        } else {
          // 拨打电话
          wx.makePhoneCall({
            phoneNumber: '400-888-9999'
          });
        }
      }
    });
  }
});