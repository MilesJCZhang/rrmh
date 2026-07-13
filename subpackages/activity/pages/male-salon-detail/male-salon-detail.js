const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');

function formatTime(isoStr) {
  if (!isoStr) return '';
  const match = isoStr.match(/(?:T|\s)(\d{1,2}:\d{2})/);
  return match ? match[1] : isoStr.substring(0, 5);
}

Page({
  data: {
    salon: null,
    signing: false,
    loading: true,
    isRegistered: false,
    myRegistration: null,
    themeColor: '#1565C0',
    themeGradient: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
    isMatchmaker: false,
    isCreator: false,
    currentUserId: null,
    _active: false,
    canSignup: false,
    signupBlockReason: '',
    recommenderSlots: [],
    recommenderRemain: 0,
    totalCap: 27,
    genderOptions: ['男', '女'],
    auditStatus: 'approved',
    rejectReason: '',
    // 报名弹窗
    showSignupForm: false,
    submitting: false,
    signupForm: {
      name: '',
      mobile: '',
      gender: '',
      genderIndex: 0,
      age: '',
      industry: '',
      identity: '',
      position: '',
      business: '',
      advantage: '',
      companions: [],
    },
  },

  onLoad(options) {
    const id = Number(options.id);
    this.salonId = id;
    this.setData({
      isMatchmaker: authService.isMatchmaker(),
      currentUserId: authService.getUserInfo()?.id || null,
      _active: true,
    });
    this.loadDetail();
  },

  onShow() {
    this.setData({ _active: true });
    if (this.data.salon) {
      this.loadDetail();
    }
  },

  onHide() { this.setData({ _active: false }); },
  onUnload() { this.setData({ _active: false }); },

  async loadDetail() {
    if (!this.data._active) return;
    try {
      const resp = await request({ url: API.SALON.DETAIL.replace(':id', this.salonId) });
      if (!this.data._active) return;

      const salon = resp?.data || resp;
      if (!salon) {
        this.setData({ loading: false });
        return;
      }

      const registrantCount = Math.max(0, salon.registeredCount || salon.registrantCount || salon.male_count || 0);
      const currentParticipants = Math.max(0, salon.totalParticipants || salon.currentParticipants || registrantCount);
      const maxRecommenders = salon.max_recommenders || 9;
      const recommenderCount = registrantCount;
      const recommenderRemain = maxRecommenders - recommenderCount;
      const recommenderSlots = [];
      for (let i = 0; i < maxRecommenders; i++) {
        recommenderSlots.push(i < recommenderCount ? 1 : 0);
      }

      // 时间格式化
      const rawStart = salon.start_time || salon.startTime;
      const rawEnd = salon.end_time || salon.endTime;
      const fmtStart = formatTime(rawStart);
      const fmtEnd = formatTime(rawEnd);

      // 从 startTime 提取日期（兼容无 eventDate 的服务器）
      let eventDate = salon.event_date || salon.eventDate || '';
      if (!eventDate && rawStart) {
        const d = new Date(rawStart);
        if (!isNaN(d.getTime())) {
          eventDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
      }

      // 检查当前用户是否可以报名
      let canSignup = true;
      let signupBlockReason = '';
      if (salon.status !== 'published' && salon.status !== 'open' && salon.status !== 'ongoing') {
        canSignup = false;
        signupBlockReason = '该沙龙暂未开放报名';
      } else if (!this.data.isMatchmaker) {
        canSignup = false;
        signupBlockReason = '仅推荐官可报名此沙龙';
      }

      const formatted = {
        id: salon.id,
        name: salon.title || salon.name || '',
        title: salon.title || salon.name || '',
        description: salon.description || '',
        location: salon.location || '',
        eventDate,
        startTime: fmtStart,
        endTime: fmtEnd,
        rawStartTime: rawStart,
        rawEndTime: rawEnd,
        coverImage: salon.cover_image || salon.coverImage || '',
        maxParticipants: salon.max_participants || salon.maxParticipants || 27,
        totalCap: salon.total_cap || 27,
        maleCount: registrantCount,
        participantsTotal: currentParticipants,
        registrationFee: salon.registration_fee || salon.registrationFee || 399,
        status: salon.status || '',
        type: salon.type || '',
        isRegistered: salon.isRegistered || false,
        myRegistration: salon.myRegistration || null,
        host: salon.organizer_name || salon.organizer || '专属活动主持',
        highlight: ['推荐官专属平台', '商务人脉对接', '资源合作拓展', '可携随行朋友', '品质审核保障'],
      };

      // 已报名则不可再次报名
      if (formatted.isRegistered) {
        canSignup = false;
        signupBlockReason = '已报名';
      }

      this.setData({
        salon: formatted,
        loading: false,
        recommenderSlots,
        recommenderRemain,
        isRegistered: formatted.isRegistered,
        canSignup,
        signupBlockReason,
      });
    } catch (err) {
      console.error('[male-salon-detail] loadDetail error:', err);
      this.setData({ loading: false });
    }
  },

  onSignup() {
    if (authService.isGuest()) {
      wx.showModal({
        title: '报名提示',
        content: '报名沙龙需先注册会员，是否立即注册？',
        confirmText: '去注册',
        success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/register/register' }); }
      });
      return;
    }

    if (!this.data.canSignup) {
      wx.showToast({ title: this.data.signupBlockReason || '暂不可报名', icon: 'none', duration: 2500 });
      return;
    }

    const userInfo = authService.getUserInfo() || {};
    const cachedGender = userInfo.gender || '';
    const genderVal = cachedGender === '男' || cachedGender === 'male' ? 'male' : (cachedGender === '女' || cachedGender === 'female' ? 'female' : '');
    const genderIdx = genderVal === 'male' ? 0 : (genderVal === 'female' ? 1 : 2);
    const displayGender = genderVal === 'male' ? '男' : (genderVal === 'female' ? '女' : '');

    this.setData({
      showSignupForm: true,
      signupForm: {
        name: userInfo.nickname || userInfo.name || '',
        mobile: userInfo.mobile || '',
        gender: displayGender,
        genderIndex: genderIdx,
        age: userInfo.age || '',
        industry: '',
        identity: '',
        position: '',
        business: '',
        advantage: '',
        companions: [],
      },
    });
  },

  preventModalClose() {},
  closeSignupForm() {
    this.setData({ showSignupForm: false });
  },

  onSignupNameInput(e) { this.setData({ 'signupForm.name': e.detail.value }); },
  onSignupMobileInput(e) { this.setData({ 'signupForm.mobile': e.detail.value }); },
  onSignupGenderChange(e) {
    const idx = e.detail.value;
    this.setData({
      'signupForm.genderIndex': idx,
      'signupForm.gender': this.data.genderOptions[idx] === '未知' ? 'unknown' : (this.data.genderOptions[idx] === '男' ? 'male' : 'female'),
    });
  },
  onSignupAgeInput(e) { this.setData({ 'signupForm.age': e.detail.value }); },
  onSignupIndustryInput(e) { this.setData({ 'signupForm.industry': e.detail.value }); },
  onSignupIdentityChange(e) { this.setData({ 'signupForm.identity': e.detail.value }); },
  onSelectIdentity(e) { this.setData({ 'signupForm.identity': e.currentTarget.dataset.value }); },
  onSignupPositionInput(e) { this.setData({ 'signupForm.position': e.detail.value }); },
  onSignupBusinessInput(e) { this.setData({ 'signupForm.business': e.detail.value }); },
  onSignupAdvantageInput(e) { this.setData({ 'signupForm.advantage': e.detail.value }); },

  onSignupCompanionNameInput(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`signupForm.companions[${idx}].name`]: e.detail.value });
  },
  onSignupCompanionMobileInput(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`signupForm.companions[${idx}].mobile`]: e.detail.value });
  },
  onSignupCompanionGenderChange(e) {
    const idx = e.currentTarget.dataset.index;
    const val = e.detail.value;
    this.setData({
      [`signupForm.companions[${idx}].genderIndex`]: val,
      [`signupForm.companions[${idx}].gender`]: this.data.genderOptions[val],
    });
  },

  addSignupCompanion() {
    const companions = this.data.signupForm.companions;
    if (companions.length >= 2) {
      wx.showToast({ title: '最多添加2位随行人员', icon: 'none' });
      return;
    }
    companions.push({ name: '', mobile: '', gender: '', genderIndex: 0 });
    this.setData({ 'signupForm.companions': companions });
  },

  async submitSignupForm() {
    const { signupForm, salon } = this.data;
    const { name, mobile, companions } = signupForm;

    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 11) {
      wx.showToast({ title: '请输入有效手机号', icon: 'none' });
      return;
    }
    for (const c of companions) {
      if (!c.name || !c.mobile) {
        wx.showToast({ title: '随行人员姓名和手机为必填', icon: 'none' });
        return;
      }
    }

    const companionsData = companions.map(c => ({
      name: c.name, mobile: c.mobile, gender: c.gender || 'unknown',
      age: signupForm.age ? Number(signupForm.age) : null,
      industry: signupForm.industry || '', identity: signupForm.identity || '',
      position: signupForm.position || '', business: signupForm.business || '',
      advantage: signupForm.advantage || '',
    }));

    const content = `活动：${salon.name}\n姓名：${name}\n手机：${mobile}\n随行：${companionsData.map(c => c.name).join('、') || '无'}`;

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认报名', content,
        confirmText: '确认报名', confirmColor: this.data.themeColor,
        success: (res) => resolve(res.confirm),
      });
    });
    if (!confirmed) return;

    this.setData({ submitting: true });
    try {
      let submitGender = signupForm.gender;
      const toEn = { '男': 'male', '女': 'female', 'male': 'male', 'female': 'female' };
      submitGender = toEn[submitGender] || submitGender;
      const authGender = authService.getUserInfo()?.gender || '';
      if (authGender) submitGender = authGender === '男' || authGender === 'male' ? 'male' : 'female';

      await request({
        url: API.SALON.JOIN.replace(':id', this.salonId),
        method: 'POST',
        data: {
          name: signupForm.name, mobile: signupForm.mobile,
          gender: submitGender || undefined,
          age: signupForm.age ? Number(signupForm.age) : undefined,
          industry: signupForm.industry || undefined,
          identity: signupForm.identity || undefined,
          position: signupForm.position || undefined,
          business: signupForm.business || undefined,
          advantage: signupForm.advantage || undefined,
          companions: companionsData.length > 0 ? companionsData : undefined,
        },
      });
      wx.showToast({ title: '报名成功！', icon: 'success' });
      this.setData({ showSignupForm: false });
      this.loadDetail();
    } catch (e) {
      wx.showToast({ title: e.message || '报名失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCancelRegistration() {
    wx.showModal({
      title: '取消报名',
      content: '确认取消报名？活动开始前24小时可取消。',
      confirmText: '确认取消',
      confirmColor: this.data.themeColor,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({
            url: API.SALON.CANCEL.replace(':id', this.salonId),
            method: 'POST',
          });
          wx.showToast({ title: '取消成功', icon: 'none' });
          this.loadDetail();
        } catch (e) {
          wx.showToast({ title: e.message || '取消失败', icon: 'none' });
        }
      },
    });
  },
});
