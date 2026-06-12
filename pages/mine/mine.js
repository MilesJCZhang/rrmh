// pages/mine/mine.js - 我的
const app = getApp();
const { request } = require('../../utils/request');
const { VERIFICATION_STATUS } = require('../../utils/verification');
const { DEV_MODE } = require('../../utils/config'); // 统一配置，上线改 config.js 即可
const { extractCodeFromScanResult } = require('../../utils/referral');
const authService = require('../../services/auth.service');  // 引入认证服务层
const API = require('../../services/api');

// 身份预设配置
const ROLE_PRESETS = {
  member: {
    label: '会员',
    role: 'user',
    id: 'U001',
    isMatchmaker: false,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试会员',
    desc: '普通会员视角',
  },
  guest: {
    label: '访客',
    role: 'user',
    id: 'U000',
    isMatchmaker: false,
    isVerified: false,
    hasProfile: false,
    hasAvatar: false,
    hasReferrer: false,
    nickname: '未登录用户',
    desc: '未登录/未建档视角',
  },
  public_matchmaker: {
    label: '公益推荐官',
    role: 'public_matchmaker',
    id: 'MK135',
    isMatchmaker: true,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试推荐官',
    desc: '推荐官工作台',
  },
  partner_matchmaker: {
    label: '联创推荐官',
    role: 'partner_matchmaker',
    id: 'MK136',
    isMatchmaker: true,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试联创官',
    desc: '联创推荐官工作台',
  },
  city_franchisee: {
    label: '城市合伙人',
    role: 'city_franchisee',
    id: 'CF137',
    isMatchmaker: true,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试合伙人',
    desc: '城市合伙人工作台',
  },
  professional_recommender: {
    label: '专业推荐官',
    role: 'professional_recommender',
    id: 'PR138',
    isMatchmaker: true,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试专业推荐官',
    desc: '专业推荐官工作台',
  },
  community_station: {
    label: '社区服务站',
    role: 'community_station',
    id: 'CS139',
    isMatchmaker: true,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: true,
    nickname: '测试服务站',
    desc: '社区服务站工作台',
  },
  admin: {
    label: '管理员',
    role: 'admin',
    id: 'ADMIN001',
    isMatchmaker: false,
    isVerified: true,
    hasProfile: true,
    hasAvatar: true,
    hasReferrer: false,
    nickname: '系统管理员',
    desc: '管理员视角（含推荐码管理）',
  },
};

