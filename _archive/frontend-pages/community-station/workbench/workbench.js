// pages/community-station/workbench/workbench.js
// 社区服务站工作台
const authService = require('../../../services/auth.service');
const commissionRules = require('../../../utils/commissionRules');
const incomeService = require('../../../services/income.service');
const referralService = require('../../../services/referral.service');
const { getVerificationStatus } = require('../../../utils/verification');

Page({
  data: {
    // 身份信息
    role: '',
    roleLabel: '社区服务站',
    userId: '',
    userName: '',
    joinTime: '',
    communityName: '',  // 服务站所在社区

    // 收益概览
    todayIncome: '0.00',
    monthIncome: '0.00',
    totalIncome: '0.00',
    withdrawable: '0.00',

    // 业务统计
    memberStats: { count: 0, income: '0.00' },
    partnerStats: { count: 0, income: '0.00' },  // 推荐联创（审核制）
    fundStats: { amount: '0.00', rate: '10%' },  // 沉淀资金分成（联创自荐则20%）

    // 最近收益记录
    recentRecords: [],
    myReferrals: [],

    // 身份列表（用于切换）
    identityList: [],
    currentIdentityIndex: 0,

    // 可升级身份列表
    upgradeTargets: [],
  },

  onLoad(options) {
    this._checkAuth();
  },

  onShow() {
    this._startAutoRefresh();
    this._loadData();
    this._buildIdentityList();
    this._buildUpgradeTargets();
  },
  onHide() {
    this._stopAutoRefresh();
  },

  // ===== 构建可升级身份列表 =====
  _buildUpgradeTargets() {
    const { USER_ROLES, getUpgradableRoles, getUpgradeFee } = commissionRules;
    const role = USER_ROLES.COMMUNITY_STATION;
    const upgradable = getUpgradableRoles(role) || [];

    const labelMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]: '联创推荐官',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: '专业推荐官',
      [USER_ROLES.CITY_FRANCHISEE]: '城市合伙人',
    };
    const iconMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]: '👑',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: '🏅',
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
    if (fee > 0) {
      wx.showModal({
        title: `升级为${label}`,
        content: `需缴纳 ¥${fee}，是否确认升级？`,
        confirmText: '确认升级',
        cancelText: '稍后再说',
        success: res => {
          if (res.confirm) {
            this._doUpgrade(role);
          }
        },
      });
    } else {
      wx.showModal({
        title: `入驻${label}`,
        content: `${label}为免费入驻·审核制，是否确认申请？`,
        confirmText: '确认申请',
        cancelText: '稍后再说',
        success: res => {
          if (res.confirm) {
            this._doUpgrade(role);
          }
        },
      });
    }
  },

  _doUpgrade(role) {
    const { USER_ROLES } = commissionRules;
    if (role === USER_ROLES.PARTNER_MATCHMAKER) {
      wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply' });
    } else if (role === USER_ROLES.PROFESSIONAL_RECOMMENDER) {
      wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional' });
    } else if (role === USER_ROLES.CITY_FRANCHISEE) {
      wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=franchisee' });
    }
  },

  // ===== 权限检查 =====
  _checkAuth() {
    const isLogin = authService.isLogin();
    if (!isLogin) {
      const { requireLogin } = require('../../../utils/auth');
      requireLogin('请先登录', false);
      return false;
    }

    const userInfo = authService.getUserInfo();
    const role = userInfo && userInfo.role;
    const isCommunityStation = role === commissionRules.USER_ROLES.COMMUNITY_STATION
      || role === 'community_station';

    if (!isCommunityStation) {
      wx.showModal({
        title: '提示',
        content: '您还不是社区服务站',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return false;
    }

    this.setData({ role: role });
    return true;
  },

  // ===== 数据加载（真实 API）=====
  _loadData() {
    const userInfo = authService.getUserInfo();
    if (!userInfo) return;

    const userId = userInfo.id || '';
    const userName = userInfo.nickname || userInfo.name || '服务站';
    const joinTime = userInfo.joinedAt
      ? new Date(userInfo.joinedAt).toLocaleDateString()
      : '';
    const communityName = userInfo.community_name || '本地社区';

    this.setData({ userId, userName, joinTime, communityName });
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
      // 过滤出我推荐的人
      const rawChain=insight.referral_chain||[];
      const myReferrals=rawChain.filter(r=>r.direction==="referrer").map(r=>({...r,dateStr:r.createdAt?new Date(r.createdAt).toLocaleDateString():"--"})).slice(0,10);
      const recentRecords = (Array.isArray(recordsData) ? recordsData : (recordsData.records || recordsData.list || [])).slice(0, 10);
      const stats = insight.stats || {};

      // 统计业务数据
      let memberCount = 0, memberIncome = 0;
      let partnerCount = 0, partnerIncome = 0;
      (recentRecords || []).forEach(r => {
        const amt = parseFloat(r.commission || r.amount || 0);
        const type = r.businessType || r.type || '';
        if (type === 'single_registration') { memberCount++; memberIncome += amt; }
        else if (type === 'partner_referral' || type === 'partner_matchmaker') { partnerCount++; partnerIncome += amt; }
      });

      this.setData({
        todayIncome: parseFloat(summary.today_income || summary.todayIncome || 0).toFixed(2),
        monthIncome: parseFloat(summary.month_income || summary.monthIncome || 0).toFixed(2),
        totalIncome: parseFloat(summary.total_income || summary.totalIncome || 0).toFixed(2),
        withdrawable: parseFloat(summary.withdrawable || 0).toFixed(2),
        memberStats: {
          count: stats.singles_count || memberCount,
          income: (stats.singles_income || memberIncome).toFixed(2),
        },
        partnerStats: {
          count: stats.partner_count || partnerCount,
          income: (stats.partner_income || partnerIncome).toFixed(2),
        },
        fundStats: {
          amount: (stats.fund_amount || 0).toFixed(2),
          rate: stats.fund_rate || '10%',
        },
        recentRecords: recentRecords.map(r => ({
          id: r.id || '',
          icon: this._getIcon(r.businessType || r.type || ''),
          title: this._getTypeName(r.businessType || r.type || ''),
          time: this._formatTime(r.createdAt || r.createTime || r.time || ''),
          amount: parseFloat(r.commission || r.amount || 0).toFixed(2),
          settled: r.status === 'settled' || r.settled === true,
        })),
        myReferrals,
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('[community-station] 加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  _getIcon(businessType) {
    const map = { single_registration: '💑', partner_referral: '👑', salon_subsidy: '🎉', platform_fund: '💎' };
    return map[businessType] || '💰';
  },

  _getTypeName(businessType) {
    const map = { single_registration: '推荐建档', partner_referral: '推荐联创', salon_subsidy: '沙龙补贴', platform_fund: '沉淀资金分成' };
    return map[businessType] || '其他收益';
  },

  _formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  // ===== 构建身份列表（用于切换）=====
  _buildIdentityList() {
    const userInfo = authService.getUserInfo();
    if (!userInfo) return;

    const roles = userInfo.roles || [];
    const currentRole = userInfo.role;

    const roleConfig = {
      public_matchmaker: {
        icon: '🌿', label: '公益推荐官',
        path: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      },
      partner_matchmaker: {
        icon: '👑', label: '联创推荐官',
        path: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      },
      community_station: {
        icon: '🏘️', label: '社区服务站',
        path: '/subpackages/partner/pages/community-station/workbench/workbench',
      },
      professional_recommender: {
        icon: '💎', label: '专业推荐官',
        path: '/subpackages/matchmaker/pages/recommender/recommender',
      },
      city_franchisee: {
        icon: '🏙️', label: '城市合伙人',
        path: '/subpackages/partner/pages/franchisee/dashboard/dashboard',
      },
    };

    // 当前身份排在第一位
    const identityList = [];
    if (currentRole && roleConfig[currentRole]) {
      identityList.push({
        role: currentRole,
        ...roleConfig[currentRole],
        isCurrent: true,
      });
    }

    // 其他身份依次排列
    roles.forEach(r => {
      if (r !== currentRole && roleConfig[r]) {
        identityList.push({
          role: r,
          ...roleConfig[r],
          isCurrent: false,
        });
      }
    });

    this.setData({ identityList });
  },

  // ===== 身份切换 =====
  onSwitchIdentity(e) {
    const index = e.currentTarget.dataset.index;
    const identity = this.data.identityList[index];
    if (!identity || identity.isCurrent) return;

    wx.showModal({
      title: '切换身份',
      content: `确定切换到【${identity.label}】身份吗？`,
      success: res => {
        if (res.confirm) {
          // 使用 authService 统一更新状态
          authService.setUserRole(identity.role);
          // 跳转到对应工作台
          wx.redirectTo({ url: identity.path });
        }
      },
    });
  },

  // ===== 操作 =====
  onWithdraw() {
    // —— 强制实名认证检查（除会员、访客外）——
    const role = authService.getUserRole();
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

    // —— 原有提现逻辑 ——
    const withdrawable = parseFloat(this.data.withdrawable);
    if (withdrawable <= 0) {
      wx.showToast({ title: '无可提现余额', icon: 'none' });
      return;
    }

    // 社区服务站提现手续费13%
    const feeRate = 0.13;
    const fee = (withdrawable * feeRate).toFixed(2);
    const actual = (withdrawable * (1 - feeRate)).toFixed(2);
    wx.showModal({
      title: '提现确认',
      content: `可提现 ¥${withdrawable}\n扣除13%手续费 ¥${fee}\n实际到账 ¥${actual}`,
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
  onGoMemberList() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=members' });
  },

  onGoEarnings() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=earnings' });
  },

  onGoAllRecords() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings' });
  },
  onGoReferralDetail() { wx.showToast({ title: '推荐关系详情开发中', icon: 'none' }); },

  // 查看沉淀资金明细
  onViewFundDetail() {
    wx.showModal({
      title: '沉淀资金说明',
      content: '社区服务站关联业务产生的平台沉淀资金，按10%比例分成给服务站（联创推荐官自荐则独享20%）。分成金额实时更新，可随时提现。',
      showCancel: false,
    });
  },

  onShareAppMessage() {
    return {
      title: '人人媒好·社区服务站',
      path: '/pages/index/index?from=community_station&id=' + this.data.userId,
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
