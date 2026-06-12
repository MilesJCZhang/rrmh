// subpackages/activity/pages/male-salon-signup/male-salon-signup.js
// 男推荐官沙龙-独立报名页面（避免弹窗渲染闪退问题）
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');

Page({
  data: {
    salonId: 0,
    loading: false,
    themeColor: '#1565C0',
    genderOptions: ['男', '女'],
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

  onLoad(options) {
    const id = Number(options.id);
    this.setData({
      salonId: id,
      name: decodeURIComponent(options.name || ''),
      mobile: decodeURIComponent(options.mobile || ''),
    });
    
    const userInfo = authService.getUserInfo() || {};
    const cachedGender = userInfo.gender || '';
    const genderVal = cachedGender === '男' ? 'male' : (cachedGender === '女' ? 'female' : '');
    const genderIdx = genderVal === 'male' ? 0 : (genderVal === 'female' ? 1 : 2);
    this.setData({
      gender: genderVal,
      genderIndex: genderIdx,
      age: userInfo.age || '',
    });
    
    wx.setNavigationBarTitle({ title: '沙龙报名' });
  },

  onSignupNameInput(e) { this.setData({ name: e.detail.value }); },
  onSignupMobileInput(e) { this.setData({ mobile: e.detail.value }); },
  onSignupGenderChange(e) {
    const idx = e.detail.value;
    this.setData({
      genderIndex: idx,
      gender: this.data.genderOptions[idx] === '未知' ? 'unknown' : (this.data.genderOptions[idx] === '男' ? 'male' : 'female'),
    });
  },
  onSignupAgeInput(e) { this.setData({ age: e.detail.value }); },
  onSignupIndustryInput(e) { this.setData({ industry: e.detail.value }); },
  onSignupIdentityChange(e) { this.setData({ identity: e.detail.value }); },
  onSignupPositionInput(e) { this.setData({ position: e.detail.value }); },
  onSignupBusinessInput(e) { this.setData({ business: e.detail.value }); },
  onSignupAdvantageInput(e) { this.setData({ advantage: e.detail.value }); },

  onSignupCompanionNameInput(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `companions[${idx}].name`;
    this.setData({ [key]: e.detail.value });
  },
  onSignupCompanionMobileInput(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `companions[${idx}].mobile`;
    this.setData({ [key]: e.detail.value });
  },
  onSignupCompanionGenderChange(e) {
    const idx = e.currentTarget.dataset.index;
    const val = e.detail.value;
    this.setData({
      [`companions[${idx}].genderIndex`]: val,
      [`companions[${idx}].gender`]: this.data.genderOptions[val] === '未知' ? 'unknown' : (this.data.genderOptions[val] === '男' ? 'male' : 'female'),
    });
  },

  addSignupCompanion() {
    const companions = this.data.companions;
    if (companions.length >= 2) {
      wx.showToast({ title: '最多添加2位随行人员', icon: 'none' });
      return;
    }
    companions.push({ name: '', mobile: '', gender: '', genderIndex: 0 });
    this.setData({ companions });
  },

  goBack() { wx.navigateBack(); },

  async submitSignupForm() {
    const { name, mobile, companions, salonId } = this.data;
    
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 11) {
      wx.showToast({ title: '请输入有效手机号', icon: 'none' });
      return;
    }

    const companionsData = companions
      .filter(c => c.name && c.mobile)
      .map(c => ({
        name: c.name,
        mobile: c.mobile,
        gender: c.gender || 'unknown',
        age: this.data.age ? Number(this.data.age) : null,
        industry: this.data.industry || '',
        identity: this.data.identity || '',
        position: this.data.position || '',
        business: this.data.business || '',
        advantage: this.data.advantage || '',
      }));

    this.setData({ loading: true });
    try {
      let submitGender = this.data.gender;
      const toEn = { '男': 'male', '女': 'female' };
      submitGender = toEn[submitGender] || submitGender;
      const authGender = authService.getUserInfo()?.gender || '';
      if (authGender) submitGender = authGender === '男' ? 'male' : 'female';

      await request({
        url: `${API.SALON.JOIN.replace(':id', salonId)}`,
        method: 'POST',
        data: {
          name,
          mobile,
          gender: submitGender || undefined,
          age: this.data.age ? Number(this.data.age) : undefined,
          industry: this.data.industry || undefined,
          identity: this.data.identity || undefined,
          position: this.data.position || undefined,
          business: this.data.business || undefined,
          advantage: this.data.advantage || undefined,
          companions: companionsData.length > 0 ? companionsData : undefined,
        },
      });
      wx.showToast({ title: '报名成功！', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '报名失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
