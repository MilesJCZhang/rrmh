// subpackages/activity/pages/salon-detail/salon-detail.js
// 3男3女分组可视化 + tier校验报名 + 推荐官沙龙单性别报名
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');
const { getTierInfo } = require('../../../../utils/scoreHelper');
const { getSalonConfig } = require('../../../../utils/salon-config');
const { createPayment, PAYMENT_TYPES } = require('../../../../utils/payment');

/** 格式化 ISO 时间字符串为 HH:mm 格式 */
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
    salonType: '',
    isRegistered: false,
    myRegistration: null,
    companions: [],
    themeColor: '#C8102E',
    themeGradient: 'linear-gradient(135deg, #C8102E, #E8524A)',
    isMatchmaker: false,
    isCreator: false,
    currentUserId: null,
    _active: false,
    // 3男3女分组可视化（常规沙龙）
    groups: [],
    maleSlots: [0, 0, 0],    // 0=空位, 1=已占
    femaleSlots: [0, 0, 0],
    maleRemain: 0,
    femaleRemain: 0,
    // 推荐官沙龙单性别名额
    recommenderSlots: [],     // 数组，长度=max_recommenders，0=空位,1=已占
    recommenderRemain: 0,
    // 通用剩余名额（常规沙龙=maleRemain+femaleRemain，推荐官沙龙=recommenderRemain）
    salonRemain: 0,
    totalCap: 27,
    // 评分tier
    myScoreTier: 'unrated',
    myProfileScore: 0,
    tierInfo: null,
    canSignup: false,
    signupBlockReason: '',
    showHomeBack: false,
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
      industry: '',
      identity: '',       // 上班族/个体老板/自由职业/其他
      position: '',       // 上班岗位/职务
      business: '',       // 经营主营项目
      advantage: '',      // 个人优势资源简介
      companions: [],    // [{name, mobile, gender, genderIndex}]
    },
  },

  onLoad(options) {
    const id = Number(options.id);
    this.salonId = id;

    // 检查是否需要显示首页返回按钮（分享/扫码直接进入时无返回按钮）
    const pages = getCurrentPages();
    this.setData({ showHomeBack: pages.length <= 1 });

    const app = getApp();
    const myScoreTier = app?.globalData?.scoreTier || 'unrated';
    const myProfileScore = app?.globalData?.profileScore || 0;

    this.setData({
      isMatchmaker: authService.isMatchmaker(),
      currentUserId: authService.getUserInfo()?.id || null,
      _active: true,
      myScoreTier,
      myProfileScore,
      tierInfo: getTierInfo(myScoreTier),
    });
    this.loadDetail();
  },

  onShow() {
    this.setData({ _active: true });
    // 每次页面显示重新加载详情（用户可能在"我的资料"页刚更新了性别）
    // 避免已加载过但 gender 缓存为空时按钮状态不更新
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

      // 使用配置系统获取主题色
      const type = salon.type || '';
      const config = getSalonConfig(type);
      let themeColor = '#C8102E';
      let themeGradient = 'linear-gradient(135deg, #C8102E, #E8524A)';
      if (config && config.theme) {
        themeColor = config.theme.color || themeColor;
        themeGradient = config.theme.gradient || themeGradient;
      }

      const isCreator = this.data.currentUserId && salon.organizer_id === this.data.currentUserId;

      // 3男3女分组可视化（仅常规沙龙）
      const groups = salon.isGrouped ? (salon.groups || []) : [];
      const maleRemain = salon.maleRemain || 0;
      const femaleRemain = salon.femaleRemain || 0;

      // 构建3男3女分组可视化数据（常规沙龙用）
      let maleSlots = [0, 0, 0];
      let femaleSlots = [0, 0, 0];
      if (groups.length > 0) {
        const myGroup = groups.find(g => g.score_tier === this.data.myScoreTier) || groups[0];
        const members = myGroup?.members || [];
        let maleIdx = 0, femaleIdx = 0;
        for (const m of members) {
          if (m.gender === 'male' && maleIdx < 3) maleSlots[maleIdx++] = 1;
          if (m.gender === 'female' && femaleIdx < 3) femaleSlots[femaleIdx++] = 1;
        }
      }

      // 推荐官沙龙单性别名额可视化
      // 推荐官沙龙只有单性别，使用 registeredCount
      const maxRecommenders = salon.max_recommenders || 9;
      const isMaleSalon = type === 'male_salon';
      const recommenderCount = Math.max(0, salon.registeredCount || salon.male_count || salon.female_count || 0);
      const recommenderRemain = maxRecommenders - recommenderCount;
      const recommenderSlots = [];
      for (let i = 0; i < maxRecommenders; i++) {
        recommenderSlots.push(i < recommenderCount ? 1 : 0);
      }

      // 通用剩余名额（用于名额状态和报名按钮判断）
      const salonRemain = type ? recommenderRemain : (maleRemain + femaleRemain);

      // 时间格式化（处理 ISO 格式如 "T01:00:00.000Z"）
      const rawStart = salon.start_time || salon.startTime;
      const rawEnd = salon.end_time || salon.endTime;
      const fmtStart = formatTime(rawStart);
      const fmtEnd = formatTime(rawEnd);

      // 检查当前用户是否可以报名
      const allowedTiers = (salon.allowed_tiers || 'gold,silver,bronze').split(',').map(t => t.trim());
      // 推荐官沙龙性别判定：统一从 authService.getUserInfo() 获取
      // 数据来源：用户"我的资料"页面保存的 gender 字段，经 auth.service.js syncUserData 同步到本地缓存
      const userInfo = authService.getUserInfo() || {};
      const userGender = userInfo.gender || '';
      const userIsMale = userGender === 'male' || userGender === '男';
      let canSignup = true;
      let signupBlockReason = '';
      if (salon.status !== 'published' && salon.status !== 'open') {
        canSignup = false;
        signupBlockReason = '该沙龙暂未开放报名';
      } else if (salon.isRegistered) {
        canSignup = false;
      } else if (type) {
        // 推荐官沙龙：仅推荐官身份可报名
        if (!this.data.isMatchmaker) {
          canSignup = false;
          signupBlockReason = '仅推荐官可报名此沙龙';
        } else if (!userGender) {
          canSignup = false;
          signupBlockReason = '请先在"我的"页面完善性别资料';
        } else if (type === 'male_salon' && !userIsMale) {
          canSignup = false;
          signupBlockReason = '此为男推荐官专属沙龙，仅男士可报名';
        } else if (type === 'female_salon' && userIsMale) {
          canSignup = false;
          signupBlockReason = '此为女推荐官专属沙龙，仅女士可报名';
        }
      } else {
        // 常规沙龙：检查评分等级
        if (!allowedTiers.includes(this.data.myScoreTier) && salon.score_tier !== 'all') {
          canSignup = false;
          signupBlockReason = `您的评分等级(${this.data.tierInfo?.label || '未建档'})不满足该场次要求`;
        } else if (this.data.myScoreTier === 'unrated') {
          canSignup = false;
          signupBlockReason = '请先完善资料建档';
        }
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
        maxParticipants: salon.max_participants || salon.maxParticipants || 6,
        maxPerGender: salon.max_per_gender || 3,
        totalCap: salon.total_cap || 27,
        maleCount: salon.male_count || 0,
        femaleCount: salon.female_count || 0,
        registeredCount: salon.registeredCount || 0,
        totalParticipants: salon.totalParticipants || 0,
        registrationFee: salon.registration_fee || salon.registrationFee || 399,
        status: salon.status,
        type: type,
        scoreTier: salon.score_tier || 'all',
        allowedTiers: salon.allowed_tiers || 'gold,silver,bronze',
        isGrouped: salon.is_grouped !== 0,
        isRegistered: salon.isRegistered || false,
        myRegistration: salon.myRegistration || null,
        highlight: salon.highlight || (['male_salon', 'female_salon'].includes(type)
          ? ['推荐官专属平台', 'AI智能推荐同好', '活动主持全程引导', '可携随行朋友', '按评分段匹配']
          : ['3男3女精准分组', 'AI智能推荐同好', '活动主持全程引导', '资料隐私加密保护', '按评分段深度了解']
        ),
        host: salon.organizer_name || '专属活动主持',
      };

      wx.setNavigationBarTitle({ title: formatted.name });

      this._safeSetData({
        salon: formatted,
        loading: false,
        salonType: type,
        themeColor,
        themeGradient,
        isRegistered: formatted.isRegistered,
        myRegistration: formatted.myRegistration
          ? { ...formatted.myRegistration, companionsText: this._formatCompanions(formatted.myRegistration.companions_json) }
          : null,
        isCreator,
        groups,
        maleSlots,
        femaleSlots,
        maleRemain,
        femaleRemain,
        // 推荐官沙龙单性别名额
        recommenderSlots,
        recommenderRemain,
        salonRemain,
        canSignup,
        signupBlockReason,
      });
    } catch (err) {
      console.error('[salon-detail] loadDetail error:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this._safeSetData({ loading: false });
    }
  },

  onShareAppMessage() {
    const { salon } = this.data;
    return {
      title: salon ? salon.name : '主题社交沙龙',
      path: `/subpackages/activity/pages/salon-detail/salon-detail?id=${this.salonId}`,
    };
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

  // 添加/删除/输入随行人员
  addCompanion() {
    const companions = this.data.companions;
    if (companions.length >= 3) {
      wx.showToast({ title: '最多添加3位随行人员', icon: 'none' });
      return;
    }
    companions.push({ name: '' });
    this.setData({ companions });
  },

  removeCompanion(e) {
    const index = e.currentTarget.dataset.index;
    const companions = this.data.companions;
    companions.splice(index, 1);
    this.setData({ companions });
  },

  onCompanionInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const companions = this.data.companions;
    companions[index].name = value;
    this.setData({ companions });
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
    // 推荐官沙龙：自动填入 authService 中的性别，防止用户选错
    const userInfo = authService.getUserInfo() || {};
    const cachedGender = userInfo.gender || '';
    // genderOptions = ['男', '女']，显示中文，提交时转英文
    const genderDisplayMap = { male: '男', female: '女' };
    const genderVal = genderDisplayMap[cachedGender] || '';
    const genderIdx = genderVal === '男' ? 0 : (genderVal === '女' ? 1 : 0);
    this.setData({
      showSignupForm: true,
      signupForm: {
        name: userInfo.nickname || userInfo.name || '',
        mobile: userInfo.mobile || '',
        gender: genderVal,
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

    // 构造随行人员数组（性别中文转英文）
    const genderToEn = { '男': 'male', '女': 'female' };
    const companionsData = companions.map(c => ({
      name: c.name,
      mobile: c.mobile,
      gender: genderToEn[c.gender] || c.gender || 'unknown',
      age: signupForm.age ? Number(signupForm.age) : null,
      industry: signupForm.industry || '',
      identity: signupForm.identity || '',
      position: signupForm.position || '',
      business: signupForm.business || '',
      advantage: signupForm.advantage || '',
    }));

    const fee = this.data.salon.registrationFee || 0;
    const content = `活动：${salon.name}\n姓名：${name}\n手机：${mobile}\n随行：${companionsData.map(c => c.name).join('、') || '无'}${fee > 0 ? `\n\n报名费：¥${fee.toFixed(2)}` : ''}`;

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: fee > 0 ? '支付确认' : '确认报名',
        content,
        confirmText: fee > 0 ? '去支付' : '确认报名',
        confirmColor: this.data.themeColor,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ submitting: true });
    try {
      // === 支付环节：常规沙龙付费报名 ===
      let orderId = null;
      const fee = this.data.salon.registrationFee || 0;
      if (fee > 0) {
        const payResult = await createPayment({
          type: PAYMENT_TYPES.SALON_TICKET_REGULAR,
          amount: fee,
          description: `${this.data.salon.name} 报名费`,
          extra: { salon_id: this.salonId },
        });
        if (!payResult.success) {
          if (payResult.reason === 'cancelled') {
            wx.showToast({ title: '支付已取消', icon: 'none' });
          } else {
            wx.showToast({ title: payResult.message || '支付失败', icon: 'none' });
          }
          return;
        }
        orderId = payResult.orderId;
      }

      // 推荐官沙龙：强制用 authService 缓存的性别，防止表单性别选错
      let submitGender = signupForm.gender;
      // 中文转英文（后端统一用 male/female）
      const toEn = { '男': 'male', '女': 'female' };
      submitGender = toEn[submitGender] || submitGender;
      if (this.data.salonType) {
        const authGender = authService.getUserInfo()?.gender || '';
        if (authGender) submitGender = authGender;
      }
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
          order_id: orderId,
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
      confirmColor: '#C8102E',
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

  // 发布沙龙
  async onPublishSalon() {
    wx.showModal({
      title: '发布沙龙',
      content: '确认发布此沙龙？发布后将对所有用户可见。',
      confirmText: '确认发布',
      confirmColor: this.data.themeColor,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request({
            url: API.SALON.PUBLISH.replace(':id', this.salonId),
            method: 'POST',
          });
          wx.showToast({ title: '发布成功', icon: 'none' });
          this.loadDetail();
        } catch (e) {
          wx.showToast({ title: e.message || '发布失败', icon: 'none' });
        }
      },
    });
  },

  // 去完善资料
  onGoRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },
});
