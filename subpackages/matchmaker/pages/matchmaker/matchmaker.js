// pages/matchmaker/matchmaker.js - 社交中心
// 三种状态：
// 1. 未绑定推荐人 → 引导扫码/输入推荐码
// 2. 已绑定推荐人 → 展示我的推荐人介绍 + 其他推荐官列表
// 3. 已是推荐官 → 收益工作台
const { ensureLogin } = require('../../../../utils/auth');
const { request } = require('../../../../utils/request');
const { USER_ROLES, getCommissionRules, getUpgradableRoles, getUpgradeFee, getPlatformRulesSync } = require('../../../../utils/commissionRules');
const { createPayment, PAYMENT_TYPES } = require('../../../../utils/payment');
const { hasReferrer, getReferrerInfo, getReferrerName } = require('../../../../utils/referral');
const authService = require('../../../../services/auth.service');
const API = require('../../../../services/api');

const { DEV_MODE } = require('../../../../utils/config');

// 模拟其他推荐官数据（接口为空时兜底）
const mockMatchmakers = [
  {
    id: 'mk_002',
    name: '王姐',
    role: 'public_matchmaker',
    roleLabel: '公益推荐官',
    avatar: '',
    members: 128,
    rating: 4.9,
    desc: '8年情感社交行业经验，擅长70后80后社交推荐，已成功推荐200+对。',
  },
  {
    id: 'mk_003',
    name: '陈姐',
    role: 'partner_matchmaker',
    roleLabel: '联创推荐官',
    avatar: '',
    members: 256,
    rating: 5.0,
    desc: '专业情感社交顾问，擅长90后00后社交推荐，线上线下活动组织经验丰富。',
  },
  {
    id: 'mk_004',
    name: '刘姐',
    role: 'public_matchmaker',
    roleLabel: '公益推荐官',
    avatar: '',
    members: 67,
    rating: 4.8,
    desc: '银发族情感专家，专注50岁以上会员群体，温暖贴心有耐心。',
  },
  {
    id: 'mk_005',
    name: '张姐',
    role: 'partner_matchmaker',
    roleLabel: '联创推荐官',
    avatar: '',
    members: 189,
    rating: 4.9,
    desc: '再出发群体专属推荐官，理解再次融入社会的需求，已帮助150+人重新找到社交圈。',
  },
];

