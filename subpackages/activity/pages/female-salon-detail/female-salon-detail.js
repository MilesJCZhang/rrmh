// subpackages/activity/pages/female-salon-detail/female-salon-detail.js
// 女推荐官沙龙详情页 - 独立页面，粉色商务风
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');

/*** 格式化 ISO 时间字符串为 HH:mm 格式 */
function formatTime(isoStr) {
  if (!isoStr) return '';
  // 去掉 "T" 和之后的时区，只取 HH:mm
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
    themeColor: '#C2185B',
    themeGradient: 'linear-gradient(135deg, #C2185B 0%, #F06292 100%)',
    isMatchmaker: false,
    isCreator: false,
    currentUserId: null,
    _active: false,
    // 推荐官沙龙单性别名额
    recommenderSlots: [],     // 数组，长度=max_recommenders，0=空位,1=已占
    recommenderRemain: 0,
    totalCap: 27,
    // 报名资料弹窗
    showSignupForm: false,
    submitting: false,
    genderOptions: ['男', '女'],
    signupForm: {
      name: '',
      mobile: '',
      gender: '',
      genderIndex: 0,
      age: '',
      industry: '',       // 所在行业
      identity: '',       // 上班族/个体老板/自由职业/其他
      position: '',       // 上班岗位/职务
      business: '',       // 经营主营项目
      advantage: '',      // 个人优势资源简介
      companions: [],    // [{name, mobile, gender, genderIndex}]
    },
    // 审核状态
    auditStatus: 'approved',  // pending/approved/rejected
    rejectReason: '',
  },

  onLoad(options) {
    const id = Number(options.id);
    this.salonId = id;

    const pages = getCurrentPages();
    this.setData({ 
      showHomeBack: pages.length <= 1,
      isMatchmaker: authService.isMatchmaker(),
      currentUserId: authService.getUserInfo()?.id || null,
      _active: true,
    });
    
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#C2185B',
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

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  _safeSetData(data) {
    if (this.data._active) this.setData(data);
  },

  async loadDetail() {
    if (!this.data._active) return;
    try {
      const resp = await request({ url: API.SALON.DETAIL.replace(':id', this.salonId) });
      if (!this.data._active) return;

      const salon = resp?.data || resp;
      if (!salon) {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        this._safeSetData({ loading: false });
        return;
      }

      // 强制检查：只允许女推荐官沙龙
      if (salon.type !== 'female_salon') {
        wx.showToast({ title: '活动类型不匹配', icon: 'none' });
        this.goBack();
        return;
      }

      const isCreator = this.data.currentUserId && salon.organizer_id === this.data.currentUserId;

      // 推荐官沙龙单性别名额可视化
      const maxRecommenders = salon.max_recommenders || 9;
      const recommenderCount = Math.max(0, salon.registeredCount || salon.female_count || 0);
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

      // 审核状态
      const auditStatus = salon.audit_status || 'approved';
      const rejectReason = salon.reject_reason || '';

      // 检查当前用户是否可以报名
      const userInfo = authService.getUserInfo() || {};
      const userGender = userInfo.gender || '';
      let canSignup = true;
      let signupBlockReason = '';
      
      if (salon.status !== 'published' && salon.status !== 'open') {
        canSignup = false;
        signupBlockReason = '该沙龙暂未开放报名';
      } else if (!this.data.isMatchmaker) {
        canSignup = false;
        signupBlockReason = '仅推荐官可报名此沙龙';
      } else if (salon.isRegistered) {
        canSignup = false;
      } else if (!userGender) {
        canSignup = false;
        signupBlockReason = '请先在"我的资料"页面完善性别资料';
    } else if (userGender !== '女' && userGender !== '女性' && userGender !== 'female') {
      canSignup = false;
      signupBlockReason = '此为女推荐官专属沙龙，仅女士可报名';
    }

      const formatted = {
        id: salon.id,
        name: salon.title || salon.name,
        title: salon.title || salon.name,
        coverImage: salon.cover_image || salon.coverImage,
        description: salon.description,
        location: salon.location,
        city: salon.city,
        eventDate: salon.event_date,
        startTime: fmtStart,
        endTime: fmtEnd,
        rawStartTime: rawStart,
        rawEndTime: rawEnd,
        maxParticipants: salon.max_participants || salon.maxParticipants || 27,
        totalCap: salon.total_cap || 27,
        femaleCount: salon.female_count || 0,
        registrationFee: salon.registration_fee || salon.registrationFee || 399,
        status: salon.status,
        type: salon.type,
        isRegistered: salon.isRegistered || false,
        myRegistration: salon.myRegistration || null,
        highlight: ['推荐官专属平台', '商务人脉对接', '资源合作拓展', '可携随行朋友', '品质审核保障'],
        host: salon.organizer_name || '专属活动主持',
      };

      wx.setNavigationBarTitle({ title: formatted.name });

      this._safeSetData({
        salon: formatted,
        loading: false,
        isRegistered: formatted.isRegistered,
        myRegistration: formatted.myRegistration
          ? { ...formatted.myRegistration, companionsText: this._formatCompanions(formatted.myRegistration.companions_json) }
          : null,
        isCreator,
        // 推荐官沙龙单性别名额
        recommenderSlots,
        recommenderRemain,
        totalCap: formatted.totalCap,
        canSignup,
        signupBlockReason,
        auditStatus,
        rejectReason,
      });
    } catch (err) {
      console.error('[female-salon-detail] loadDetail error:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this._safeSetData({ loading: false });
    }
  },

  _formatCompanions(companions) {
    if (!companions) return '';
    try {
      const list = typeof companions === 'string' ? JSON.parse(companions) : companions;
      if (Array.isArray(list) && list.length > 0) {
        return list.map(c => c.name || c).filter(Boolean).join('、');
      }
    } catch (e) { /* ignore */ }
    return '';
  },

  onShareAppMessage() {
    const { salon } = this.data;
    return {
      title: salon ? salon.name : '女推荐官沙龙',
      path: `/subpackages/activity/pages/female-salon-detail/female-salon-detail?id=${this.salonId}`,
    };
  },

  // 报名按钮点击：弹出资料填写弹窗
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

    // 重置表单并弹出弹窗
    const userInfo = authService.getUserInfo() || {};
    const cachedGender = userInfo.gender || '';
    const genderVal = cachedGender === '女' || cachedGender === 'female' ? 'female' : (cachedGender === '男' || cachedGender === 'male' ? 'male' : '');
    const genderIdx = genderVal === 'female' ? 1 : (genderVal === 'male' ? 0 : 2);
    const displayGender = genderVal === 'female' ? '女' : (genderVal === 'male' ? '男' : '');
    
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

  // 阻止弹窗内容区域的 tap 事件冒泡到遮罩层
  preventModalClose() {},

  // 关闭报名资料弹窗
  closeSignupForm() {
    this.setData({ showSignupForm: false });
  },

  // 报名资料输入
  onSignupNameInput(e) {
    this.setData({ 'signupForm.name': e.detail.value });
  },

  onSignupMobileInput(e) {
    this.setData({ 'signupForm.mobile': e.detail.value });
  },

  onSignupGenderChange(e) {
    const idx = e.detail.value;
    this.setData({
      'signupForm.genderIndex': idx,
      'signupForm.gender': this.data.genderOptions[idx],
    });
  },

  onSignupAgeInput(e) {
    this.setData({ 'signupForm.age': e.detail.value });
  },

  onSignupIndustryInput(e) {
    this.setData({ 'signupForm.industry': e.detail.value });
  },

  onSignupIdentityChange(e) {
    this.setData({ 'signupForm.identity': e.detail.value });
  },

  onSelectIdentity(e) {
    this.setData({ 'signupForm.identity': e.currentTarget.dataset.value });
  },

  onSignupPositionInput(e) {
    this.setData({ 'signupForm.position': e.detail.value });
  },

  onSignupBusinessInput(e) {
    this.setData({ 'signupForm.business': e.detail.value });
  },

  onSignupAdvantageInput(e) {
    this.setData({ 'signupForm.advantage': e.detail.value });
  },

  // 随行人员（弹窗内）
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
      [`signupForm.companions[${idx}].gender`]: this.data.genderOptions[val] === '未知' ? 'unknown' : (this.data.genderOptions[val] === '男' ? 'male' : 'female'),
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

  // 提交报名表单
  async submitSignupForm() {
    const { signupForm, salon } = this.data;
    const { name, mobile, companions } = signupForm;

    // 校验必填项
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 11) {
      wx.showToast({ title: '请输入有效手机号', icon: 'none' });
      return;
    }
    
    // 校验随行人员必填项
    for (const c of companions) {
      if (!c.name || !c.mobile) {
        wx.showToast({ title: '随行人员姓名和手机为必填', icon: 'none' });
        return;
      }
    }

    // 人数校验：已报名人数 + 本次报名人数 ≤ 27
    const totalRegistered = salon.totalRegistered || 0;
    const newRegistrations = 1 + companions.length;
    if (totalRegistered + newRegistrations > 27) {
      wx.showToast({ title: '报名人数已超过27人上限', icon: 'none' });
      return;
    }

    // 构造随行人员数组
    const companionsData = companions.map(c => ({
      name: c.name,
      mobile: c.mobile,
      gender: c.gender || 'unknown',
      age: signupForm.age ? Number(signupForm.age) : null,
      industry: signupForm.industry || '',
      identity: signupForm.identity || '',
      position: signupForm.position || '',
      business: signupForm.business || '',
      advantage: signupForm.advantage || '',
    }));

    const content = `活动：${salon.name}\n姓名：${name}\n手机：${mobile}\n随行：${companionsData.map(c => c.name).join('、') || '无'}`;

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认报名',
        content,
        confirmText: '确认报名',
        confirmColor: this.data.themeColor,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ submitting: true });
    try {
      // 强制用 authService 缓存的性别，防止表单性别选错
      let submitGender = signupForm.gender;
      const toEn = { '女': 'female', '男': 'male', 'female': 'female', 'male': 'male' };
      submitGender = toEn[submitGender] || submitGender;
      const authGender = authService.getUserInfo()?.gender || '';
      if (authGender) submitGender = authGender === '女' || authGender === 'female' ? 'female' : 'male';
      
      await request({
        url: API.SALON.JOIN.replace(':id', this.salonId),
        method: 'POST',
        data: {
          name: signupForm.name,
          mobile: signupForm.mobile,
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

  // 取消报名
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

  // 管理沙龙（创建人专属按钮）
  onManageSalon() {
    wx.navigateTo({ url: `/subpackages/activity/pages/female-salon-create/female-salon-create?id=${this.salonId}` });
  },

  // 编辑沙龙
  onEditSalon() {
    wx.navigateTo({ url: `/subpackages/activity/pages/female-salon-create/female-salon-create?id=${this.salonId}&mode=edit` });
  },

  // 下架沙龙
  onTakeDownSalon() {
    wx.showModal({
      title: '下架沙龙',
      content: '确认下架此沙龙？下架后将不再接受报名。',
      confirmText: '确认下架',
      confirmColor: '#F44336',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({
            url: `${API.SALON.DETAIL.replace(':id', this.salonId)}/take-down`,
            method: 'POST',
          });
          wx.showToast({ title: '下架成功', icon: 'none' });
          this.loadDetail();
        } catch (e) {
          wx.showToast({ title: e.message || '下架失败', icon: 'none' });
        }
      },
    });
  },

  // 去完善资料
  onGoRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },
});