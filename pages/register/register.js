// pages/register/register.js
// 单身会员建档 - 5步任意跳转，全选填，免费，实时评分
const { ensureLogin } = require('../../utils/auth');
const { request, uploadFile } = require('../../utils/request');
const { getReferrerId, getReferrerName, getReferrerInfo, hasReferrer, bindReferrer, verifyCode, bindByCode } = require('../../utils/referral');
const { serverCheckImageUpload } = require('../../utils/contentModeration');
const authService = require('../../services/auth.service');
const referralService = require('../../services/referral.service');
const { getProfile } = require('../../services/user.service');
const { loadDraft, saveDraft, clearDraft } = require('../../utils/formDraft');
const { getScoreForData, GROUP_LABELS } = require('../../utils/scoreHelper');
const { payment } = require('../../utils/payment');

// ─── 选项配置 ───────────────────────────────────
const EDUCATIONS = [
  { val: 'high_school', label: '高中' },
  { val: 'college', label: '大专' },
  { val: 'bachelor', label: '本科' },
  { val: 'master', label: '硕士' },
  { val: 'doctor', label: '博士' },
];
const INCOMES = [
  { val: 'below_5k', label: '5千以下' },
  { val: '5k_10k', label: '5千~1万' },
  { val: '10k_20k', label: '1万~2万' },
  { val: '20k_50k', label: '2万~5万' },
  { val: 'above_50k', label: '5万以上' },
];
const MARITALS = [
  { val: 'single', label: '单身' },
  { val: 'divorced', label: '离异' },
  { val: 'widowed', label: '丧偶' },
];
const LOCATIONS = [
  { val: 'nearby', label: '附近' },
  { val: 'same_city', label: '同城' },
  { val: 'same_province', label: '同省' },
  { val: 'nationwide', label: '全国不限' },
];
const MARRIAGE_EXPECTS = [
  { val: 'serious', label: '真诚社交' },
  { val: 'explore', label: '先了解再说' },
  { val: 'remarry', label: '重新出发' },
];
const CHILDREN = [
  { val: 'want', label: '计划育儿' },
  { val: 'no', label: '暂不计划' },
  { val: 'have_ok', label: '可以接受' },
  { val: 'flexible', label: '顺其自然' },
];
const HEALTH_TAGS = [
  '定期体检', '注重饮食', '坚持运动', '作息规律', '不熬夜',
  '心态积极', '情绪稳定', '不焦虑', '轻度素食', '健康管理',
  '瑜伽冥想', '跑步骑行', '游泳健身', '户外运动', '中医调理',
];
const SLEEP_HABITS = [
  { val: 'early', label: '早睡早起' },
  { val: 'normal', label: '作息规律' },
  { val: 'late', label: '习惯晚睡' },
];
const SPORT_HABITS = [
  { val: 'daily', label: '每天运动' },
  { val: 'weekly', label: '每周运动' },
  { val: 'occasionally', label: '偶尔' },
  { val: 'none', label: '不太运动' },
];
const DIET_TAGS = [
  '清淡饮食', '辛辣口味', '素食主义', '健康轻食', '海鲜爱好者',
  '火锅爱好者', '甜食爱好者', '烘焙爱好者', '规律三餐', '饮食随意',
];
const PROPERTY_OPTIONS = [
  { val: 'full_owned', label: '全款房' },
  { val: 'mortgage', label: '按揭房' },
  { val: 'self_built', label: '自建房' },
  { val: 'none', label: '无房产' },
];

// 5步定义
const STEPS = [
  { key: 0, label: '基础信息', group: 'basic' },
  { key: 1, label: '职业收入', group: 'career' },
  { key: 2, label: '兴趣偏好', group: 'hobby' },
  { key: 3, label: '认证资料', group: 'verification' },
  { key: 4, label: '资产证明', group: 'asset' },
];