Page({
  data: {
    // 状态控制
    hasReferrer: false,
    isMatchmaker: false,  // 自己是否是推荐官
    isPartner: false,

    // 我的推荐人信息（已绑定）
    myMatchmaker: null,

    // 其他推荐官列表
    otherMatchmakers: [],

    // 推荐官工作台数据
    currentRole: 'user',
    roleLabel: '',
    matchmakerName: '',
    matchmakerAvatar: '',
    monthIncome: '0.00',
    totalIncome: '0.00',
    totalMembers: 0,
    pendingIncome: '0.00',
    availableIncome: '0.00',
    recentEarnings: [],
    recentMembers: [],
    canUpgrade: false,
    upgradeTargetRole: '',
    upgradeFee: 0,
    showUpgradeModal: false,
    currentTab: 'overview',
    upgradeOptions: [],

    // ===== 业务统计看板 =====
    todayIncome: '0.00',
    // 公益推荐官/联创推荐官业务统计
    memberStats: { count: 0, income: '0.00' },     // 会员建档
    partnerStats: { count: 0, income: '0.00' },    // 推荐联创
    salonStats: { count: 0, income: '0.00' },      // 沙龙补贴
  },

  onLoad(options) {
    const mode = options.mode || '';
    if (mode === 'learn') {
      this.setData({ currentTab: 'overview' });
    }
    ensureLogin().then(() => {
      this.initPage();
    }).catch(() => {});
  },

  onShow() {
    // 每次进入页面都重新获取最新身份状态（推荐官身份可能在其他页面升级）
    this.initPage();
  },

  /**
   * 初始化页面：判断当前状态
   * 注意：推荐官用户会被重定向到各自独立的工作台页面
   * 社交中心页面只处理：未绑定推荐人、已绑定推荐人（但不是推荐官）
   */
  // 推荐官角色 → 对应工作台路由映射
  _getWorkbenchRoute(role) {
    const routes = {
      'public_matchmaker':         '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      'partner_matchmaker':        '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      'city_franchisee':           '/subpackages/partner/pages/franchisee/dashboard/dashboard',
      'professional_recommender':  '/subpackages/matchmaker/pages/recommender/recommender',
      'community_station':          '/subpackages/partner/pages/community-station/workbench/workbench',
    };
    return routes[role] || null;
  },

  async initPage() {
    // 如果是"了解推荐官"模式，跳过推荐官检查和跳转
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const mode = currentPage.options?.mode || '';
    const isLearnMode = mode === 'learn';

    if (DEV_MODE) {
      // ===== 开发模式：完全由身份切换器控制 =====
      const role = authService.getUserRole();
      const isMk = authService.isMatchmaker();
      const hasRef = !!authService.getReferrerId();

      if (isMk && !isLearnMode) {
        // ---- 推荐官身份 → 跳转到对应工作台（按角色区分）----
        const targetUrl = this._getWorkbenchRoute(role) || '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench';
        wx.redirectTo({ url: targetUrl });
        return;
      } else if (hasRef) {
        // ---- 会员身份 → 我的推荐官 + 其他推荐官 ----
        const refInfo = authService.getReferrerInfo() || { name: '李姐推荐官', role: 'public_matchmaker' };
        this.setData({
          hasReferrer: true,
          isMatchmaker: false,
          isPartner: false,
          myMatchmaker: {
            ...refInfo,
            roleLabel: refInfo.role === 'partner_matchmaker' ? '联创推荐官' : '公益推荐官',
            desc: '专业推荐官服务，为您精准推荐，全程跟进。',
            rating: 5.0,
          },
          otherMatchmakers: mockMatchmakers,
        });
      } else {
        // ---- 访客身份 → 引导绑定 ----
        this.setData({
          hasReferrer: false,
          isMatchmaker: false,
          isPartner: false,
          myMatchmaker: null,
        });
      }
    } else {
      // ===== 正式模式：走后端接口 =====
      const bound = hasReferrer();
      const referrerInfo = getReferrerInfo();

      if (bound && referrerInfo) {
        this.setData({
          hasReferrer: true,
          myMatchmaker: {
            ...referrerInfo,
            roleLabel: referrerInfo.role === 'partner_matchmaker' ? '联创推荐官' : '公益推荐官',
            desc: referrerInfo.desc || '专业推荐官服务，为您精准推荐，全程跟进。',
            members: referrerInfo.members || 128,
            rating: referrerInfo.rating || 5.0,
          },
        });
      }

      try {
        const data = await request({ url: API.MATCHMAKER.STATUS });
        const currentRole = data.role || 'user';
        const roleLabel = this._getRoleLabel(currentRole);
        const upgradableRoles = getUpgradableRoles(currentRole);

        // 推荐官用户跳转到各自独立工作台（按角色区分）
        // 但如果是"了解推荐官"模式，则不跳转
        if (data.isMatchmaker && !isLearnMode) {
          const targetUrl = this._getWorkbenchRoute(currentRole) || '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench';
          wx.redirectTo({ url: targetUrl });
          return;
        }

        this.setData({
          isMatchmaker: false,
          currentRole,
          roleLabel,
          isPartner: false,
          canUpgrade: upgradableRoles.length > 0,
          upgradeOptions: this._buildUpgradeOptions(currentRole),
          matchmakerName: data.name || '',
          matchmakerAvatar: data.avatar || '',
        });

        if (upgradableRoles.length > 0) {
          const targetRole = upgradableRoles[0];
          const fee = getUpgradeFee(currentRole, targetRole);
          this.setData({ upgradeTargetRole: targetRole, upgradeFee: fee });
        }
      } catch (e) {}

      // 加载其他推荐官列表
      this.loadOtherMatchmakers();
    }
  },

  /**
   * 加载其他推荐官列表
   */
  loadOtherMatchmakers() {
    request({ url: API.MATCHMAKER.LIST, data: { limit: 10 } })
      .then(data => {
        this.setData({ otherMatchmakers: (data && data.length > 0) ? data : mockMatchmakers });
      })
      .catch(() => {
        this.setData({ otherMatchmakers: mockMatchmakers });
      });
  },

  /**
   * 扫码绑定推荐人
   */
  onScanBind() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode', 'wxCode'],
      success: (res) => {
        const raw = (res.result || '').trim();
        if (!raw) {
          wx.showToast({ title: '未识别到二维码内容', icon: 'none' });
          return;
        }
        // 优先尝试 JSON 格式（兼容旧版 matchmaker_referral 类型二维码）
        try {
          const params = JSON.parse(raw);
          if (params.type === 'matchmaker_referral' && params.id) {
            this.bindMatchmaker(params.id, params.name);
            return;
          }
        } catch (e) { /* 非 JSON 格式，继续尝试纯推荐码 */ }
        // 其次尝试识别纯推荐码（如 RC001、LCRG001）
        const { extractCodeFromScanResult } = require('../../../../utils/referral');
        const code = extractCodeFromScanResult(raw);
        if (code) {
          this.bindByReferralCode(code);
          return;
        }
        wx.showToast({ title: '请扫描有效的推荐码', icon: 'none' });
      },
      fail: () => {},
    });
  },

  /**
   * 通过推荐码绑定（适用于扫描普通二维码）
   */
  async bindByReferralCode(code) {
    const { bindByCode } = require('../../../../utils/referral');
    wx.showLoading({ title: '绑定中...' });
    try {
      const result = await bindByCode(code);
      wx.hideLoading();
      if (result.bound) {
        wx.showToast({ title: result.isNew ? '绑定成功' : '已绑定该推荐人', icon: 'success' });
        setTimeout(() => this.initPage(), 500);
      } else {
        wx.showToast({ title: result.reason || '绑定失败，请重试', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '绑定失败', icon: 'none' });
    }
  },

  /**
   * 手动输入推荐码绑定
   */
  onManualBind() {
    wx.showModal({
      title: '输入推荐码',
      editable: true,
      placeholderText: '请输入推荐码',
      confirmText: '绑定',
      confirmColor: '#C8102E',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this.bindMatchmaker(res.content.trim());
        }
      },
    });
  },

  /**
   * 绑定推荐人
   */
  async bindMatchmaker(id, name) {
    const { bindReferrer } = require('../../../../utils/referral');
    wx.showLoading({ title: '绑定中...' });
    try {
      const result = await bindReferrer(id);
      wx.hideLoading();
      if (result.bound) {
        wx.showToast({ title: result.isNew ? '绑定成功' : '已绑定该推荐人', icon: 'success' });
        // 重新初始化页面
        setTimeout(() => this.initPage(), 500);
      } else {
        wx.showToast({ title: '绑定失败，请重试', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '绑定失败', icon: 'none' });
    }
  },

  /**
   * 查看其他推荐官详情（暂跳首页，后续接详情页）
   */
  onTapMatchmaker(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '推荐官详情页开发中', icon: 'none' });
  },

  // ===== 推荐官身份相关（保持原有逻辑） =====

  /**
   * 根据当前角色构建升级选项列表
   */
  _buildUpgradeOptions(currentRole) {
    const roleMeta = {
      [USER_ROLES.PARTNER_MATCHMAKER]: {
        icon: '👑', name: '联创推荐官', desc: '入驻费¥399 · 会员建档¥99/人 · 沙龙补贴¥99/次',
      },
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: {
        icon: '💎', name: '专业推荐官', desc: '升级费¥3999 · 会员建档¥99/人 · 独家推荐城市合伙人',
      },
      [USER_ROLES.CITY_FRANCHISEE]: {
        icon: '🏙️', name: '城市合伙人', desc: '加盟费¥10000 · 承办沙龙 · 区域沉淀资金70%',
      },
      [USER_ROLES.COMMUNITY_STATION]: {
        icon: '🌿', name: '社区服务站', desc: '免费入驻·审核制·本社区沉淀资金20%',
      },
    };

    const upgradableRoles = getUpgradableRoles(currentRole);
    return upgradableRoles.map(r => ({
      role: r,
      ...(roleMeta[r] || { icon: '⬆️', name: r, desc: '' }),
      fee: getUpgradeFee(currentRole, r),
    }));
  },

  /**
   * 点击升级入口 — 跳转到对应注册/申请页面
   */
  onUpgradeRole(e) {
    const { role } = e.currentTarget.dataset;

    // 五种身份统一跳转 partner-apply 页面
    const typeMap = {
      [USER_ROLES.PARTNER_MATCHMAKER]: 'partner',           // 联创推荐官：补充差异信息后支付
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: 'professional', // 专业推荐官
      [USER_ROLES.CITY_FRANCHISEE]: 'franchisee',            // 城市合伙人
      [USER_ROLES.COMMUNITY_STATION]: 'community',           // 社区服务站：审核制
    };
    const applyType = typeMap[role];
    if (!applyType) {
      wx.showToast({ title: '该身份暂未开放', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=' + applyType });
  },

  _getRoleLabel(role) {
    const labels = {
      [USER_ROLES.USER]: '普通用户',
      [USER_ROLES.PUBLIC_MATCHMAKER]: '公益推荐官',
      [USER_ROLES.PARTNER_MATCHMAKER]: '联创推荐官',
      [USER_ROLES.CITY_FRANCHISEE]: '城市合伙人',
      [USER_ROLES.PROFESSIONAL_RECOMMENDER]: '专业推荐官',
      [USER_ROLES.COMMUNITY_STATION]: '社区服务站',
    };
    return labels[role] || '普通用户';
  },

  _getEarningIcon(type) {
    const icons = {
      // 推荐建档收益
      single_registration: '💑',
      // 推荐联创推荐官
      partner_referral: '👑',
      // 推荐社区服务站
      community_referral: '🌿',
      // 推荐城市合伙人
      city_referral: '🏙️',
      // 沙龙补贴（联创推荐官专属）
      salon_subsidy: '🎉',
      // 沙龙承办收益（城市合伙人）
      salon_host: '🎪',
      // 沉淀资金分成
      platform_fund: '💎',
      // 身份升级
      upgrade: '⬆️',
      default: '💰',
    };
    return icons[type] || icons.default;
  },

  _getEarningTypeName(type) {
    const names = {
      // 推荐建档收益（所有推荐官身份）
      single_registration: '推荐建档',
      // 推荐联创推荐官
      partner_referral: '推荐联创推荐官',
      // 推荐社区服务站
      community_referral: '推荐社区服务站',
      // 推荐城市合伙人
      city_referral: '推荐城市合伙人',
      // 沙龙补贴（联创推荐官专属）
      salon_subsidy: '沙龙补贴',
      // 沙龙承办收益（城市合伙人）
      salon_host: '沙龙承办收益',
      // 沉淀资金分成
      platform_fund: '沉淀资金分成',
      // 身份升级
      upgrade: '身份升级',
    };
    return names[type] || '其他收益';
  },

  /**
   * 申请成为推荐官（首页二宫格 + 状态1卡片入口）
   */
  onApplyMatchmaker() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=public' });
  },

  /**
   * 去绑定推荐人（状态1卡片入口）
   * 支持：URL格式（含referrer_id）、纯推荐码字符串（如 LCRG001）
   */
  onGoBindReferrer() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'wxCode'],
      success: (res) => {
        // 小程序码（太阳码）的 scene 参数无法通过 wx.scanCode 获取
        if (res.scanType === 'WX_CODE') {
          wx.showToast({ title: '请使用推广码页面的普通二维码或手动输入推荐码', icon: 'none', duration: 2000 });
          return;
        }
        const raw = (res.result || '').trim();
        if (!raw) {
          wx.showToast({ title: '二维码内容为空', icon: 'none' });
          return;
        }
        // 方法1：URL 格式（含 referrer_id 参数）
        try {
          const url = new URL(raw);
          const referrerId = url.searchParams.get('referrer_id');
          if (referrerId) {
            const { bindReferrer } = require('../../../../utils/referral');
            bindReferrer(referrerId).then((result) => {
              if (result.bound) {
                this.initPage();
                wx.showToast({ title: '绑定成功', icon: 'success' });
              }
            });
            return;
          }
        } catch (e) { /* 非 URL 格式，尝试方法2 */ }
        // 方法2：纯推荐码格式（如 LCRG001）
        const { extractCodeFromScanResult, bindByCode } = require('../../../../utils/referral');
        const code = extractCodeFromScanResult(raw);
        if (code) {
          bindByCode(code).then((result) => {
            if (result.bound) {
              this.initPage();
              wx.showToast({ title: '绑定成功', icon: 'success' });
            }
          });
        } else {
          wx.showToast({ title: '二维码无效', icon: 'none' });
        }
      },
    });
  },

  onApplyPublic() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=public' });
  },

  onApplyPartner() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=partner' });
  },

  async loadDashboard() {
    request({ url: API.MATCHMAKER.DASHBOARD }).then((data) => {
      // 计算业务统计
      const allEarnings = data.recentEarnings || [];
      let memberCount = 0, memberIncome = 0;
      let partnerCount = 0, partnerIncome = 0;
      let salonCount = 0, salonIncome = 0;

      allEarnings.forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        switch (e.type) {
          case 'single_registration':
            memberCount++;
            memberIncome += amt;
            break;
          case 'partner_referral':
          case 'community_referral':
            partnerCount++;
            partnerIncome += amt;
            break;
          case 'salon_subsidy':
          case 'salon_host':
          case 'salon_participation':
            salonCount++;
            salonIncome += amt;
            break;
        }
      });

      this.setData({
        todayIncome: data.todayIncome || '0.00',
        monthIncome: data.monthIncome || '0.00',
        totalIncome: data.totalIncome || '0.00',
        totalMembers: data.totalMembers || memberCount || 0,
        pendingIncome: data.pendingIncome || '0.00',
        availableIncome: data.availableIncome || '0.00',
        memberStats: {
          count: memberCount || data.totalMembers || 0,
          income: memberIncome.toFixed(2) || '0.00',
        },
        partnerStats: {
          count: partnerCount,
          income: partnerIncome.toFixed(2) || '0.00',
        },
        salonStats: {
          count: salonCount,
          income: salonIncome.toFixed(2) || '0.00',
        },
        recentEarnings: allEarnings.map(e => ({
          ...e,
          typeIcon: this._getEarningIcon(e.type),
          typeName: this._getEarningTypeName(e.type),
        })),
        recentMembers: data.recentMembers || [],
      });
    }).catch(() => {});
  },

  async onWithdraw() {
    const available = parseFloat(this.data.availableIncome);
    if (available < 1) {
      wx.showToast({ title: '暂无可提现金额', icon: 'none' });
      return;
    }

    // 根据角色显示不同的手续费说明（使用同步方法获取最新配置）
    const role = this.data.currentRole;
    const platformRules = getPlatformRulesSync();
    let feeInfo = `提现扣除${(platformRules.WITHDRAWAL_FEE_RATE * 100).toFixed(0)}%平台服务费`;
    let feeRate = platformRules.WITHDRAWAL_FEE_RATE;

    if (role === USER_ROLES.CITY_FRANCHISEE) {
      // 沉淀资金 = 合伙人70% + 平台30%，提现直接拿70%净额，无额外扣费
      const platformFundShare = require('../../../../utils/commissionRules').getPlatformFundShareSync();
      const fundRate = platformFundShare.CITY_FRANCHISEE_RATE;
      feeInfo = `沉淀资金分成${(fundRate * 100).toFixed(0)}%（已为净额，无额外扣费）`;
      feeRate = 0;
    } else if (role === USER_ROLES.COMMUNITY_STATION) {
      feeInfo = `提现扣除${(platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE * 100).toFixed(0)}%平台服务费`;
      feeRate = platformRules.COMMUNITY_STATION_WITHDRAWAL_FEE;
    }

    const fee = (available * feeRate).toFixed(2);
    const actual = (available * (1 - feeRate)).toFixed(2);

    wx.showModal({
      title: '申请提现',
      content: `当前可提现 ¥${available}\n${feeInfo}\n实际到账 ¥${actual}`,
      confirmText: '确认提现',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '提交中...' });
            await request({ url: API.MATCHMAKER.WITHDRAW, method: 'POST' });
            wx.hideLoading();
            wx.showToast({ title: '提现申请已提交', icon: 'success' });
            this.loadDashboard();
        } catch (e) {
          wx.hideLoading();
          // 404 静默处理：功能未实现时提示用户
          if (e && (e.code === 404 || e.statusCode === 404)) {
            wx.showToast({ title: '功能开发中', icon: 'none' });
            return;
          }
          wx.showToast({ title: e.message || '提现失败', icon: 'none' });
        }
        }
      },
    });
  },

  onSwitchTab(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab });
  },

  onViewQrcode() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/qrcode' });
  },

  onViewMembers() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=members' });
  },

  onViewEarnings() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=earnings' });
  },

  /**
   * 头像加载失败兜底（通用）
   * WXML 中需加 binderror="onAvatarError" data-field="字段名"
   */
  onAvatarError(e) {
    const field = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field) || '';
    if (field && field.indexOf('.') === -1) {
      this.setData({ [field]: '/assets/images/default-avatar.png' });
    }
  },

  /**
   * 列表头像加载失败（循环中使用）
   * WXML 中需加 binderror="onListAvatarError" data-index="{{index}}"
   */
  onListAvatarError(e) {
    const idx = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
    if (idx !== undefined && this.data.recentMembers && this.data.recentMembers[idx]) {
      this.setData({
        [`recentMembers[${idx}].avatar`]: '/assets/images/default-avatar.png',
      });
    }
  },
});
