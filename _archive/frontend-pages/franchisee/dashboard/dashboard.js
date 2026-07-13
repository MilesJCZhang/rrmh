// pages/franchisee/dashboard/dashboard.js - 城市合伙人工作台
const app = getApp();
const commissionRules = require('../../../utils/commissionRules');
const authService = require('../../../services/auth.service');  // 引入认证服务层
const incomeService = require('../../../services/income.service');
const referralService = require('../../../services/referral.service');
const { getVerificationStatus } = require('../../../utils/verification');

// 页面
Page({
  data: {
    userId: '',
    joinTime: '',

    // 收益概览
    todayIncome: '0.00',
    monthIncome: '0.00',
    totalIncome: '0.00',
    withdrawable: '0.00',

    // 三大业务统计
    recommenderCount: 0,     // 推荐官数量（推荐了多少推荐官）
    recommenderIncome: '0.00',
    memberCount: 0,          // 会员数量
    memberIncome: '0.00',
    salonCount: 0,           // 沙龙场次（含参与/举办）
    salonIncome: '0.00',
    platformFundIncome: '0.00',  // 沉淀资金分成

    // 最近收益记录
    recentRecords: [],

    // 可升级身份列表
    upgradeTargets: [],

    // 洞察数据
    insightStats: {},
    insightReferralChain: [],
  },

  onLoad() {
    this._checkAuth();
    this._loadData();
    this._buildUpgradeTargets();
  },

  onShow() {
    this._startAutoRefresh();
    this._loadData();
  },
  onHide() {
    this._stopAutoRefresh();
  },

  // ===== 构建可升级身份列表 =====
  _buildUpgradeTargets() {
    const { USER_ROLES, getUpgradableRoles, getUpgradeFee } = commissionRules;
    const role = USER_ROLES.CITY_FRANCHISEE;
    const upgradable = getUpgradableRoles(role) || [];

    const labelMap = {
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: '专业推荐官',
    };
    const iconMap = {
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: '🏅',
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
    const { fee, label } = e.currentTarget.dataset;
    wx.showModal({
      title: `升级为${label}`,
      content: `需缴纳 ¥${fee}，是否确认升级？`,
      confirmText: '确认升级',
      cancelText: '稍后再说',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional' });
        }
      },
    });
  },

  // ===== 权限检查 =====
  _checkAuth() {
    // 使用 auth.service 统一读取状态
    if (!authService.isLogin()) {
      const { requireLogin } = require('../../../utils/auth');
      requireLogin('请先登录', false);
      return false;
    }
    const role = authService.getUserRole();
    const isFranchisee = role === commissionRules.USER_ROLES.CITY_FRANCHISEE
      || role === 'city_franchisee';
    if (!isFranchisee) {
      wx.showModal({
        title: '提示',
        content: '您还不是城市合伙人',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return false;
    }
    return true;
  },

  // ===== 数据加载（真实 API）=====
  _loadData() {
    const userInfo = authService.getUserInfo();
    if (!userInfo) return;

    const userId = userInfo.id || '';
    const joinTime = userInfo.joinedAt
      ? new Date(userInfo.joinedAt).toLocaleDateString()
      : '';

    this.setData({ userId, joinTime });
    wx.showLoading({ title: '加载中...' });

    Promise.all([
      incomeService.getSummary().catch(() => null),
      incomeService.getRecords({ page: 1, limit: 10 }).catch(() => null),
      referralService.getMyInsight().catch(() => null),
    ]).then(([summaryRes, recordsRes, insightRes]) => {
      wx.hideLoading();

      const summary = summaryRes || {};
      const recordsData = recordsRes || {};
      const insight = insightRes || {};
      const recentRecords = Array.isArray(recordsData) ? recordsData : (recordsData.records || recordsData.list || []);
      const stats = insight.stats || {};
      const referredUsers = insight.referred_users || [];

      // 从最近记录中统计业务数据
      let recommenderCount = 0, recommenderIncome = 0;
      let memberCount = 0, memberIncome = 0;
      let salonCount = 0, salonIncome = 0;
      let platformFundIncome = 0;

      (recentRecords || []).forEach(r => {
        const amt = parseFloat(r.commission || r.amount || 0);
        const type = r.businessType || r.type || '';
        switch (type) {
          case 'public_matchmaker':
          case 'partner_matchmaker':
          case 'partner_referral':
            recommenderCount++; recommenderIncome += amt; break;
          case 'single_registration':
            memberCount++; memberIncome += amt; break;
          case 'salon_participation':
          case 'salon_host':
          case 'salon_subsidy':
            salonCount++; salonIncome += amt; break;
          case 'platform_fund':
            platformFundIncome += amt; break;
        }
      });

      // 如果 insight 有统计数据，优先使用
      if (stats.recommender_count !== undefined) recommenderCount = stats.recommender_count;
      if (stats.member_count !== undefined) memberCount = stats.member_count;
      if (stats.salon_count !== undefined) salonCount = stats.salon_count;

      const iconMap = {
        single_registration: '💑', partner_referral: '👑',
        city_referral: '🏙️', salon_host: '🎪',
        salon_participation: '🎉', platform_fund: '💎',
      };
      const nameMap = {
        single_registration: '推荐建档', partner_referral: '推荐联创推荐官',
        city_referral: '推荐城市合伙人', salon_host: '沙龙承办收益',
        salon_participation: '沙龙参与', platform_fund: '沉淀资金分成',
      };

      this.setData({
        todayIncome: parseFloat(summary.today_income || summary.todayIncome || 0).toFixed(2),
        monthIncome: parseFloat(summary.month_income || summary.monthIncome || 0).toFixed(2),
        totalIncome: parseFloat(summary.total_income || summary.totalIncome || 0).toFixed(2),
        withdrawable: parseFloat(summary.withdrawable || 0).toFixed(2),
        recommenderCount,
        recommenderIncome: recommenderIncome.toFixed(2),
        memberCount: stats.member_count !== undefined ? stats.member_count : memberCount,
        memberIncome: memberIncome.toFixed(2),
        salonCount,
        salonIncome: salonIncome.toFixed(2),
        platformFundIncome: platformFundIncome.toFixed(2),
        recentRecords: recentRecords.map(r => ({
          id: r.id || '',
          icon: iconMap[r.businessType || r.type] || '💰',
          title: nameMap[r.businessType || r.type] || (r.title || '其他收益'),
          time: this._fmtTime(r.createdAt || r.createTime || r.time || ''),
          amount: parseFloat(r.commission || r.amount || 0).toFixed(2),
          settled: r.status === 'settled' || r.settled === true,
        })),
        // 洞察数据
        insightStats: insight.stats || {},
        insightReferralChain: insight.referral_chain || [],
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('[franchisee] 加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  _fmtTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  },

  // ===== 操作 =====
  onWithdraw() {
    // —— 强制实名认证检查（使用 auth.service 统一状态）——
    if (authService.isMatchmaker()) {
      const { isVerified, status } = getVerificationStatus();
      if (!isVerified) {
        if (status === 'pending') {
          wx.showModal({ title: '实名认证审核中', content: '您的实名认证正在审核中，请耐心等待审核结果后再尝试提现。', showCancel: false });
        } else if (status === 'rejected') {
          wx.showModal({ title: '实名认证未通过', content: '您的实名认证未通过，请重新提交认证后再尝试提现。', confirmText: '立即认证', success: (res) => { if (res.confirm) wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' }); } });
        } else {
          wx.showModal({ title: '需要实名认证', content: '根据平台规定，提现前需完成实名认证。是否立即前往认证？', confirmText: '立即认证', success: (res) => { if (res.confirm) wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' }); } });
        }
        return;
      }
    }

    // —— 原有提现逻辑 ——（使用同步方法获取最新配置）
    const withdrawable = parseFloat(this.data.withdrawable);
    if (withdrawable <= 0) {
      wx.showToast({ title: '无可提现余额', icon: 'none' });
      return;
    }

    // 城市合伙人：沉淀资金 = 合伙人70% + 平台30%，可提现 = 合伙人70%净额
    const platformFundShare = commissionRules.getPlatformFundShareSync();
    const fundRate = platformFundShare.CITY_FRANCHISEE_RATE;

    wx.showModal({
      title: '提现确认',
      content: `可提现 ¥${withdrawable}\n（沉淀资金：${(fundRate * 100).toFixed(0)}%）\n实际到账 ¥${withdrawable}（已为净额，无额外扣费）`,
      success: res => {
        if (res.confirm) {
          wx.showToast({ title: '提现申请已提交', icon: 'success' });
        }
      },
    });
  },

  onGoQrcode() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/qrcode' });
  },
  onGoVerify() {
    wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' });
  },
  onGoSalonCreate() {
    wx.navigateTo({ url: '/subpackages/social/pages/salon/salon' });
  },

  onGoMemberList() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=members' });
  },

  onGoRecommenderList() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/matchmaker' });
  },

  onGoSalonList() {
    wx.navigateTo({ url: '/subpackages/social/pages/salon/salon' });
  },

  onGoAllRecords() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings' });
  },

  onGoWithdrawRecord() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings' });
  },

  onShareAppMessage() {
    return {
      title: '人人媒好·城市合伙人',
      path: '/pages/index/index?from=franchisee&id=' + this.data.userId,
      imageUrl: '/images/share.jpg',
    };
  },

  _stopAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  },
  _startAutoRefresh() {
    this._stopAutoRefresh();
    this._autoRefreshTimer = setInterval(() => { this._loadData(); }, 30000);
  },
});