Page({
  data: {
    // 5步Tab
    activeTab: 0,
    steps: STEPS,

    loading: false,
    isEditMode: false,

    // 会员解锁相关
    isMemberUnlocked: false,    // 是否已解锁会员
    showPaymentModal: false,    // 是否显示缴费弹窗
    phoneValid: false,          // 手机号格式是否正确
    selectedPayment: 0,         // 当前选中的支付方式索引
    memberPrice: 0.19,         // 会员费用（限时特惠价，与支付系统一致）
    paymentMethods: ['微信支付', '支付宝'], // 支付方式

    // 评分
    scoreInfo: {
      totalScore: 0,
      tier: 'unrated',
      groupScores: {},
    },

    form: {
      avatar: '',
      nickname: '',
      gender: '',
      birthYear: '',
      city: [],
      cityLabel: '',
      education: '',
      occupation: '',
      income: '',
      maritalStatus: '',
      phone: '',
      wechatAccount: '',
      intro: '',
      referralCode: '',
      existingReferrer: false,
      referrerName: '',
      hasProperty: '',
      propertyType: '',
      hasCar: '',
      // 择偶需求
      expectAgeMin: '',
      expectAgeMax: '',
      expectEducation: '',
      expectIncome: '',
      expectLocation: 'same_city',
      marriageExpect: '',
      childrenAttitude: '',
      // 健康与生活习惯
      healthTags: [],
      sleepHabit: '',
      sportHabit: '',
      dietTags: [],
      smoking: 'no',
      drinking: 'no',
      // 认证资料 (Step 3)
      idCardFrontImage: '',
      idCardBackImage: '',
      faceAuthStatus: 'none',
      // 资产证明 (Step 4)
      propertyImages: [],   // URL array
      vehicleImages: [],    // URL array
      bankDepositProof: '',
      insuranceProof: '',
      financeProof: '',
    },

    // 预计算选项列表
    educationOptions: [],
    incomeOptions: [],
    maritalOptions: [],
    propertyOptions: [],
    expectEducationOptions: [],
    expectIncomeOptions: [],
    locationOptions: [],
    marriageExpectOptions: [],
    childrenAttitudeOptions: [],
    healthTagCheckList: [],
    sleepHabitOptions: [],
    sportHabitOptions: [],
    dietTagCheckList: [],
  },

  onLoad(options) {
    const { referralCode, code, scene } = options;

    // 提取推荐码
    let extractedCode = '';
    if (referralCode) extractedCode = referralCode;
    else if (code) extractedCode = code;
    else if (scene) {
      const params = new URLSearchParams(decodeURIComponent(scene));
      extractedCode = params.get('invitationCode') || params.get('referralCode') || '';
    }
    if (extractedCode) {
      this.setData({ 'form.referralCode': extractedCode.toUpperCase() });
    }

    // 补：从 storage 读取推荐码（访客通过分享进入时由 app.js 写入）
    if (!extractedCode) {
      let storedCode = wx.getStorageSync('invitation_code') || '';
      if (!storedCode && options.invitationCode) {
        storedCode = options.invitationCode.toUpperCase();
      }
      if (!storedCode && options.code) {
        storedCode = options.code.toUpperCase();
      }
      if (storedCode) {
        this.setData({ 'form.referralCode': storedCode });
      }
    }

    // 检查已有推荐人
    const existingRefId = getReferrerId();
    if (existingRefId) {
      const refInfo = getReferrerInfo();
      const code = this.data.form.referralCode;
      this.setData({
        'form.existingReferrer': true,
        'form.referrerName': refInfo?.name || code || '推荐官',
        // 保留推荐码不清空，供展示
      });
    }

    ensureLogin().then(async () => {
      this._loadExistingProfile();
      const draft = loadDraft(this);
      if (draft) {
        const form = { ...this.data.form, ...draft };
        this.setData({ form });
        this._refreshAllOptions();
      }

      // 检查用户是否已经是会员（通过已有档案信息判断）
      try {
        const userInfo = await getProfile();
        // request 已解包，userInfo 直接是后端 data 数据
        if (userInfo && userInfo.phone) {
          // 已有手机号 = 已经是会员
          this.setData({ isMemberUnlocked: true });
          // 同步填充已有数据到表单
          const form = { ...this.data.form };
          if (userInfo.nickname) form.nickname = userInfo.nickname;
          if (userInfo.phone) form.phone = userInfo.phone;
          if (userInfo.gender) form.gender = userInfo.gender;
          if (userInfo.city) form.city = userInfo.city;
          this.setData({ form, phoneValid: true });
        }
      } catch (err) {
        console.warn('[register] 检查会员状态失败:', err.message);
      }
    }).catch(() => {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    });
  },

  // ─── 手机号实时校验 ─────────────────────
  onPhoneInput(e) {
    const phone = e.detail.value || '';
    this.setData({ 'form.phone': phone });
    const phoneValid = /^1[3-9]\d{9}$/.test(phone);
    this.setData({ phoneValid });
    this._updateScore();
  },

  // ─── 检查手机号格式 ─────────────────────
  _checkPhoneFormat() {
    const phone = this.data.form.phone || '';
    if (!phone) {
      wx.showToast({ title: '请先填写手机号', icon: 'none' });
      return false;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return false;
    }
    return true;
  },

  // ─── 成为会员按钮点击 ─────────────────────
  onBecomeMember() {
    // 已解锁，按钮置灰，不处理
    if (this.data.isMemberUnlocked) return;

    // 校验手机号
    if (!this._checkPhoneFormat()) return;

    // 弹出会员缴费弹窗
    this.setData({ showPaymentModal: true });
  },

  // ─── 关闭缴费弹窗 ─────────────────────
  onClosePaymentModal() {
    this.setData({ showPaymentModal: false });
    wx.showToast({ title: '支付未完成，会员资格暂未解锁', icon: 'none', duration: 2000 });
  },

  // ─── 选择支付方式 ─────────────────────
  onSelectPayment(e) {
    this.setData({ selectedPayment: e.currentTarget.dataset.index });
  },

  // ─── 阻止冒泡 ─────────────────────
  preventBubble() {
    // 阻止点击事件冒泡到遮罩层
  },

  // ─── 确认支付 ─────────────────────
  async onConfirmPayment() {
    this.setData({ loading: true });

    try {
      // 调用统一支付接口（与「我的」页面加入会员复用相同逻辑）
      const payResult = await payment.payRegistration();

      if (payResult.success) {
        wx.showToast({ title: '支付成功，欢迎加入！', icon: 'success' });
        authService.setHasProfile(true);
        authService.setIsPaid(true);

        // 支付成功后立即更新访客状态为已支付（不等建档完成）
        const openid = authService.getOpenId();
        if (openid) {
          referralService.updateVisitorStatus({
            visitor_openid: openid,
            reg_status: 'paid',
          }).catch(err => console.warn('[register] 更新访客状态失败:', err));
        }

        this.setData({
          isMemberUnlocked: true,
          showPaymentModal: false,
        });

        wx.showToast({ title: '会员解锁成功，可继续完善资料', icon: 'success', duration: 2000 });

        // 保存手机号
        this._savePhoneToServer();

        // 刷新用户信息（同步后端 role → 'member'）
        try {
          const userInfo = await getProfile();
          if (userInfo) {
            authService.syncUserData(userInfo);
            // 强制确保 roleList 包含 'member'（支付成功后立即生效）
            const info = authService.getUserInfo() || {};
            const roleList = userInfo.roleList || info.roleList || [];
            if (!roleList.includes('member')) {
              roleList.push('member');
            }
            info.roleList = roleList;
            authService.setUserInfo(info);
          }
        } catch (e) {
          console.warn('[register] 刷新用户信息失败:', e.message);
        }
      } else {
        this.onPaymentFail(payResult.reason === 'cancelled' ? '支付已取消' : '支付未完成');
      }
    } catch (err) {
      this.onPaymentFail(err.message || '支付失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // ─── 支付失败回调 ─────────────────────
  onPaymentFail(msg) {
    wx.hideLoading();
    this.setData({ showPaymentModal: false });
    wx.showToast({
      title: msg || '支付未完成，会员资格暂未解锁',
      icon: 'none',
      duration: 2000,
    });
    // 保留已填手机号
  },

  // ─── 保存手机号到后端 ─────────────────────
  async _savePhoneToServer() {
    const phone = this.data.form.phone;
    if (!phone) return;

    try {
      await request({
        url: '/v1/user/profile/update',
        method: 'PUT',
        data: { phone },
      });
    } catch (err) {
      console.warn('[register] 保存手机号失败:', err.message);
    }
  },

  // ─── Tab 跳转（未解锁时禁用后续步骤）──────────────────────
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;

    // 未解锁会员时，禁止跳转到后续步骤
    if (!this.data.isMemberUnlocked && tab > 0) {
      wx.showToast({ title: '请先成为会员以解锁全部功能', icon: 'none' });
      return;
    }

    this.setData({ activeTab: tab });
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // ─── 加载已有档案 ─────────────────────
  async _loadExistingProfile() {
    try {
      const profile = await getProfile();
      if (profile && (profile.id || profile.profile_id)) {
        const city = profile.city || '';
        this.setData({
          isEditMode: true,
          form: {
            ...this.data.form,
            avatar: profile.avatar || '',
            nickname: profile.nickname || '',
            gender: profile.gender || '',
            birthYear: profile.birth_year || profile.birthYear || '',
            city: city ? city.split(' ') : [],
            cityLabel: city || '',
            education: profile.education || '',
            occupation: profile.occupation || '',
            income: profile.income || '',
            maritalStatus: profile.marital_status || profile.maritalStatus || '',
            phone: profile.phone || '',
            wechatAccount: profile.wechatAccount || '',
            intro: profile.intro || '',
            hasProperty: profile.has_property || profile.hasProperty || '',
            propertyType: profile.property_type || profile.propertyType || '',
            hasCar: profile.has_car || profile.hasCar || '',
            expectAgeMin: profile.expect_age_min || profile.expectAgeMin || '',
            expectAgeMax: profile.expect_age_max || profile.expectAgeMax || '',
            expectEducation: profile.expect_education || profile.expectEducation || '',
            expectIncome: profile.expect_income || profile.expectIncome || '',
            expectLocation: profile.expect_location || profile.expectLocation || 'same_city',
            marriageExpect: profile.marriage_expect || profile.marriageExpect || '',
            childrenAttitude: profile.children_attitude || profile.childrenAttitude || '',
            healthTags: profile.health_tags || profile.healthTags || [],
            sleepHabit: profile.sleep_habit || profile.sleepHabit || '',
            sportHabit: profile.sport_habit || profile.sportHabit || '',
            dietTags: profile.diet_tags || profile.dietTags || [],
            smoking: profile.smoking || 'no',
            drinking: profile.drinking || 'no',
            // 认证
            idCardFrontImage: profile.idCardFrontImage || profile.id_card_front_image || '',
            idCardBackImage: profile.idCardBackImage || profile.id_card_back_image || '',
            faceAuthStatus: profile.faceAuthStatus || profile.face_auth_status || 'none',
            // 资产
            propertyImages: this._parseJsonArray(profile.propertyImages || profile.property_images),
            vehicleImages: this._parseJsonArray(profile.vehicleImages || profile.vehicle_images),
            bankDepositProof: profile.bankDepositProof || profile.bank_deposit_proof || '',
            insuranceProof: profile.insuranceProof || profile.insurance_proof || '',
            financeProof: profile.financeProof || profile.finance_proof || '',
          },
        });
        wx.setNavigationBarTitle({ title: '编辑我的档案' });
      }
    } catch (e) {
      // 加载失败不影响
    }
    this._refreshAllOptions();
    this._updateScore();
  },

  _parseJsonArray(str) {
    if (Array.isArray(str)) return str;
    if (!str) return [];
    try { return JSON.parse(str); } catch (e) { return []; }
  },

  // ─── 评分更新 ──────────────────────────────────
  _updateScore() {
    const { totalScore, tier, groupScores } = getScoreForData(this.data.form);
    this.setData({
      scoreInfo: { totalScore, tier, groupScores },
    });
  },

  // ─── 选项 checked 状态刷新 ──────────────────────
  _checkOptions(list, key) {
    const cur = this.data.form[key];
    return list.map(o => ({ ...o, checked: o.val === cur }));
  },

  _checkTagList(tagArray, key) {
    const selected = this.data.form[key] || [];
    return tagArray.map(t => ({ val: t, label: t, checked: selected.indexOf(t) >= 0 }));
  },

  _refreshAllOptions() {
    this.setData({
      educationOptions: this._checkOptions(EDUCATIONS, 'education'),
      incomeOptions: this._checkOptions(INCOMES, 'income'),
      maritalOptions: this._checkOptions(MARITALS, 'maritalStatus'),
      propertyOptions: this._checkOptions(PROPERTY_OPTIONS, 'propertyType'),
      expectEducationOptions: this._checkOptions(EDUCATIONS, 'expectEducation'),
      expectIncomeOptions: this._checkOptions(INCOMES, 'expectIncome'),
      locationOptions: this._checkOptions(LOCATIONS, 'expectLocation'),
      marriageExpectOptions: this._checkOptions(MARRIAGE_EXPECTS, 'marriageExpect'),
      childrenAttitudeOptions: this._checkOptions(CHILDREN, 'childrenAttitude'),
      healthTagCheckList: this._checkTagList(HEALTH_TAGS, 'healthTags'),
      sleepHabitOptions: this._checkOptions(SLEEP_HABITS, 'sleepHabit'),
      sportHabitOptions: this._checkOptions(SPORT_HABITS, 'sportHabit'),
      dietTagCheckList: this._checkTagList(DIET_TAGS, 'dietTags'),
    });
  },

  // ─── Tab 跳转 ──────────────────────────────────
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // ─── 事件处理 ──────────────────────────────────
  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ ['form.' + key]: e.detail.value });
    this._updateScore();
  },

  onSelect(e) {
    const { key, val } = e.currentTarget.dataset;
    this.setData({ ['form.' + key]: val });
    this._refreshAllOptions();
    this._updateScore();
  },

  onTagToggle(e) {
    const { key, val } = e.currentTarget.dataset;
    const list = [...(this.data.form[key] || [])];
    const idx = list.indexOf(val);
    if (idx >= 0) { list.splice(idx, 1); }
    else { list.push(val); }
    this.setData({ ['form.' + key]: list });
    this._refreshAllOptions();
    this._updateScore();
  },

  onBirthYearChange(e) {
    this.setData({ 'form.birthYear': e.detail.value });
    this._updateScore();
  },

  onCityChange(e) {
    this.setData({
      'form.city': e.detail.value,
      'form.cityLabel': e.detail.value.join(' '),
    });
    this._updateScore();
  },

  async onAvatarUpload() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });
      const tempFile = res.tempFiles[0].tempFilePath;
      this.setData({ 'form.avatar': tempFile });

      const token = wx.getStorageSync('token') || '';
      const safeResult = await serverCheckImageUpload(tempFile, token);
      if (!safeResult.safe) {
        wx.showToast({ title: '头像图片不合规，请重新上传', icon: 'none' });
        this.setData({ 'form.avatar': '' });
        return;
      }

      const uploaded = await uploadFile(tempFile, 'avatar');
      this.setData({ 'form.avatar': uploaded.url });
      this._updateScore();
    } catch (e) { /* 用户取消 */ }
  },

  // ─── 认证上传 (Step 3) ─────────────────────────
  async onUploadIdCard(e) {
    const side = e.currentTarget.dataset.side; // front / back
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });
      const tempFile = res.tempFiles[0].tempFilePath;
      const uploaded = await uploadFile(tempFile, 'image');
      const key = side === 'front' ? 'form.idCardFrontImage' : 'form.idCardBackImage';
      this.setData({ [key]: uploaded.url });
      this._updateScore();
    } catch (e) { /* 用户取消 */ }
  },

  // ─── 资产上传 (Step 4) ─────────────────────────
  async onUploadAssetImage(e) {
    const { type } = e.currentTarget.dataset; // property, vehicle, bank_deposit, insurance, finance
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: type === 'property' || type === 'vehicle' ? 5 : 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });

      const uploadedUrls = [];
      for (const file of res.tempFiles) {
        const uploaded = await uploadFile(file.tempFilePath, 'image');
        if (uploaded.url) uploadedUrls.push(uploaded.url);
      }

      if (type === 'property') {
        const existing = this.data.form.propertyImages || [];
        this.setData({ 'form.propertyImages': [...existing, ...uploadedUrls] });
      } else if (type === 'vehicle') {
        const existing = this.data.form.vehicleImages || [];
        this.setData({ 'form.vehicleImages': [...existing, ...uploadedUrls] });
      } else if (type === 'bank_deposit') {
        this.setData({ 'form.bankDepositProof': uploadedUrls[0] || '' });
      } else if (type === 'insurance') {
        this.setData({ 'form.insuranceProof': uploadedUrls[0] || '' });
      } else if (type === 'finance') {
        this.setData({ 'form.financeProof': uploadedUrls[0] || '' });
      }
      this._updateScore();
    } catch (e) { /* 用户取消 */ }
  },

  onRemoveAssetImage(e) {
    const { type, index } = e.currentTarget.dataset;
    if (type === 'property') {
      const list = [...this.data.form.propertyImages];
      list.splice(index, 1);
      this.setData({ 'form.propertyImages': list });
    } else if (type === 'vehicle') {
      const list = [...this.data.form.vehicleImages];
      list.splice(index, 1);
      this.setData({ 'form.vehicleImages': list });
    }
    this._updateScore();
  },

  // ─── 扫描推荐码 ──────────────────────────────────
  onScanReferralCode() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const raw = (res.result || '').trim();
        if (!raw) { wx.showToast({ title: '未识别到推荐码', icon: 'none' }); return; }
        let code = '';
        const match = raw.match(/(?:invitationCode|code|referralCode)=([A-Z0-9]+)/i);
        if (match) code = match[1];
        else if (/^[A-Z]{2,5}\d+$/.test(raw)) code = raw;
        if (code) {
          this.setData({ 'form.referralCode': code.toUpperCase() });
          wx.showToast({ title: '推荐码已识别', icon: 'success', duration: 1500 });
        } else {
          wx.showToast({ title: '无法识别推荐码格式', icon: 'none' });
        }
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      },
    });
  },

  // ─── 保存当前步骤 ──────────────────────────────────
  async onSaveStep() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      await this._submitForm();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // ─── 提交档案 ──────────────────────────────────
  async onSubmit() {
    if (this.data.loading) return;

    // 确认登录
    if (!authService.isLogin()) {
      const { requireLogin } = require('../../utils/auth');
      const loggedIn = await requireLogin('建档需要登录后才能进行');
      if (!loggedIn) return;
    }

    this.setData({ loading: true });
    try {
      await this._submitForm();

      // 同步会员档案资料到后端
      // 注意：支付建档费（single_registration）后 role 仍为 'user'，
      // "会员"身份由 orders 表中的付费记录界定，不依赖 role 字段
      // 这里调用 member/register 将完整资料写入 users 表
      const form = this.data.form;
      if (form.gender && form.birthYear) {
        try {
          await request({
            url: '/v1/member/register',
            method: 'POST',
            data: {
              gender: form.gender,
              birthYear: parseInt(form.birthYear),
              occupation: form.occupation || '',
              income: form.income || '',
              location: form.cityLabel || '',
              education: form.education || '',
              marriage: form.maritalStatus || '',
              children: form.childrenAttitude || '',
              description: form.intro || '',
            },
          });
        } catch (err) {
          // 创建会员记录失败不阻塞后续操作（payment回调已更新role）
          console.warn('[register] 创建会员记录失败:', err.message);
        }
      }

      // 同步评分到全局
      const app = getApp();
      if (app && app._syncScoreData) {
        app._syncScoreData();
      }

      // 判断是否为最后一步
      const stepsLen = this.data.steps ? this.data.steps.length : 5;
      const isLastStep = this.data.activeTab >= stepsLen - 1;

      if (isLastStep) {
        // 最后一步 → 跳转到智能推荐
        wx.showToast({ title: this.data.isEditMode ? '档案已更新' : '建档成功', icon: 'success' });
        const openid = authService.getOpenId();
        if (openid) {
          referralService.updateVisitorStatus({
            visitor_openid: openid,
            reg_status: 'registered',
          }).catch(err => console.warn('[register] 更新访客状态失败:', err));
        }
        setTimeout(() => {
          wx.switchTab({ url: '/pages/match/match' });
        }, 1500);
      } else {
        // 非最后一步 → 保存并前进到下一步
        wx.showToast({ title: '已保存', icon: 'success' });
        this.setData({ activeTab: this.data.activeTab + 1 });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 内部提交方法
  async _submitForm() {
    const form = this.data.form;
    const submitData = {
      nickname: form.nickname,
      avatar: form.avatar,
      gender: form.gender,
      age: form.birthYear ? new Date().getFullYear() - parseInt(form.birthYear) : null,
      city: form.cityLabel,
      phone: form.phone,
      wechatAccount: form.wechatAccount,
      education: form.education,
      maritalStatus: form.maritalStatus,
      intro: form.intro,
      occupation: form.occupation,
      income: form.income,
      hasProperty: form.hasProperty === 'yes',
      hasCar: form.hasCar === 'yes',
      healthTags: form.healthTags,
      sleepHabit: form.sleepHabit,
      sportHabit: form.sportHabit,
      dietTags: form.dietTags,
      smoking: form.smoking,
      drinking: form.drinking,
      expectAgeMin: form.expectAgeMin,
      expectAgeMax: form.expectAgeMax,
      expectEducation: form.expectEducation,
      expectIncome: form.expectIncome,
      marriageExpect: form.marriageExpect,
      childrenAttitude: form.childrenAttitude,
      // 认证资料图片（上传后通过 setData 存储的 URL）
      idCardFrontImage: form.idCardFrontImage || '',
      idCardBackImage: form.idCardBackImage || '',
      // 资产证明图片（数组 → JSON字符串）
      propertyImages: JSON.stringify(form.propertyImages || []),
      vehicleImages: JSON.stringify(form.vehicleImages || []),
      bankDepositProof: form.bankDepositProof || '',
      insuranceProof: form.insuranceProof || '',
      financeProof: form.financeProof || '',
    };

    await request({
      url: '/v1/user/profile/update',
      method: 'PUT',
      data: submitData,
    });

    // 同步性别到本地缓存，供推荐官沙龙性别校验使用
    const currentInfo = authService.getUserInfo() || {};
    if (form.gender) currentInfo.gender = form.gender;
    authService.setUserInfo(currentInfo);

    authService.setHasProfile(true);
    clearDraft(this);
  },
});
