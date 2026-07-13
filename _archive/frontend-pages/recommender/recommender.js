// pages/recommender/recommender.js - 专业推荐官主页面
const app = getApp();
const commissionRules = require('../../utils/commissionRules');
const authService = require('../../services/auth.service');  // 引入认证服务层
const incomeService = require('../../services/income.service');
const referralService = require('../../services/referral.service');

Page({
  data: {
    // 用户信息
    userId: 'RG001',
    upgradeTime: '2026-03-19',
    recommenderLevel: '黄金推荐官',
    originalRoleName: '', // 原始身份名称
    
    // 推广码信息
    qrcodeUrl: '',
    promotionLink: 'https://rrhm.com/promotion/RG001',
    
    // 分润规则速查（同步 commissionRules.js v5，2026-04-25）
    // 仅展示专业推荐官身份可获得收益的业务类型
    // 规则：付费身份推荐第1个无收益（沉淀平台），第2个起全额
    profitRules: [
      { id: 1, icon: '💑', name: '推荐会员建档', fee: 199, commission: 99, desc: '推荐任意数量均享受99元/人（无首推限制）' },
      { id: 2, icon: '👑', name: '推荐联创推荐官', fee: 399, commission: 0, desc: '第1个：无收益；第2个起：全额399元/人' },
      { id: 3, icon: '🏙️', name: '推荐城市合伙人', fee: 10000, commission: 0, desc: '第1个：无收益；第2个起：全额10000元/人，永久享3%沉淀资金分红（独家推荐权）' },
    ],
    
    // 收益数据（真实数据从后端获取）
    todayIncome: 0,
    todayIncomeTrend: 0,
    monthIncome: 0,
    monthIncomeTrend: 0,
    totalIncome: 0,
    withdrawable: 0,
    lastUpdateTime: '',
    
    // 推广数据统计
    totalPromotions: 0,
    promotionData: {
      singles: 0,
      singlesIncome: 0,
      matchmakers: 0,
      matchmakersIncome: 0,
      salons: 0,
      salonsIncome: 0,
      franchises: 0,
      franchisesIncome: 0
    },
    
    // 最近推广记录（真实数据从后端获取）
    recentRecords: [],

    // 推荐码使用记录
    usageRecords: [],

    // 可升级身份列表
    upgradeTargets: [],
  },

  onLoad: function(options) {
    this.loadUserInfo();
    this.checkRecommenderStatus();
    this.loadRecommenderData();
  },

  onShow: function() {
    this._startAutoRefresh();
    this.loadRecommenderData();
    this._buildUpgradeTargets();
    this.loadUsageRecords();
  },
  onHide: function() {
    this._stopAutoRefresh();
  },

  // ===== 构建可升级身份列表 =====
  _buildUpgradeTargets() {
    const { USER_ROLES, getUpgradableRoles, getUpgradeFee } = commissionRules;
    const role = USER_ROLES.PROFESSIONAL_RECOMMENDER;
    const upgradable = getUpgradableRoles(role) || [];

    const labelMap = {
      [USER_ROLES.CITY_FRANCHISEE]: '城市合伙人',
    };
    const iconMap = {
      [USER_ROLES.CITY_FRANCHISEE]: '🏙️',
    };

    const targets = upgradable.map(targetRole => ({
      role: targetRole,
      label: labelMap[targetRole] || targetRole,
      icon: iconMap[targetRole] || '⭐',
      fee: getUpgradeFee(role, targetRole),
    }));

    this.setData({ upgradeTargets: targets });
  },

  // ===== 升级操作 =====
  onUpgrade(e) {
    const { role, fee, label } = e.currentTarget.dataset;
    wx.showModal({
      title: `升级为${label}`,
      content: fee > 0 ? `需缴纳 ¥${fee}，是否确认升级？` : '是否确认申请？',
      confirmText: '确认升级',
      cancelText: '稍后再说',
      success: res => {
        if (res.confirm && fee > 0) {
          wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=franchisee' });
        }
      },
    });
  },

  // 加载用户信息
  loadUserInfo: function() {
    // 使用 auth.service 统一读取状态
    const userInfo = authService.getUserInfo();
    if (userInfo) {
      // 获取原始身份名称（升级前的身份）
      const originalRoleName = userInfo.originalRoleName || '普通用户';

      // 获取升级时间
      const upgradeTime = userInfo.upgradedToRecommenderAt
        ? new Date(userInfo.upgradedToRecommenderAt).toLocaleDateString()
        : '2026-03-19';

      this.setData({
        originalRoleName,
        upgradeTime
      });
    }
  },

  // 检查推荐官状态（仅专业推荐官可使用此页面）
  checkRecommenderStatus: function() {
    // 使用 auth.service 统一读取状态
    if (!authService.isLogin()) {
      const { requireLogin } = require('../../utils/auth');
      requireLogin('请先登录', false);
      return false;
    }

    const role = authService.getUserRole();
    const { USER_ROLES } = commissionRules;

    // 已是专业推荐官 → 通过
    if (role === USER_ROLES.PROFESSIONAL_RECOMMENDER) {
      return true;
    }

    // 其他推荐官角色 → 引导跳转到对应工作台，而非强制升级
    const workbenchMap = {
      [USER_ROLES.PUBLIC_MATCHMAKER]:  '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      [USER_ROLES.PARTNER_MATCHMAKER]: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      [USER_ROLES.CITY_FRANCHISEE]:    '/subpackages/partner/pages/franchisee/dashboard/dashboard',
      [USER_ROLES.COMMUNITY_STATION]:   '/subpackages/partner/pages/community-station/workbench/workbench',
    };

    const targetUrl = workbenchMap[role];
    if (targetUrl) {
      // 已有推荐官身份但不是专业推荐官 → 跳转到自己的工作台
      wx.showModal({
        title: '提示',
        content: '此页面为专业推荐官专属工作台，将为您跳转到当前身份的工作台。',
        showCancel: true,
        cancelText: '留在本页',
        confirmText: '前往工作台',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({ url: targetUrl });
          }
        }
      });
    } else {
      // 普通会员/未建档 → 引导升级
      wx.showModal({
        title: '提示',
        content: '您还不是专业推荐官，请先升级',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional'
          });
        }
      });
    }
    return false;
  },

  // 加载推荐官数据（真实 API）
  loadRecommenderData: function() {
    if (!this.checkRecommenderStatus()) return;

    const userInfo = authService.getUserInfo();
    const userId = userInfo.id;

    wx.showLoading({ title: '加载中...' });

    // 并行请求：洞察数据 + 收益统计 + 最近收益记录
    Promise.all([
      referralService.getMyInsight().catch(err => {
        console.warn('[recommender] 洞察数据获取失败', err);
        return null;
      }),
      incomeService.getSummary().catch(err => {
        console.warn('[recommender] 收益统计获取失败', err);
        return null;
      }),
      incomeService.getRecords({ page: 1, limit: 5 }).catch(err => {
        console.warn('[recommender] 收益记录获取失败', err);
        return null;
      })
    ]).then(([insightRes, summaryRes, recordsRes]) => {
      wx.hideLoading();

      const insight = insightRes || {};
      const summary = summaryRes || {};
      const recordsData = recordsRes || {};
      const recentRecords = Array.isArray(recordsData) ? recordsData : (recordsData.records || recordsData.list || []);

      const stats = insight.stats || {};
      const codeInfo = insight.code_info || {};
      const referredUsers = insight.referred_users || [];

      // 推广数据统计
      let singles = 0, matchmakers = 0, salons = 0, franchises = 0;
      let singlesIncome = 0, matchmakersIncome = 0, salonsIncome = 0, franchisesIncome = 0;
      (recentRecords || []).forEach(record => {
        const amount = parseFloat(record.commission || record.amount || 0);
        switch (record.businessType || record.type) {
          case 'single_registration':
            singles++; singlesIncome += amount; break;
          case 'public_matchmaker':
          case 'partner_matchmaker':
          case 'professional_recommender':
            matchmakers++; matchmakersIncome += amount; break;
          case 'salon_participation':
          case 'salon_host':
          case 'salon_subsidy':
            salons++; salonsIncome += amount; break;
          case 'online_franchisee':
          case 'city_franchisee':
          case 'platform_fund':
            franchises++; franchisesIncome += amount; break;
        }
      });

      const realData = {
        userId: userId || '',
        openTime: userInfo.upgradedToRecommenderAt
          ? new Date(userInfo.upgradedToRecommenderAt).toLocaleDateString()
          : (codeInfo.created_at ? new Date(codeInfo.created_at).toLocaleDateString() : ''),
        recommenderLevel: this.getRecommenderLevel(userInfo),
        qrcodeUrl: '/images/qrcode/recommender.jpg',
        promotionLink: 'https://rrmhdate.cn/pages/register/register?ref=' + (codeInfo.code || ''),
        todayIncome: parseFloat(summary.today_income || summary.todayIncome || 0),
        monthIncome: parseFloat(summary.month_income || summary.monthIncome || 0),
        totalIncome: parseFloat(summary.total_income || summary.totalIncome || 0),
        withdrawable: parseFloat(summary.withdrawable || 0),
        totalPromotions: stats.total_referred || referredUsers.length || 0,
        promotionData: {
          singles: stats.singles_count || singles,
          singlesIncome: stats.singles_income || singlesIncome,
          matchmakers: stats.matchmakers_count || matchmakers,
          matchmakersIncome: stats.matchmakers_income || matchmakersIncome,
          salons: stats.salons_count || salons,
          salonsIncome: stats.salons_income || salonsIncome,
          franchises: stats.franchises_count || franchises,
          franchisesIncome: stats.franchises_income || franchisesIncome
        },
        recentRecords: recentRecords.length > 0 ? recentRecords.map(record => ({
          id: record.id || '',
          icon: this.getBusinessIcon(record.businessType || record.type || ''),
          userName: record.userName || record.nickname || ('用户' + (record.userId || '').slice(-4)),
          time: this.formatTime(record.createdAt || record.createTime || record.time),
          type: this.getBusinessTypeName(record.businessType || record.type || ''),
          commission: parseFloat(record.commission || record.amount || 0)
        })) : this.data.recentRecords || []
      };

      this.setData(realData);
    }).catch(err => {
      wx.hideLoading();
      console.error('[recommender] 加载数据失败:', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    });
  },
  
  getBusinessIcon: function(businessType) {
    const iconMap = {
      // 推荐建档
      'single_registration': '💑',
      // 推荐联创推荐官
      'partner_referral': '👑',
      // 推荐城市合伙人
      'city_referral': '🏙️',
      // 沙龙补贴
      'salon_subsidy': '🎉',
      // 沉淀资金分成
      'platform_fund': '💎',
    };
    return iconMap[businessType] || '💰';
  },

  getBusinessTypeName: function(businessType) {
    const nameMap = {
      // 推荐建档（所有推荐官身份）
      'single_registration': '推荐建档',
      // 推荐联创推荐官（第2个起399元）
      'partner_referral': '推荐联创推荐官',
      // 推荐城市合伙人（第2个起10000元+3%沉淀）
      'city_referral': '推荐城市合伙人',
      // 沙龙补贴
      'salon_subsidy': '沙龙补贴',
      // 沉淀资金分成
      'platform_fund': '沉淀资金分成',
    };
    return nameMap[businessType] || '其他收益';
  },
  
  formatTime: function(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 172800000) return '昨天 ' + date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  },

  // 根据用户数据计算推荐官等级
  getRecommenderLevel: function(userInfo) {
    const totalIncome = this.data.totalIncome || 0;
    if (totalIncome >= 100000) return '钻石推荐官';
    if (totalIncome >= 50000) return '铂金推荐官';
    if (totalIncome >= 20000) return '黄金推荐官';
    return '普通推荐官';
  },

  // 导航函数
  onGoQrcode: function() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/qrcode' });
  },

  navigateToPromotion: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/promotion/promotion'
    });
  },

  navigateToIncome: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/income/income'
    });
  },

  navigateToTeam: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/team/team'
    });
  },

  navigateToSettings: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/settings/settings'
    });
  },

  navigateToProfitRules: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/rules/rules'
    });
  },

  navigateToPromotionRecords: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/records/records'
    });
  },

  navigateToPromotionGuide: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/guide/guide'
    });
  },

  // 加载推荐码使用记录
  loadUsageRecords: function() {
    const { DEV_MODE } = require('../../utils/config');
    if (DEV_MODE) {
      console.log('[recommender] DEV_MODE: 跳过 usage-records API');
      return;
    }
    const { request } = require('../../utils/request');
    const userInfo = authService.getUserInfo();
    const userId = userInfo?.id || this.data.userId;

    request({
      url: '/api/referral-codes/usage-records',
      method: 'GET',
      data: {
        user_id: userId,
        page: 1,
        page_size: 10
      }
    }).then(res => {
      if (res.success && res.records) {
        this.setData({
          usageRecords: res.records.map(record => ({
            id: record.id,
            user_name: record.user_name,
            scene: record.scene,
            scene_name: record.scene_name,
            code: record.code,
            time_ago: record.time_ago,
            created_at: record.created_at
          }))
        });
      }
    }).catch(err => {
      console.error('[recommender] 加载使用记录失败:', err);
    });
  },

  // 查看使用记录详情
  navigateToUsageRecords: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/usage-records/usage-records'
    });
  },

  // 查看分润详情
  viewProfitDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const rule = this.data.profitRules.find(item => item.id === id);
    if (rule) {
      wx.showModal({
        title: rule.name + ' - 分润详情',
        content: `业务费用：¥${rule.fee}\n推荐官分润：¥${rule.commission}\n规则说明：${rule.desc}`,
        showCancel: false
      });
    }
  },

  // 保存二维码
  saveQrcode: function() {
    wx.showLoading({ title: '保存中...' });
    
    // 模拟保存二维码
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '二维码已保存到相册',
        icon: 'success'
      });
    }, 1000);
  },

  // 生成海报
  generatePoster: function() {
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/recommender/poster/poster'
    });
  },

  // 复制推广链接
  copyLink: function() {
    wx.setClipboardData({
      data: this.data.promotionLink,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  // 提现操作
  onWithdraw: function() {
    const withdrawable = this.data.withdrawable;
    if (withdrawable <= 0) {
      wx.showToast({
        title: '无可提现余额',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '提现申请',
      content: `确定提现 ¥${withdrawable} 吗？`,
      success: (res) => {
        if (res.confirm) {
          this.submitWithdraw();
        }
      }
    });
  },

  // 提交提现申请
  submitWithdraw: function() {
    wx.showLoading({ title: '处理中...' });
    
    // 模拟提现处理
    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '提现申请已提交',
        content: '预计1-3个工作日内到账，请留意微信通知。',
        showCancel: false
      });
    }, 1500);
  },

  // 页面分享
  onShareAppMessage: function() {
    return {
      title: '我是人人好媒推荐官，邀请您加入专业社交平台',
      path: '/pages/index/index?promoter=' + this.data.userId,
      imageUrl: '/images/share.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '人人好媒推荐官 - 全业务推广，多重收益',
      query: 'promoter=' + this.data.userId,
      imageUrl: '/images/share.jpg'
    };
  },

  _stopAutoRefresh: function() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  },
  _startAutoRefresh: function() {
    this._stopAutoRefresh();
    this._autoRefreshTimer = setInterval(() => { this.loadRecommenderData(); }, 30000);
  },
});