Page({
  data: {
    userInfo: {},
    hasProfile: false,
    hasAvatar: false,
    isLogin: false,
    hasNickname: false,
    needsWechatAuth: false,
    isGuest: true,
    pendingIncome: 0,
    verificationStatus: 'none',
    isVerified: false,
    hasReferrer: false,
    referrerName: '',
    // 推荐官身份状态（开发调试用）
    isMatchmaker: false,
    matchmakerRoleLabel: '',
    userRole: '',   // 当前角色 key，用于工作台分流
    // 身份切换
    devMode: DEV_MODE,
    wechatAccount: '',  // 微信号（用于推荐码管理）
    roleKeys: Object.keys(ROLE_PRESETS),
    roleLabels: Object.values(ROLE_PRESETS).map(r => r.label),
    currentRoleIndex: 0,
    currentRoleLabel: '会员',
    // 加载状态
    loading: false,
    // 多角色切换
    roleList: [],           // 真实角色列表（来自 user_info.roleList）
    showRoleSwitch: false, // 是否显示切换身份按钮
    // 角色检测（用于快速入口卡片独立显隐）
    isMember: false,
    isMatchmakerRole: false,
    canJoinMember: true,        // 默认访客可加入会员
    canBecomeMatchmaker: true,  // 默认访客可成为推荐官
  },

  onShow() {
    // 使用 auth.service 统一读取状态（禁止直接读 globalData 或 Storage）
    const userRole = authService.getUserRole();
    const hasAvatar = authService.hasAvatar();
    const hasProfile = authService.hasProfile();
    const isVerified = authService.isVerified();
    const isGuest = authService.isGuest();
    const isMatchmaker = authService.isMatchmaker();
    const userInfo = authService.getUserInfo();
    const referrerId = authService.getReferrerId();
    const referrerInfo = authService.getReferrerInfo();
    const isLogin = authService.isLogin();

    // 判断昵称是否有效（排除默认值和空值）
    const rawNickname = userInfo && userInfo.nickname;
    const hasNickname = !!rawNickname && rawNickname !== '未设置昵称' && rawNickname.trim() !== '';

    // 判断头像是否有效（排除空值和默认头像）
    const rawAvatar = userInfo && userInfo.avatar;
    const isDefaultAvatar = !rawAvatar || rawAvatar.trim() === '' ||
      rawAvatar.includes('default-avatar') ||
      rawAvatar.includes('default_avatar') ||
      (rawAvatar.includes('rrmhdate.cn') === false && rawAvatar.startsWith('http') === false && rawAvatar.startsWith('/') === false);
    const hasRealAvatar = !!rawAvatar && !isDefaultAvatar;

    // 已登录但未完成微信授权（昵称或头像缺失）
    const needsWechatAuth = isLogin && (!hasNickname || !hasRealAvatar);

    // 已登录但缺少微信号（影响推荐码身份匹配）
    const needsWechatAccount = isLogin && userInfo && !userInfo.wechatAccount;

    // 多角色切换：读取真实 roleList
    const roleList = userInfo?.roleList || (userInfo?.role ? [userInfo.role] : []);
    const hasMultipleRoles = roleList.length > 1;

    // 角色检测：根据 roleList 判断用户拥有哪些类型角色（而非只看当前 active role）
    const MATCHMAKER_ROLES = ['public_matchmaker', 'partner_matchmaker', 'professional_recommender', 'community_station', 'city_franchisee'];
    const isMember = roleList.length > 0 && roleList.some(r => r === 'single' || r === 'member');
    const isMatchmakerRole = roleList.length > 0 && roleList.some(r => MATCHMAKER_ROLES.includes(r));
    const canJoinMember = isLogin && !isMember;           // 还不是会员，可加入
    const canBecomeMatchmaker = isLogin && !isMatchmakerRole; // 还不是推荐官，可成为

    // 调试日志：仅开发模式输出，方便排查"菜单不显示"问题
    if (DEV_MODE) {
      console.log('[mine.onShow]', JSON.stringify({
        userRole, hasAvatar, hasProfile, isVerified, isGuest, isMatchmaker,
        referrerId: !!referrerId
      }));
    }

    // 角色标签映射
    const roleLabels = {
      public_matchmaker: '公益推荐官',
      partner_matchmaker: '联创推荐官',
      city_franchisee: '城市合伙人',
      professional_recommender: '专业推荐官',
      community_station: '社区服务站',
      admin: '管理员',
    };

    // 当前角色中文标签（用于身份切换展示）
    const allRoleLabels = {
      user: '普通用户', single: '单身会员', member: '会员',
      ...roleLabels,
    };
    const currentRoleLabel = allRoleLabels[userRole] || userRole || '会员';


    this.setData({
      userInfo: userInfo || {},
      hasProfile,
      hasAvatar,
      isLogin,
      hasNickname,
      needsWechatAuth,
      needsWechatAccount,
      isGuest,
      verificationStatus: app.globalData.verificationStatus || VERIFICATION_STATUS.NONE,
      isVerified,
      hasReferrer: !!referrerId,
      referrerName: (referrerInfo && referrerInfo.name) || '',
      isMatchmaker,
      matchmakerRoleLabel: isMatchmaker ? (roleLabels[userRole] || '推荐官') : '',
      userRole,
      wechatAccount: (userInfo && userInfo.wechatAccount) || '',
      // 多角色切换
      showRoleSwitch: hasMultipleRoles || false,
      roleList: hasMultipleRoles ? roleList : [],
      // 角色检测（用于快速入口卡片显隐）
      isMember,
      isMatchmakerRole,
      canJoinMember,
      canBecomeMatchmaker,
      currentRoleLabel,
    });


    if (isMatchmaker) this.loadPendingIncome();

    // 异步刷新认证状态（后台审核通过后同步到前端）
    if (!isGuest) {
      const { checkVerificationResult } = require('../../utils/verification');
      checkVerificationResult().then((result) => {
        this.setData({
          verificationStatus: result.status || VERIFICATION_STATUS.NONE,
          isVerified: result.isVerified,
        });
      }).catch((err) => {
        console.error('[mine] checkVerificationResult failed:', err);
      });
    }

    // 恢复上次选择的身份（开发模式）
    if (DEV_MODE) {
      const savedIndex = wx.getStorageSync('dev_role_index');
      if (savedIndex !== '' && savedIndex !== undefined) {
        const keys = Object.keys(ROLE_PRESETS);
        this.setData({
          currentRoleIndex: savedIndex,
          currentRoleLabel: ROLE_PRESETS[keys[savedIndex]].label,
        });
      }
    }
  },

  /**
   * 身份切换（仅开发调试）
   * 使用 auth.service 统一写入状态
   */
  onRoleChange(e) {
    const index = e.detail.value;
    const keys = Object.keys(ROLE_PRESETS);
    const preset = ROLE_PRESETS[keys[index]];
    const isMk = preset.isMatchmaker || false;

    // 使用 auth.service 统一写入状态
    authService.setUserRole(preset.role);
    authService.setHasProfile(preset.hasProfile);
    authService.setHasAvatar(preset.hasAvatar);
    authService.setIsVerified(preset.isVerified);
    authService.setVerificationLevel(preset.isVerified ? 1 : 0);

    // 更新 userInfo
    let userInfo = authService.getUserInfo() || {};
    userInfo.nickname = preset.nickname;
    userInfo.role = preset.role;
    userInfo.id = preset.id || preset.role;
    authService.setUserInfo(userInfo);

    // 设置推荐人信息
    if (preset.hasReferrer) {
      const referrerInfo = { id: 'dev_referrer_001', name: '推荐官小李', role: 'public_matchmaker' };
      authService.setReferrerId('dev_referrer_001');
      authService.setReferrerInfo(referrerInfo);
    } else {
      authService.setReferrerId(null);
      authService.setReferrerInfo(null);
    }

    // 持久化身份切换（开发模式）
    wx.setStorageSync('dev_role_index', index);

    // 角色标签映射
    const roleLabels = {
      public_matchmaker: '公益推荐官',
      partner_matchmaker: '联创推荐官',
      city_franchisee: '城市合伙人',
      professional_recommender: '专业推荐官',
      community_station: '社区服务站',
    };

    // 刷新页面显示
    this.setData({
      currentRoleIndex: index,
      currentRoleLabel: preset.label,
      userInfo: userInfo,
      hasProfile: preset.hasProfile,
      hasAvatar: preset.hasAvatar,
      isGuest: (preset.role === 'user' && !preset.hasProfile),
      verificationStatus: preset.isVerified ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.NONE,
      isVerified: preset.isVerified,
      hasReferrer: preset.hasReferrer,
      referrerName: preset.hasReferrer ? '推荐官小李' : '',
      isMatchmaker: isMk,
      matchmakerRoleLabel: isMk ? (roleLabels[preset.role] || '推荐官') : '',
      userRole: preset.role,
    });

    wx.showToast({ title: `已切换为「${preset.label}」`, icon: 'success' });
  },

  loadPendingIncome() {
    this.setData({ loading: true });

    // DEV_MODE：直接使用 mock 数据，不调用真实接口
    if (DEV_MODE) {
      console.log('[mine] DEV_MODE: loadPendingIncome 使用 mock 数据');
      this.setData({
        pendingIncome: 1234.56,
        loading: false
      });
      return;
    }

    request({ url: API.INCOME.SUMMARY })
      .then((d) => {
        const data = d && d.data !== undefined ? d.data : d;
        this.setData({
          pendingIncome: data.withdrawable || data.amount || 0,
          loading: false
        });
      })
      .catch((err) => {
        console.error('[mine] loadPendingIncome failed:', err);
        this.setData({ loading: false });
      });
  },

  onEditProfile() {
    if (this.data.isGuest) {
      app.login().then(() => {
        // 推荐官自己建档不需要外部推荐人
        if (!this.data.hasReferrer && !this.data.isMatchmakerRole) {
          wx.showToast({ title: '需要推荐人才能建档', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/register/register' });
      }).catch(() => {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
      });
    } else {
      wx.navigateTo({ url: '/pages/profile/profile' });
    }
  },

  onGoRegister() {
    // 已建档会员 → 跳转到资料完善页面（不调起支付）
    const hasProfile = authService && authService.hasProfile();
    if (hasProfile) {
      wx.navigateTo({ url: '/pages/profile/profile' });
      return;
    }
    // 未建档 → 跳转到建档页面
    wx.navigateTo({ url: '/pages/register/register' });
  },

  onGoAvatar() {
    // 检查档案是否完善
    const userInfo = authService.getUserInfo() || {};
    const { nickname, intro } = userInfo;
    const hasProfile = authService.hasProfile();
    const hasAvatar = authService.hasAvatar();

    if (DEV_MODE) {
      console.log('[mine.onGoAvatar] hasProfile=', hasProfile,
        '| hasAvatar=', hasAvatar,
        '| nickname=', nickname,
        '| intro=', intro ? '有' : '无');
    }

    // 情况1：未建档 → 提示去建档
    if (!hasProfile) {
      wx.showModal({
        title: '未完成建档',
        content: '请先完成会员建档，才能使用AI推荐功能。',
        confirmText: '去建档',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/register/register' });
          }
        }
      });
      return;
    }

    // 情况2：档案不完善 → 提示去完善
    if (hasProfile && (!nickname || nickname.trim() === '' || !intro || intro.trim() === '')) {
      wx.showModal({
        title: '完善会员档案',
        content: '请先完善会员档案（昵称、个人简介），才能使用AI推荐功能。完善档案后可以更准确地为您推荐合适的人选。',
        confirmText: '去完善',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/register/register' });
          }
        }
      });
      return;
    }

    // 情况3：档案完善 → 去AI画像页
    wx.switchTab({ url: '/pages/avatar/avatar' });
  },
  onGoMatch() { wx.switchTab({ url: '/pages/match/match' }); },

  // 工作台：按角色跳转到各自收益平台
  onGoWorkbench() {
    const role = this.data.userRole;
    const routeMap = {
      public_matchmaker:       '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      partner_matchmaker:      '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench',
      city_franchisee:         '/subpackages/partner/pages/franchisee/dashboard/dashboard',
      professional_recommender: '/subpackages/matchmaker/pages/recommender/recommender',
      community_station:        '/subpackages/partner/pages/community-station/workbench/workbench',
    };
    const url = routeMap[role] || '/subpackages/matchmaker/pages/matchmaker/matchmaker';
    wx.navigateTo({ url });
  },

  // 社交中心（非工作台入口，普通用户也会用）
  onGoMatchmaker() {
    // 如果是推荐官，跳转到工作台；否则跳转到社交中心
    if (this.data.isMatchmaker) {
      wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker-workbench/matchmaker-workbench' });
    } else {
      wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/matchmaker' });
    }
  },
  onGoMembers() { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/earnings?tab=members' }); },
  onGoSalon() {
    const { isMatchmaker, userInfo } = this.data;
    
    // 推荐官：根据性别跳转到对应推荐官沙龙页面
    if (isMatchmaker) {
      const gender = userInfo && userInfo.gender;
      if (gender === 'male') {
        wx.navigateTo({ url: '/subpackages/activity/pages/male-salon-list/male-salon-list' });
      } else if (gender === 'female') {
        wx.navigateTo({ url: '/subpackages/activity/pages/female-salon-list/female-salon-list' });
      } else {
        // 性别未设置，提示用户先完善资料
        wx.showModal({
          title: '提示',
          content: '请先在个人资料中设置性别，以便为您推荐合适的沙龙活动',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/subpackages/user/pages/user/profile/profile' });
            }
          }
        });
      }
      return;
    }
    
    // 单身会员/普通用户：跳转到圈层沙龙（常规沙龙）
    wx.navigateTo({ url: '/subpackages/activity/pages/salon-weekly/salon-weekly' });
  },
  onGoVerify() { wx.navigateTo({ url: '/subpackages/user/pages/verify/verify' }); },
  onGoHelp() { wx.navigateTo({ url: '/subpackages/user/pages/help/help' }); },
  onGoAbout() { wx.navigateTo({ url: '/subpackages/user/pages/about/about' }); },
  onGoQrcode() { wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/qrcode' }); },
  onGoOrders() { wx.navigateTo({ url: '/subpackages/user/pages/user/orders/orders' }); },

  /**
   * 显示身份切换弹窗
   */
  onShowRoleSwitch() {
    const roleList = this.data.roleList;
    if (!roleList || roleList.length <= 1) return;

    const roleLabels = {
      user: '普通用户',
      single: '单身会员',
      member: '会员',
      public_matchmaker: '公益推荐官',
      partner_matchmaker: '联创推荐官',
      professional_recommender: '专业推荐官',
      community_station: '社区服务站',
      city_franchisee: '城市合伙人',
      admin: '管理员',
    };

    const items = roleList.map(r => roleLabels[r] || r);

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const selectedRole = roleList[res.tapIndex];
        this.onRoleSwitch(selectedRole);
      }
    });
  },

  /**
   * 切换身份（调用后端接口）
   */
  async onRoleSwitch(role) {
    if (!role) return;
    wx.showLoading({ title: '切换中...' });

    try {
      const { request } = require('../../utils/request');
      const API = require('../../services/api');
      const authService = require('../../services/auth.service');

      // request() 本身已返回 Promise，无需再包装
      await request({
        url: API.USER.SWITCH_ROLE,
        method: 'POST',
        data: { role },
      });

      wx.hideLoading();
      wx.showToast({ title: '切换成功', icon: 'success' });

      // 更新本地缓存
      const userInfo = authService.getUserInfo() || {};
      userInfo.role = role;
      authService.setUserInfo(userInfo);
      authService.setUserRole(role);

      // 刷新页面
      this.onShow();
    } catch (err) {
      wx.hideLoading();
      console.error('[mine] 切换身份失败:', err);
      wx.showToast({ title: '切换失败', icon: 'none' });
    }
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出登录后需重新扫码进入',
      confirmText: '退出',
      success: (res) => {
        if (res.confirm) {
          // 使用 auth.service 清除用户状态
          authService.clearUserState();
          // 跳转到首页
          wx.reLaunch({ url: '/pages/index/index' });
        }
      },
    });
  },

  /**
   * 头像加载失败兜底
   * 支持多字段：在 WXML 中通过 data-field="xxx" 指定要重置的字段
   */
  onAvatarError(e) {
    const field = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field) || 'userInfo.avatar';
    // 只处理 userInfo.avatar 这种简单路径
    if (field === 'userInfo.avatar') {
      const userInfo = this.data.userInfo || {};
      this.setData({
        'userInfo.avatar': '/assets/images/default-avatar.png',
      });
    }
  },

  // 用户登录
  onLogin() {
    const { requireLogin } = require('../../utils/auth');
    requireLogin('请先登录', false).then(success => {
      if (success) {
        // 登录成功，刷新页面状态
        this.onShow();
      }
    });
  },

  /**
   * 加入会员
   * 扫码推荐码 → 建立绑定关系 → 直接支付199元
   */
  onJoinMember() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    // 推荐官直接跳转到建档页面
    if (this.data.isMatchmaker) {
      wx.navigateTo({ url: '/pages/register/register' });
      return;
    }
    // 普通用户：扫码绑定推荐人后跳转到建档页面
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const raw = (res.result || '').trim();
        if (!raw) {
          wx.showToast({ title: '二维码内容为空', icon: 'none' });
          return;
        }
        const code = extractCodeFromScanResult(raw);
        if (!code) {
          wx.showToast({ title: '无法识别推荐码', icon: 'none' });
          return;
        }
        this._doBindAndGoRegister(code);
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
          this.setData({ showCodeModal: true, inputCode: '', codeError: '', codeInputFocus: true });
          return;
        }
        wx.showToast({ title: '扫码失败', icon: 'none' });
      },
    });
  },

  /**
   * 执行绑定推荐官后跳转到建档页面（不支付）
   */
  _doBindAndGoRegister(code) {
    wx.showLoading({ title: '绑定推荐官...' });
    const { bindByCode } = require('../../utils/referral');
    bindByCode(code, { silent: true }).then((bindResult) => {
      wx.hideLoading();
      if (!bindResult.bound && !bindResult.locked) {
        wx.showToast({ title: '绑定失败，请重试', icon: 'none' });
        return;
      }
      // 绑定成功（或已有推荐关系），跳转到建档页面填写资料
      wx.redirectTo({ url: '/pages/register/register' });
    }).catch((err) => {
      wx.hideLoading();
      console.error('[onJoinMember] 绑定失败:', err);
      const msg = (err && err.message) || '绑定失败';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    });
  },

  /**
   * 手动输入推荐码 - 确认
   */
  onCodeConfirm() {
    const code = (this.data.inputCode || '').trim().toUpperCase();
    if (!code) {
      this.setData({ codeError: '请输入推荐码' });
      return;
    }
    this.setData({ codeSubmitting: true, codeError: '' });
    // 先关闭弹窗，再执行绑定+跳转到建档页面
    this.setData({ showCodeModal: false });
    this._doBindAndGoRegister(code);
    // 重置弹窗状态
    this.setData({ inputCode: '', codeSubmitting: false, codeInputFocus: false });
  },

  /**
   * 弹窗内部点击（阻止冒泡到遮罩层关闭弹窗）
   */
  onCodeMaskTap() {},

  /**
   * 手动输入推荐码 - 取消
   */
  onCodeCancel() {
    this.setData({ showCodeModal: false, inputCode: '', codeError: '', codeSubmitting: false, codeInputFocus: false });
  },

  /**
   * 手动输入推荐码 - 输入框变化
   */
  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value, codeError: '' });
  },

  /**
   * 成为推荐官
   * 引导到联创推荐官注册流程
   */
  onBecomeMatchmaker() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=partner' });
  },

});
