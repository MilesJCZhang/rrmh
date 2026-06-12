// subpackages/activity/pages/male-salon-list/male-salon-list.js
// 男推荐官沙龙列表页 - 独立页面，蓝色商务风
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
    // 主题配置 - 蓝色商务风
    themeColor: '#1565C0',
    themeLightColor: '#E3F2FD',
    themeGradient: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    themeBannerBg: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    navTitle: '男推荐官沙龙',
    // 业务配置
    salonType: 'male_salon',
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
      navTitle: '男推荐官沙龙',
    });
    
    wx.setNavigationBarTitle({ title: this.data.navTitle });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#1565C0',
    });
    
    this.loadSalons();
  },

  loadSalons() {
    this.setData({ loading: true, page: 1, hasMore: true });
    const params = { 
      limit: 20, 
      page: 1,
      type: 'male_salon',  // 强制过滤男推荐官沙龙
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
        console.warn('[male-salon-list] request failed:', err);
        this.setData({ salonList: [], loading: false });
      });
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    const nextPage = this.data.page + 1;
    const params = { 
      limit: 20, 
      page: nextPage,
      type: 'male_salon',
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
    
    // 计算推荐官席位占用情况（仅统计注册人，不含随行）
    const recommenderCount = s.registrantCount || s.male_count || s.recommender_count || 0;
    const recommenderRemain = maxRecommenders - recommenderCount;
    
    // 计算全场人数（含随行）
    const totalRegistered = s.currentParticipants || s.total_registered || s.registered_count || 0;
    const totalRemain = totalCap - totalRegistered;
    
    // 审核状态：pending/approved/rejected
    const auditStatus = s.audit_status || 'approved';
    
    // 兼容 eventDate（生产服务器返回 startTime ISO 字符串）
    let eventDate = s.event_date || s.eventDate || '';
    if (!eventDate && (s.startTime || s.start_time)) {
      const d = new Date(s.startTime || s.start_time);
      if (!isNaN(d.getTime())) {
        eventDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
    }
    // 兼容 start_time（生产服务器返回 startTime camelCase）
    const rawStart = s.start_time || s.startTime || '';
    const rawEnd = s.end_time || s.endTime || '';
    // 提取 HH:mm
    const startTime = rawStart ? (rawStart.includes('T') ? rawStart.substring(11, 16) : rawStart.substring(0, 5)) : '';
    const endTime = rawEnd ? (rawEnd.includes('T') ? rawEnd.substring(11, 16) : rawEnd.substring(0, 5)) : '';

    return {
      ...s,
      recommenderCount,
      recommenderRemain,
      totalRegistered,
      totalRemain,
      registrationFee: s.registration_fee || s.registrationFee || defaultFee,
      auditStatus,
      isRegistered: !!s.isRegistered,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      // 状态判断
      isFull: totalRemain <= 0,
      isAuditPending: auditStatus === 'pending',
      canRegister: auditStatus === 'approved' && totalRemain > 0 && !s.isRegistered,
    };
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `../male-salon-detail/male-salon-detail?id=${id}` });
  },

  goCreateSalon() {
    if (!this.data.isMatchmaker) {
      wx.showToast({ title: '仅认证推荐官可发布', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/subpackages/activity/pages/male-salon-create/male-salon-create' });
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