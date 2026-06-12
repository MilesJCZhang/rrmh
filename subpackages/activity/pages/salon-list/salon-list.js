// subpackages/activity/pages/salon-list/salon-list.js
// 沙龙列表 + tier筛选Tab
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');
const { getTierInfo } = require('../../../../utils/scoreHelper');
const { getSalonConfig, SALON_TYPES } = require('../../../../utils/salon-config');

// 默认主题配置（常规沙龙）
const DEFAULT_THEME = {
  color: '#C8102E',
  lightColor: '#FFF0F0',
  gradient: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
  bannerBg: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
  title: '线下沙龙',
};

Page({
  data: {
    salonList: [],
    loading: true,
    page: 1,
    hasMore: true,
    salonType: '',
    isMatchmaker: false,
    themeColor: '#C8102E',
    themeLightColor: '#FFF0F0',
    themeGradient: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
    themeBannerBg: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
    navTitle: '线下沙龙',
    // tier筛选
    tierTabs: [
      { key: '', label: '全部' },
      { key: 'gold', label: '优质(80+)' },
      { key: 'silver', label: '良好(60+)' },
      { key: 'bronze', label: '基础(<60)' },
    ],
    activeTier: '',
    // 用户评分
    myScoreTier: 'unrated',
    tierInfo: null,
    // 每场总容量（推荐官主体沙龙封顶27人，含随行）
    totalCap: 27,
    // 每性别最大人数（常规沙龙3男3女）
    maxPerGender: 3,
    // 推荐官上限（推荐官沙龙）
    maxRecommenders: 9,
    // 默认报名费
    defaultFee: 399,
    // 是否显示评分筛选
    showScoreFilter: true,
  },

  onLoad(options) {
    const salonType = options.type || '';
    
    // 使用配置系统获取主题配置
    const config = getSalonConfig(salonType);
    const theme = config ? config.theme : null;

    const app = getApp();
    const myScoreTier = app?.globalData?.scoreTier || 'unrated';

    const data = {
      salonType,
      isMatchmaker: authService.isMatchmaker(),
      myScoreTier,
      tierInfo: getTierInfo(myScoreTier),
      // 从配置中读取功能配置
      totalCap: config ? config.features.totalCap : 27,
      maxRecommenders: config ? config.features.maxRecommenders : 9,
      maxPerGender: config ? config.features.maxPerGender : 3,
      defaultFee: config ? config.registration.defaultFee : 399,
      showScoreFilter: config ? config.features.showScoreFilter : true,
    };

    if (theme) {
      data.themeColor = theme.color;
      data.themeLightColor = theme.lightColor;
      data.themeGradient = theme.gradient;
      data.themeBannerBg = theme.bannerBg;
      data.navTitle = config.name || '线下沙龙';
      wx.setNavigationBarTitle({ title: data.navTitle });
    } else {
      // 使用默认主题
      data.themeColor = DEFAULT_THEME.color;
      data.themeLightColor = DEFAULT_THEME.lightColor;
      data.themeGradient = DEFAULT_THEME.gradient;
      data.themeBannerBg = DEFAULT_THEME.bannerBg;
      data.navTitle = DEFAULT_THEME.title;
      wx.setNavigationBarTitle({ title: DEFAULT_THEME.title });
    }

    this.setData(data);
    this.loadSalons();
  },

  loadSalons() {
    this.setData({ loading: true, page: 1, hasMore: true });
    const params = { limit: 20, page: 1 };
    if (this.data.salonType) params.type = this.data.salonType;
    if (this.data.activeTier) params.tier = this.data.activeTier;

    // 从配置中读取默认值
    const maxRecommenders = this.data.maxRecommenders || 9;
    const maxPerGender = this.data.maxPerGender || 3;
    const defaultFee = this.data.defaultFee || 399;

    request({ url: API.SALON.LIST, data: params })
      .then((resp) => {
        const raw = resp?.data || resp;
        const list = (raw && raw.list) ? raw.list : (Array.isArray(raw) ? raw : []);
        const salonType = this.data.salonType;
        const formatted = list.map(s => {
          const itemType = s.type || '';
          const totalRemainMain = (s.max_recommenders || maxRecommenders) - Math.max(0, s.registeredCount || s.male_count || 0);
          const isGrouped = itemType ? false : s.is_grouped !== 0;
          return {
            ...s,
            maleRemain: s.maleRemain || (s.max_per_gender || maxPerGender) - (s.male_count || 0),
            femaleRemain: s.femaleRemain || (s.max_per_gender || maxPerGender) - (s.female_count || 0),
            totalRemain: itemType ? totalRemainMain : (s.totalRemain || ((s.max_per_gender || maxPerGender) - (s.male_count || 0) + (s.max_per_gender || maxPerGender) - (s.female_count || 0))),
            totalRemainMain,
            registrationFee: s.registration_fee || s.registrationFee || defaultFee,
            isGrouped,
            allowedTiers: s.allowed_tiers || 'gold,silver,bronze',
            isRegistered: !!s.isRegistered,
          };
        });
        this.setData({ salonList: formatted, loading: false, hasMore: formatted.length >= 20 });
      })
      .catch((err) => {
        console.warn('[salon-list] request failed:', err);
        this.setData({ salonList: [], loading: false });
      });
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    const nextPage = this.data.page + 1;
    const params = { limit: 20, page: nextPage };
    if (this.data.salonType) params.type = this.data.salonType;
    if (this.data.activeTier) params.tier = this.data.activeTier;

    // 从配置中读取默认值
    const maxRecommenders = this.data.maxRecommenders || 9;
    const maxPerGender = this.data.maxPerGender || 3;
    const defaultFee = this.data.defaultFee || 399;

    this.setData({ loading: true });
    request({ url: API.SALON.LIST, data: params })
      .then((resp) => {
        const raw = resp?.data || resp;
        const newList = (raw && raw.list) ? raw.list : (Array.isArray(raw) ? raw : []);
        const salonType = this.data.salonType;
        const formatted = newList.map(s => {
          const itemType = s.type || '';
          const totalRemainMain = (s.max_recommenders || maxRecommenders) - Math.max(0, s.registeredCount || s.male_count || 0);
          return {
            ...s,
            maleRemain: s.maleRemain || (s.max_per_gender || maxPerGender) - (s.male_count || 0),
            femaleRemain: s.femaleRemain || (s.max_per_gender || maxPerGender) - (s.female_count || 0),
            totalRemain: itemType ? totalRemainMain : (s.totalRemain || ((s.max_per_gender || maxPerGender) - (s.male_count || 0) + (s.max_per_gender || maxPerGender) - (s.female_count || 0))),
            totalRemainMain,
            registrationFee: s.registration_fee || s.registrationFee || defaultFee,
            isGrouped: itemType ? false : s.is_grouped !== 0,
            allowedTiers: s.allowed_tiers || 'gold,silver,bronze',
            isRegistered: !!s.isRegistered,
          };
        });
        this.setData({
          salonList: [...this.data.salonList, ...formatted],
          page: nextPage,
          hasMore: formatted.length >= 20,
          loading: false,
        });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  onTierTabTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTier: key });
    this.loadSalons();
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `../salon-detail/salon-detail?id=${id}` });
  },

  goCreateSalon() {
    wx.navigateTo({ url: '/subpackages/activity/pages/salon-create/salon-create?type=' + this.data.salonType });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.loadSalons();
    wx.stopPullDownRefresh();
  },
});
