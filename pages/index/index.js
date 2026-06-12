// pages/index/index.js
// 首页 - 会员建档 + 成为推荐官 + 四宫格平台入口（四种身份统一展示）
const { ensureLogin } = require('../../utils/auth');
const { request } = require('../../utils/request');
const { hasReferrer, getReferrerId, parseReferralScene } = require('../../utils/referral');
const { DEV_MODE } = require('../../utils/config');
const authService = require('../../services/auth.service');
const referralService = require('../../services/referral.service');
const API = require('../../services/api');
const { getSalonConfig } = require('../../utils/salon-config');

Page({
  data: {
    // 状态栏高度
    statusBarH: 0,

    // 推荐关系
    hasReferrer: false,
    referrerId: '',

    // 游客/用户状态
    isGuest: true,
    hasProfile: false,

    // 平台数据（真实数据从后端 /stats/overview 获取）
    stats: null,

    // 顶部广告轮播
    heroSlides: [],

    // 宫格背景图配置
    gridBgs: {},

    // 引导弹窗
    showGuideModal: false,

    // 输入推荐码弹窗
    showCodeModal: false,
    inputCode: '',
    codeError: '',
    codeSubmitting: false,
    codeInputFocus: false,

    // 隐私协议弹窗
    showPrivacyPopup: false,

    // 加载状态
    loading: false,
  },

  onLoad(options) {
    const sysInfo = wx.getWindowInfo();
    this.setData({ statusBarH: sysInfo.statusBarHeight || 20 });

    // 注册登录成功回调，让首页在登录完成后刷新状态
    const app = getApp();
    app.globalData._onLoginSuccess = () => {
      this._updateUserStatus();
      this._updateReferralStatus();
    };
    // 如果登录已经完成（回调来不及触发），直接刷新一次
    if (app.globalData.isLogin) {
      this._updateUserStatus();
      this._updateReferralStatus();
    }

    // ── 处理扫码进入的推荐码（核心修复）──
    // 场景1：普通二维码，query 中有 referrer_id
    // 场景2：小程序码，scene 参数中编码了推荐信息
    this._handleScanEnter(options);

    this._updateReferralStatus();
    this._initHeroSlides();
    this.init();
  },

  /**
   * 处理扫码进入时的推荐码绑定
   * 小程序码：scene = "referrer_id_30" 或 "rc_LCRG001"
   * 普通二维码：query.referrer_id = "30" 或 query.code = "LCRG001"
   */
  _handleScanEnter(options) {
    if (!options) return;

    const { referrerId, invitationCode } = parseReferralScene(options);
    const code = invitationCode;

    if (!referrerId && !code) return;

    // 记录访客日志（扫码/链接进入小程序）
    const app = getApp();
    const openid = app.globalData.openid || authService.getOpenId();
    if (openid && code) {
      const userInfo = authService.getUserInfo() || {};
      referralService.logVisitor({
        referrer_code: code,
        visitor_openid: openid,
        visitor_nickname: userInfo.nickname || '',
        visitor_avatar: userInfo.avatar || '',
      }).catch(err => console.warn('[index] 访客日志上报失败:', err));
    }

    // 已锁定则忽略
    const { isReferralLocked } = require('../../utils/referral');
    if (isReferralLocked()) return;

    const doBind = () => {
      if (code) {
        const { bindByCode } = require('../../utils/referral');
        bindByCode(code, { silent: true }).then((result) => {
          if (result.bound) {
            this._updateReferralStatus();
            wx.showToast({ title: '已绑定推荐官', icon: 'success' });
          }
        }).catch(() => {});
      } else if (referrerId) {
        const { bindReferrer } = require('../../utils/referral');
        bindReferrer(referrerId, null, { silent: true }).then((result) => {
          if (result.bound) {
            this._updateReferralStatus();
            wx.showToast({ title: '已绑定推荐官', icon: 'success' });
          }
        }).catch(() => {});
      }
    };

    // 已登录：直接绑定；未登录：等登录成功后绑定
    if (app.globalData.isLogin) {
      doBind();
    } else {
      const origCallback = app.globalData._onLoginSuccess;
      app.globalData._onLoginSuccess = () => {
        if (origCallback) origCallback();
        doBind();
      };
    }
  },

  onShow() {
    const app = getApp();
    this._updateReferralStatus();
    this._updateUserStatus();
    // 每次切回首页时刷新轮播图和宫格背景（避免后台更新后不生效）
    this._initHeroSlides();

    // 检查是否需要显示隐私弹窗
    if (app.globalData.showPrivacyPopup) {
      this.setData({ showPrivacyPopup: true });
    }
  },

  onPrivacyClose() {
    this.setData({ showPrivacyPopup: false });
  },

  /**
   * 初始化顶部广告轮播
   * 从后端配置读取，开发模式使用 mock 数据
   */
  _initHeroSlides() {
    if (DEV_MODE) {
      // 开发模式：直接使用 mock 数据
      const heroSlides = this._getDefaultHeroSlides();
      this.setData({ heroSlides, gridBgs: this._getDefaultGridBgs() });
      return;
    }
    // 生产模式：从配置接口读取
    request({ url: API.CONFIG.MAP }).then((resp) => {
      const data = resp.data || resp;
      let heroSlides = [];
      const gridBgs = {};
      if (data && data.hero_slides) {
        try {
          heroSlides = JSON.parse(data.hero_slides);
        } catch (e) {
          console.error('[index] hero_slides JSON 解析失败:', e);
        }
      }
      // 解析宫格背景图配置
      if (data) {
        if (data.grid2_dating_bg) gridBgs.dating = data.grid2_dating_bg;
        if (data.grid2_salon_bg) gridBgs.salon = data.grid2_salon_bg;
        if (data.grid4_charity_bg) gridBgs.charity = data.grid4_charity_bg;
        if (data.grid4_partner_bg) gridBgs.partner = data.grid4_partner_bg;
        if (data.grid4_city_bg) gridBgs.city = data.grid4_city_bg;
        if (data.grid4_community_bg) gridBgs.community = data.grid4_community_bg;
        if (data.grid4_male_salon_bg) gridBgs.maleSalon = data.grid4_male_salon_bg;
        if (data.grid4_female_salon_bg) gridBgs.femaleSalon = data.grid4_female_salon_bg;
      }
      // 兜底：如果整个配置为空，用默认数据
      if (!heroSlides || heroSlides.length === 0) {
        heroSlides = this._getDefaultHeroSlides();
      } else {
        // 兜底：后端可能没配 ctaPage，按 slide.id 匹配默认跳转页
        const defaults = this._getDefaultHeroSlides();
        const defaultMap = {};
        defaults.forEach(d => { defaultMap[d.id] = d.ctaPage; });
        heroSlides = heroSlides.map(slide => {
          if (!slide.ctaPage) {
            // 优先按 id 精确匹配
            if (defaultMap[slide.id]) {
              console.log('[index] ctaPage 兜底 (id):', slide.id, '→', defaultMap[slide.id]);
              return { ...slide, ctaPage: defaultMap[slide.id] };
            }
            // 模糊匹配：标题含关键词
            const title = (slide.title || '').toLowerCase();
            if (title.includes('沙龙') || title.includes('活动')) {
              console.log('[index] ctaPage 兜底 (关键词=沙龙):', slide.id);
              return { ...slide, ctaPage: defaults[0].ctaPage }; // 沙龙列表
            }
            if (title.includes('ai') || title.includes('画像')) {
              console.log('[index] ctaPage 兜底 (关键词=AI):', slide.id);
              return { ...slide, ctaPage: defaults[1].ctaPage }; // AI画像页
            }
            if (title.includes('推荐官') || title.includes('红娘') || title.includes('推荐')) {
              console.log('[index] ctaPage 兜底 (关键词=推荐官):', slide.id);
              return { ...slide, ctaPage: defaults[2].ctaPage }; // 推荐官列表
            }
            // 无匹配：给通用首页兜底
            console.warn('[index] ctaPage 兜底 (通用):', slide.id, '→ /pages/index/index');
            return { ...slide, ctaPage: '/pages/index/index' };
          }
          return slide;
        });
      }
      this.setData({ heroSlides, gridBgs });
    }).catch((err) => {
      console.error('[index] 加载轮播配置失败:', err);
      // 兜底：用默认数据
      const heroSlides = this._getDefaultHeroSlides();
      const gridBgs = this._getDefaultGridBgs();
      this.setData({ heroSlides, gridBgs });
    });
  },

  /**
   * 默认轮播数据（兜底用）
   */
  _getDefaultHeroSlides() {
    return [
      {
        id: 'male-salon',
        title: '男推荐官沙龙',
        subtitle: '商务对接 人脉拓展 资源合作',
        pattern: '💼',
        theme: 'blue',
        ctaText: '查看男推荐官沙龙',
        ctaPage: '/subpackages/activity/pages/male-salon-list/male-salon-list',
        highlights: ['商务对接 人脉拓展', '推荐官席位制 每场9人', '全场限27人 精品小班'],
      },
      {
        id: 'female-salon',
        title: '女推荐官沙龙',
        subtitle: '商务对接 人脉拓展 资源合作',
        pattern: '💼',
        theme: 'pink',
        ctaText: '查看女推荐官沙龙',
        ctaPage: '/subpackages/activity/pages/female-salon-list/female-salon-list',
        highlights: ['商务对接 人脉拓展', '推荐官席位制 每场9人', '全场限27人 精品小班'],
      },
      {
        id: 'ai-match',
        title: 'AI推荐 精准甄选',
        subtitle: '精致三对小众私享局，安静私密轻松相聚',
        pattern: '🤖',
        theme: 'tech',
        ctaText: '创建我的画像',
        ctaPage: '/pages/avatar/avatar',
        highlights: ['不知从何开口？AI帮你', '个性化沟通 画像替你表达', '隐私安全 姓名不公开'],
      },
      {
        id: 'matchmaker',
        title: '人人推荐 人人美好',
        subtitle: '携手遇见知己，相伴温暖朝夕',
        pattern: '💝',
        theme: 'red',
        ctaText: '联系公益推荐官',
        ctaPage: '/subpackages/matchmaker/pages/matchmaker/matchmaker',
        highlights: ['推荐官审核把关 身份真实', '70后到00后 分龄推荐', '全程跟进 同频相聚'],
      },
    ];
  },

  /**
   * 默认宫格背景图配置（兜底用，开发模式用）
   */
  _getDefaultGridBgs() {
    return {};
  },

  /**
   * 轮播图片加载成功
   */
  onHeroImageLoad(e) {
    const index = e.currentTarget.dataset.index;
    const key = `heroSlides[${index}]._imgState`;
    this.setData({ [key]: 'loaded' });
  },

  /**
   * 轮播图片加载失败 — 降级显示默认文字内容
   */
  onHeroImageError(e) {
    const index = e.currentTarget.dataset.index;
    console.warn('[index] 轮播图加载失败, index:', index, e.detail.errMsg);
    const key = `heroSlides[${index}]._imgState`;
    this.setData({ [key]: 'error' });
  },

  /**
   * 广告轮播点击
   * 事件绑定在 swiper-item 上（而非内部 view），避免 swiper 手势拦截
   * tabBar 页面用 switchTab，普通页面用 navigateTo
   */
  onHeroSlideTap(e) {
    // 防抖：300ms 内重复点击忽略
    const now = Date.now();
    if (this._lastHeroTap && now - this._lastHeroTap < 300) return;
    this._lastHeroTap = now;

    const page = e.currentTarget.dataset.page;
    console.log('[index] 轮播图点击, ctaPage:', page);

    if (!page) {
      console.warn('[index] 轮播图 ctaPage 为空，跳过跳转');
      return;
    }

    // 精确匹配 tabBar 页面（去除前导 / 后比较）
    const TAB_PAGES = [
      'pages/index/index',
      'pages/match/match',
      'pages/avatar/avatar',
      'pages/mine/mine',
    ];
    const normalized = page.replace(/^\//, '');
    const isTab = TAB_PAGES.some(p => normalized === p);

    console.log('[index] 跳转类型:', isTab ? 'switchTab' : 'navigateTo', '→', page);

    // 使用 fail 回调处理错误（wx API 不返回 Promise）
    if (isTab) {
      wx.switchTab({
        url: page,
        fail: (err) => {
          console.error('[index] switchTab 失败:', page, err);
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        },
      });
    } else {
      wx.navigateTo({
        url: page,
        fail: (err) => {
          console.error('[index] navigateTo 失败:', page, err);
          // 降级：跳回首页
          wx.switchTab({ url: '/pages/index/index' });
          wx.showToast({ title: '页面不存在或已下架', icon: 'none' });
        },
      });
    }
  },

  /**
   * 检查会员档案是否完善
   * 必须字段：nickname, intro
   */
  checkProfileComplete() {
    const userInfo = authService.getUserInfo() || {};
    const { nickname, intro } = userInfo;

    if (!nickname || nickname.trim() === '') return false;
    if (!intro || intro.trim() === '') return false;

    return true;
  },

  /**
   * 会员建档点击
   * 逻辑：
   * 1. 未登录 → 先登录
   * 2. 未建档 → 去注册页建档
   * 3. 已建档但档案不完善 → 提示去完善
   * 4. 档案完善但未生成AI画像 → 去AI推荐问答
   * 5. 已生成AI画像 → 去画像管理页
   */
  async onDatingTap() {
    try { await ensureLogin(); } catch (e) { return; }

    const userInfo = authService.getUserInfo() || {};
    const roleList = userInfo.roleList || [];
    const isMember = roleList.some(r => r === 'single' || r === 'member');

    // 情况1：访客（非会员）→ 引导加入会员
    // 会员档案需要先成为会员（绑定推荐码 + 支付建档费）
    if (!isMember) {
      wx.showModal({
        title: '加入会员',
        content: '使用会员档案功能需要先成为会员，绑定推荐官并支付建档费用。',
        confirmText: '去加入',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 引导到「我的」页，通过「加入会员」入口完成扫码绑定+支付
            wx.switchTab({ url: '/pages/mine/mine' });
          }
        },
      });
      return;
    }

    // 情况2：会员 → 直接进入建档页面完善信息
    // 已在加入会员时绑定推荐码，此处无需再次输入
    wx.navigateTo({ url: '/pages/register/register' });
  },

  /**
   * 公益推荐官注册入口：所有身份统一跳推荐官申请页
   */
  onMatchmakerTap() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=public' });
  },

  /**
   * 联创推荐官注册入口：所有身份统一跳推荐官申请页
   */
  onCofounterTap() {
    wx.navigateTo({ url: '/subpackages/matchmaker/pages/matchmaker/apply?type=partner' });
  },

  /**
   * 推荐官主体沙龙点击（性别校验由详情页处理）
   * 使用配置系统获取页面路径
   */
  onGenderSalonTap(e) {
    const type = e.currentTarget.dataset.type;
    const config = getSalonConfig(type);
    const url = config ? config.page.list : `/subpackages/activity/pages/salon-list/salon-list?type=${type}`;
    wx.navigateTo({ url });
  },

  /**
   * 四宫格点击
   * 使用配置系统获取页面路径
   */
  onGrid4Tap(e) {
    const key = e.currentTarget.dataset.key;
    
    // 沙龙入口：跳转到周历视图（1.0.8版本）
    if (key === 'salon') {
      wx.navigateTo({
        url: '/subpackages/activity/pages/salon-weekly/salon-weekly'
      });
      return;
    }
    
    // 其他入口：保持原有逻辑
    switch (key) {
      case 'franchisee':
        wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=franchisee' });
        break;
      case 'professional':
        wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=professional' });
        break;
      case 'community':
        wx.navigateTo({ url: '/subpackages/partner/pages/partner-apply/partner-apply?type=community' });
        break;
    }
  },

  /**
   * 更新推荐关系状态
   */
  _updateReferralStatus() {
    const has = hasReferrer();
    const id = getReferrerId();
    this.setData({
      hasReferrer: has,
      referrerId: id,
    });
  },

  /**
   * 更新用户状态
   * 使用 auth.service 统一读取状态
   */
  _updateUserStatus() {
    const isGuest = authService.isGuest();
    const hasProfile = authService.hasProfile();
    const userInfo = authService.getUserInfo();

    if (DEV_MODE) {
      console.log('[index._updateUserStatus] isGuest=', isGuest, '| hasProfile=', hasProfile);
    }

    this.setData({
      isGuest,
      hasProfile,
      userInfo,
    });
  },

  async init() {
    this.setData({ loading: true });
    const loginTask = ensureLogin().catch((err) => {
      console.error('[index] login failed:', err);
      // 登录失败不影响页面展示，继续执行
    });

    this.loadStats();
    await loginTask;
    this._updateUserStatus();
    this._updateReferralStatus();
    this.setData({ loading: false });
  },

  loadStats() {
    if (DEV_MODE) {
      // 开发模式：直接返回 mock 数据，避免网络超时
      this.setData({
        stats: { userCount: 1280, matchCount: 368, matchmakerCount: 86 },
      });
      return;
    }
    request({ url: API.STATS.OVERVIEW }).then((resp) => {
      const data = resp.data || resp;
      if (data) {
        // 后端字段名映射到 WXML 期望的字段名
        this.setData({
          stats: {
            users: data.totalMembers || data.totalUsers || data.users || 0,
            matches: data.totalMatches || data.matches || 0,
            matchmakers: data.totalMatchmakers || data.matchmakers || 0,
          }
        });
      }
    }).catch((err) => {
      if (err && err.code !== 404) {
        console.error('[index] loadStats failed:', err);
      }
    });
  },

  /**
   * 无推荐人引导弹窗
   */
  _showNoReferrerGuide() {
    this.setData({ showGuideModal: true });
  },

  onCloseGuide() {
    this.setData({ showGuideModal: false });
  },

  /**
   * 联系客服（已改为 open-type=contact，此函数仅关闭引导弹窗）
   */
  onContactService() {
    this.setData({ showGuideModal: false });
  },

  /**
   * 了解推荐官推荐
   */
  onLearnMore() {
    this.setData({ showGuideModal: false });
    wx.navigateTo({
      url: '/subpackages/matchmaker/pages/matchmaker/matchmaker?mode=learn',
    });
  },

  // 扫码绑定
  onScanQrcode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        try {
          const url = new URL(res.result);
          const referrerId = url.searchParams.get('referrer_id');
          if (referrerId) {
            const { bindReferrer } = require('../../utils/referral');
            bindReferrer(referrerId).then((result) => {
              if (result.bound) {
                this._updateReferralStatus();
                wx.showToast({ title: '绑定成功，可以报名了', icon: 'success' });
              }
            });
          } else {
            wx.showToast({ title: '二维码无效', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '二维码格式错误', icon: 'none' });
        }
      },
    });
  },

  // 显示输入推荐码弹窗
  onShowCodeModal() {
    this.setData({
      showCodeModal: true,
      inputCode: '',
      codeError: '',
      codeSubmitting: false,
      codeInputFocus: true,
    });
  },

  // 关闭输入推荐码弹窗
  onCloseCodeModal() {
    this.setData({
      showCodeModal: false,
      inputCode: '',
      codeError: '',
      codeSubmitting: false,
      codeInputFocus: false,
    });
  },

  // 推荐码输入
  onCodeInput(e) {
    this.setData({
      inputCode: e.detail.value,
      codeError: '',
    });
  },

  // 提交推荐码
  async onSubmitCode() {
    const code = this.data.inputCode.trim();
    if (!code) {
      this.setData({ codeError: '请输入推荐码' });
      return;
    }
    this.setData({ codeSubmitting: true, codeError: '' });
    try {
      const { bindByCode } = require('../../utils/referral');
      // 推荐关系永久锁定，已绑定用户不允许重新绑定
      if (wx.getStorageSync('referrer_locked')) {
        this.setData({ codeError: '您已绑定推荐人，推荐关系不可更改', codeSubmitting: false });
        return;
      }
      const result = await bindByCode(code);
      if (result.bound) {
        this.setData({ showCodeModal: false });
        this._updateReferralStatus();
        wx.showToast({ title: '绑定成功，可以报名了', icon: 'success' });
      } else {
        this.setData({ codeError: result.reason || '绑定失败，请重试' });
      }
    } catch (err) {
      const msg = err.message || '推荐码验证失败';
      this.setData({ codeError: msg });
    } finally {
      this.setData({ codeSubmitting: false });
    }
  },
});
