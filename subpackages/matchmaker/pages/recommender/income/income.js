// pages/recommender/income/income.js - 专业推荐官收益明细页面
const authService = require('../../../../../services/auth.service');
const commissionRules = require('../../../../../utils/commissionRules');
const { getVerificationStatus } = require('../../../../../utils/verification');

Page({
  data: {
    // 收益统计（真实数据从后端接口获取）
    totalIncome: 0,
    withdrawn: 0,
    withdrawable: 0,
    pending: 0,
    weekIncome: 0,
    
    // 收益分布
    incomeDistribution: [],
    
    // 筛选条件
    activeTab: 'month',
    filterTypes: [
      { value: 'all', label: '全部类型' },
      { value: 'single', label: '推荐建档' },
      { value: 'partner', label: '推荐联创' },
      { value: 'city', label: '推荐城市' },
      { value: 'salon', label: '沙龙收益' },
      { value: 'platform', label: '沉淀资金' }
    ],
    filterTypeIndex: 0,
    filterStatus: [
      { value: 'all', label: '全部状态' },
      { value: 'settled', label: '已结算' },
      { value: 'pending', label: '待结算' }
    ],
    filterStatusIndex: 0,
    filterDate: '',
    
    // 收益记录（真实数据从后端获取）
    incomeRecords: [],
    filteredRecords: [],
    currentPage: 1,
    pageSize: 10,
    hasMore: false,
    
    // 提现记录（真实数据从后端获取）
    recentWithdrawals: []
  },

  onLoad: function(options) {
    this.checkRecommenderStatus();
    this.filterRecords();
  },

  // 检查推荐官状态
  checkRecommenderStatus: function() {
    const isLogin = authService.isLogin();
    const userInfo = authService.getUserInfo();
    
    if (!isLogin || userInfo.role !== commissionRules.USER_ROLES.PROFESSIONAL_RECOMMENDER) {
      wx.showModal({
        title: '提示',
        content: '请先开通业务推荐官',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional'
          });
        }
      });
      return false;
    }
    return true;
  },

  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    // 实际应用中这里应该重新加载对应时间段的数据
  },

  // 筛选记录
  filterRecords: function() {
    const typeFilter = this.data.filterTypes[this.data.filterTypeIndex].value;
    const statusFilter = this.data.filterStatus[this.data.filterStatusIndex].value;
    const dateFilter = this.data.filterDate;
    
    let filtered = this.data.incomeRecords;
    
    // 按类型筛选
    if (typeFilter !== 'all') {
      const typeMap = {
        single: '推荐建档',
        partner: '推荐联创',
        city: '推荐城市',
        salon: '沙龙收益',
        platform: '沉淀资金'
      };
      filtered = filtered.filter(item => item.type === typeMap[typeFilter]);
    }
    
    // 按状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // 按日期筛选（实际应用中需要更精确的日期过滤）
    if (dateFilter) {
      filtered = filtered.filter(item => item.time.includes(dateFilter));
    }
    
    // 分页
    const start = (this.data.currentPage - 1) * this.data.pageSize;
    const paginated = filtered.slice(0, start + this.data.pageSize);
    const hasMore = paginated.length < filtered.length;
    
    this.setData({
      filteredRecords: paginated,
      hasMore: hasMore
    });
  },

  // 筛选类型变化
  onFilterTypeChange: function(e) {
    this.setData({
      filterTypeIndex: e.detail.value,
      currentPage: 1
    });
    this.filterRecords();
  },

  // 筛选状态变化
  onFilterStatusChange: function(e) {
    this.setData({
      filterStatusIndex: e.detail.value,
      currentPage: 1
    });
    this.filterRecords();
  },

  // 选择日期
  selectDate: function() {
    const that = this;
    wx.showDatePicker({
      currentDate: new Date(),
      success: (res) => {
        const date = res.date;
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        that.setData({
          filterDate: formatted,
          currentPage: 1
        });
        that.filterRecords();
      }
    });
  },

  // 显示筛选弹窗
  showFilter: function() {
    // 实际应用中这里可以显示更复杂的筛选弹窗
    wx.showToast({
      title: '使用上方筛选器',
      icon: 'none'
    });
  },

  // 加载更多
  loadMore: function() {
    if (!this.data.hasMore) return;
    
    this.setData({
      currentPage: this.data.currentPage + 1
    });
    this.filterRecords();
  },

  // 提现操作
  onWithdraw: function() {
    // —— 强制实名认证检查（专业推荐官提现前必须实名）——
    const { isVerified, status } = getVerificationStatus();
    if (!isVerified) {
      if (status === 'pending') {
        wx.showModal({
          title: '实名认证审核中',
          content: '您的实名认证正在审核中，请耐心等待审核结果后再尝试提现。',
          showCancel: false,
        });
      } else if (status === 'rejected') {
        wx.showModal({
          title: '实名认证未通过',
          content: '您的实名认证未通过，请重新提交认证后再尝试提现。',
          confirmText: '立即认证',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' });
            }
          }
        });
      } else {
        wx.showModal({
          title: '需要实名认证',
          content: '根据平台规定，提现前需完成实名认证。是否立即前往认证？',
          confirmText: '立即认证',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' });
            }
          }
        });
      }
      return;
    }

    // —— 原有提现逻辑 ——
    const withdrawable = this.data.withdrawable;
    if (withdrawable < 100) {
      wx.showModal({
        title: '提示',
        content: `最低提现金额为100元，当前可提现${withdrawable}元`,
        showCancel: false
      });
      return;
    }

    // 根据角色显示不同的手续费说明（使用同步方法获取最新配置）
    const userInfo = authService.getUserInfo();
    const role = userInfo && userInfo.role;
    const platformRules = commissionRules.getPlatformRulesSync();
    let feeInfo = '提现扣除13%平台服务费';
    let feeRate = platformRules.WITHDRAWAL_FEE_RATE;
    let actual = (withdrawable * (1 - feeRate)).toFixed(2);

    if (role === commissionRules.USER_ROLES.CITY_FRANCHISEE) {
      // 城市合伙人：沉淀资金分配70%净额（平台30%已预分，无额外扣费）
      feeInfo = '沉淀资金70%净额';
      feeRate = 0;
      actual = withdrawable.toFixed(2); // 全额到账
    } else if (role === commissionRules.USER_ROLES.COMMUNITY_STATION) {
      feeInfo = `提现扣除${(platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE * 100).toFixed(0)}%平台服务费`;
      feeRate = platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE;
      actual = (withdrawable * (1 - feeRate)).toFixed(2);
    }

    const fee = (withdrawable * feeRate).toFixed(2);

    wx.showModal({
      title: '提现申请',
      content: `可提现 ¥${withdrawable}\n${feeInfo}\n实际到账 ¥${actual}`,
      success: (res) => {
        if (res.confirm) {
          this.submitWithdraw();
        }
      }
    });
  },

  // 提交提现申请
  submitWithdraw: function() {
    wx.showLoading({ title: '提交中...' });
    
    // 模拟提现申请
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟成功
      const newWithdrawal = {
        id: 'WD' + new Date().getTime(),
        time: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0,5),
        amount: this.data.withdrawable,
        status: 'processing',
        statusText: '处理中'
      };
      
      // 更新数据
      this.setData({
        withdrawn: this.data.withdrawn + this.data.withdrawable,
        withdrawable: 0,
        recentWithdrawals: [newWithdrawal, ...this.data.recentWithdrawals]
      });
      
      wx.showModal({
        title: '提现申请已提交',
        content: '预计1-3个工作日内到账，请留意微信通知。',
        showCancel: false
      });
    }, 1500);
  },

  // 查看全部提现记录
  viewAllWithdrawals: function() {
    wx.showModal({
      title: '全部提现记录',
      content: '可在提现记录页面查看全部历史记录',
      showCancel: false
    });
    // 实际应用中这里应该跳转到专门的提现记录页面
  },

  // 返回上一页
  onBack: function() {
    wx.navigateBack();
  },

  // 分享页面
  onShareAppMessage: function() {
    return {
      title: '我的推荐官收益 - 人人好媒',
      path: '/subpackages/matchmaker/pages/recommender/income/income',
      imageUrl: '/images/share.jpg'
    };
  }
});