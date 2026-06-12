// subpackages/activity/pages/female-salon-list/female-salon-list.js
// 女推荐官沙龙列表页 - 独立页面，粉色商务风
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');

Page({
  data: {
    salonList: [],
    loading: true,
    page: 1,
    hasMore: true,
    isMatchmaker: false,
    // 主题配置 - 粉色商务风
    themeColor: '#C2185B',
    themeLightColor: '#FCE4EC',
    themeGradient: 'linear-gradient(135deg, #C2185B 0%, #F06292 100%)',
    themeBannerBg: 'linear-gradient(135deg, #C2185B 0%, #F06292 100%)',
    navTitle: '女推荐官沙龙',
    // 业务配置
    salonType: 'female_salon',
    totalCap: 27,              // 全场人数上限（含随行）
    maxRecommenders: 9,        // 推荐官席位上限
    defaultFee: 399,           // 默认报名费
    showScoreFilter: false,     // 不显示评分筛选
  },

  onLoad(options) {
    const app = getApp();
    const isMatchmaker = authService.isMatchmaker();
    
    this.setData({
      isMatchmaker,
      navTitle: '女推荐官沙龙',
    });
    
    wx.setNavigationBarTitle({ title: this.data.navTitle });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#C2185B',
    });
    
    this.loadSalons();
  },

  loadSalons() {
    this.setData({ loading: true, page: 1, hasMore: true });
    const params = { 
      limit: 20, 
      page: 1,
      type: 'female_salon',  // 强制过滤女推荐官沙龙
    };

    request({ url: API.SALON.LIST, data: params })
      .then((resp) => {
        const raw = resp?.data || resp;
        const list = (raw && raw.list) ? raw.list : (Array.isArray(raw) ? raw : []);
        const formatted = list.map(s => this.formatSalonData(s));
        this.setData({ 
          salonList: formatted, 
          loading: false, 
          hasMore: formatted.length >= 20 
        });
      })
      .catch((err) => {
        console.warn('[female-salon-list] request failed:', err);
        this.setData({ salonList: [], loading: false });
      });
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    const nextPage = this.data.page + 1;
    const params = { 
      limit: 20, 
      page: nextPage,
      type: 'female_salon',
    };

    this.setData({ loading: true });
    request({ url: API.SALON.LIST, data: params })
      .then((resp) => {
        const raw = resp?.data || resp;
        const newList = (raw && raw.list) ? raw.list : (Array.isArray(raw) ? raw : []);
        const formatted = newList.map(s => this.formatSalonData(s));
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

  formatSalonData(s) {
    const maxRecommenders = this.data.maxRecommenders || 9;
    const totalCap = this.data.totalCap || 27;
    const defaultFee = this.data.defaultFee || 399;
    
    // 计算推荐官席位占用情况
    const recommenderCount = s.female_count || s.recommender_count || 0;
    const recommenderRemain = maxRecommenders - recommenderCount;
    
    // 计算全场人数（含随行）
    const totalRegistered = s.total_registered || s.registered_count || 0;
    const totalRemain = totalCap - totalRegistered;
    
    // 审核状态：pending/approved/rejected
    const auditStatus = s.audit_status || 'approved';
    
    return {
      ...s,
      recommenderCount,
      recommenderRemain,
      totalRegistered,
      totalRemain,
      registrationFee: s.registration_fee || s.registrationFee || defaultFee,
      auditStatus,
      isRegistered: !!s.isRegistered,
      // 状态判断
      isFull: totalRemain <= 0,
      isAuditPending: auditStatus === 'pending',
      canRegister: auditStatus === 'approved' && totalRemain > 0 && !s.isRegistered,
    };
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `../female-salon-detail/female-salon-detail?id=${id}` });
  },

  goCreateSalon() {
    if (!this.data.isMatchmaker) {
      wx.showToast({ title: '仅认证推荐官可发布', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/activity/pages/female-salon-create/female-salon-create' });
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