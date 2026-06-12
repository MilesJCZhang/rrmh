// pages/matchmaker-workbench/matchmaker-workbench.js
// 推荐官工作台 - 公益推荐官 / 联创推荐官
// ============================================================
// 数据层：统一走 services/income.service.js，不内联 Mock
// 上线切换：只需将 utils/config.js 中 ENV 改为 'prod'
// ============================================================
const app = getApp();
const commissionRules = require('../../utils/commissionRules');
const incomeService = require('../../services/income.service');
const referralService = require('../../services/referral.service');
const authService = require('../../services/auth.service');
const { getVerificationStatus } = require('../../utils/verification');
const { ensureLogin } = require('../../utils/auth');

// 页面
Page({
  data: {
    // 身份信息
    role: '',
    roleLabel: '',
    userId: '',
    userName: '',
    joinTime: '',

    // 收益概览
    todayIncome: '0.00',
    monthIncome: '0.00',
    totalIncome: '0.00',
    withdrawable: '0.00',

    // 业务统计
    memberStats: { count: 0, income: '0.00' },
    partnerStats: { count: 0, income: '0.00' },
    salonStats: { count: 0, income: '0.00' },

    // 最近收益记录
    recentRecords: [],

    // 洞察数据（推荐码、推荐用户、推荐链）
    insightCodeInfo: null,
    insightStats: {},
    insightReferredUsers: [],
    insightReferralChain: [],
    myReferrals: [],         // 我推荐的人（过滤后）

    // 加载状态
    upgradeTargets: [],

    // 加载状态
    loading: false,
  },

  onLoad() {
    this._checkAuth();
  },

  onShow() {
    ensureLogin().then(() => {
      this._loadData();
      this._buildUpgradeTargets();
    }).catch(() => {});
  },

  // ===== 权限检查 =====
  _checkAuth() {
    // 使用 auth.service 统一读取状态
    if (!authService.isLogin()) {
      require('../../utils/auth').requireLogin('请先登录', false);
      return false;
    }

    const userInfo = authService.getUserInfo() || {};
    const role = userInfo.role || authService.getUserRole();
    const rawRole = (role || '').trim().toLowerCase().replace(/_/g, '');
    const isPartner = rawRole.includes('partner') || role === commissionRules.USER_ROLES.PARTNER_MATCHMAKER;
    const isPublic = rawRole.includes('public') || role === commissionRules.USER_ROLES.PUBLIC_MATCHMAKER;

    if (!isPublic && !isPartner) {
      wx.showModal({
        title: '提示',
        content: '您还不是推荐官',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return false;
    }

    const roleLabel = isPartner ? '联创推荐官' : '公益推荐官';
    this.setData({ role, roleLabel });
    wx.setNavigationBarTitle({ title: `${roleLabel}工作台` });
    return true;
  },

  // ===== 数据加载（统一走 income.service）=====
  async _loadData() {
    // 使用 auth.service 统一读取状态
    const userInfo = authService.getUserInfo();
    if (!userInfo) return;

    const role = userInfo.role || authService.getUserRole();
    const rawRole = (role || '').toLowerCase().replace(/_/g, '');
    const isPartner = rawRole.includes('partner')
      || role === commissionRules.USER_ROLES.PARTNER_MATCHMAKER;
    const roleLabel = isPartner ? '联创推荐官' : '公益推荐官';

    const userId = userInfo.id || userInfo._id || '';
    const userName = userInfo.nickname || userInfo.name || '推荐官';
    const joinTime = userInfo.joinedAt || userInfo.created_at
      ? new Date(userInfo.joinedAt || userInfo.created_at).toLocaleDateString()
      : '--';

    this.setData({ loading: true, userId, userName, joinTime, roleLabel });

    try {
      // 并发请求：收益数据 + 洞察数据
      const [wbResult, insResult] = await Promise.all([
        incomeService.loadWorkbenchData(role).catch(e => null),
        referralService.getMyInsight().catch(e => null),
      ]);

      const { summary, stats, records } = wbResult || {};
      const insight = insResult || {};

      // 过滤出"我推荐的人"，并格式化日期
      const rawChain = insight.referral_chain || [];
      const myReferrals = rawChain
        .filter(r => r.direction === 'referrer')
        .map(r => ({
          ...r,
          dateStr: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '--'
        }))
        .slice(0, 10);

      this.setData({
        todayIncome: summary?.todayIncome || '0.00',
        monthIncome: summary?.monthIncome || '0.00',
        totalIncome: summary?.totalIncome || '0.00',
        withdrawable: summary?.withdrawable || '0.00',
        memberStats: { count: stats?.memberCount || 0, income: stats?.memberIncome || '0.00' },
        partnerStats: { count: stats?.partnerCount || 0, income: stats?.partnerIncome || '0.00' },
        salonStats:  { count: stats?.salonCount || 0,  income: stats?.salonIncome || '0.00' },
        recentRecords: records || [],
        insightCodeInfo: insight.code_info || null,
        insightStats: insight.stats || {},
        insightReferredUsers: (insight.referred_users || []).slice(0, 10),
        insightReferralChain: insight.referral_chain || [],
        myReferrals,
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '数据加载失败', icon: 'none' });
      console.error('[工作台] 数据加载失败', err);
    }
  },

  // ===== 构建可升级身份列表 =====
  _buildUpgradeTargets() {
    // 使用 auth.service 统一读取状态
    const userInfo = authService.getUserInfo() || {};
    const role = userInfo.role || authService.getUserRole();
    if (!role) return;

    const { getUpgradableRoles, getUpgradeFee, USER_ROLES } = commissionRules;

    let upgradable = getUpgradableRoles(role) || [];

    const labelMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]:      '联创推荐官',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]:'专业推荐官',
      [USER_ROLES.CITY_FRANCHISEE]:         '城市合伙人',
      [USER_ROLES.COMMUNITY_STATION]:       '社区服务站',
    };
    const iconMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]:      '👑',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]:'🏅',
      [USER_ROLES.CITY_FRANCHISEE]:         '🏙️',
      [USER_ROLES.COMMUNITY_STATION]:       '🏘️',
    };

    const targets = upgradable.map(targetRole => ({
      role:  targetRole,
      label: labelMap[targetRole] || targetRole,
      icon:  iconMap[targetRole] || '⭐',
      fee:   getUpgradeFee(role, targetRole),
    }));

    this.setData({ upgradeTargets: targets });
  },

  // ===== 升级操作 =====
  onUpgrade(e) {
    const { role, fee, label } = e.currentTarget.dataset;
    const content = fee > 0
      ? `需缴纳 ¥${fee}，是否确认升级？`
      : `${label}为免费入驻·审核制，是否确认申请？`;

    wx.showModal({
      title: fee > 0 ? `升级为${label}` : `入驻${label}`,
      content,
      confirmText: fee > 0 ? '确认升级' : '确认申请',
      cancelText: '稍后再说',
      success: res => {
        if (res.confirm) this._doUpgrade(role);
      },
    });
  },

  _doUpgrade(role) {
    const { USER_ROLES } = commissionRules;
    const routeMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]:      '/subpackages/matchmaker/pages/matchmaker/apply?type=partner',
      [USER_ROLES.CITY_FRANCHISEE]:         '/subpackages/partner/pages/partner-apply/partner-apply?type=franchisee',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]:'/subpackages/partner/pages/partner-apply/partner-apply?type=professional',
      [USER_ROLES.COMMUNITY_STATION]:       '/subpackages/partner/pages/partner-apply/partner-apply?type=community',
    };
    const url = routeMap[role];
    if (url) wx.navigateTo({ url });
  },

  // ===== 提现 =====
  onWithdraw() {
    // —— 强制实名认证检查（使用 auth.service 统一状态）——
    // 推荐官角色需要实名认证才能提现
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
    const platformRules = commissionRules.getPlatformRulesSync();
    const feeRate = platformRules.WITHDRAWAL_FEE_RATE;
    const fee = (withdrawable * feeRate).toFixed(2);
    const actual = (withdrawable * (1 - feeRate)).toFixed(2);

    wx.showModal({
      title: '提现确认',
      content: `可提现 ¥${withdrawable}\n扣除${(feeRate * 100).toFixed(0)}%手续费 ¥${fee}\n实际到账 ¥${actual}`,
      confirmText: '确认提现',
      cancelText: '稍后再说',
      success: res => {
        if (!res.confirm) return;
        incomeService.withdraw(withdrawable)
          .then(() => wx.showToast({ title: '提现申请已提交', icon: 'success' }))
          .catch(() => wx.showToast({ title: '提现失败，请重试', icon: 'none' }));
      },
    });
  },

  // ===== 导航 =====
  onGoQrcode()     { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/qrcode' }); },
  onGoVerify()     { wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' }); },
  onGoMemberList() { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=members' }); },
  onGoEarnings()   { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=earnings' }); },
  onGoSalon()      { wx.navigateTo({ url: '/subpackages/social/pages/salon/salon' }); },
  onGoAllRecords() { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings' }); },
  onGoReferralDetail() { wx.showToast({ title: '推荐关系详情开发中', icon: 'none' }); },

  onShareAppMessage() {
    return {
      title: '人人媒好·推荐官',
      path: '/pages/index/index?from=matchmaker&id=' + this.data.userId,
    };
  },
});
