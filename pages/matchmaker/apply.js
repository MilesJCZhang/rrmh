// pages/matchmaker/apply.js - 推荐官注册申请
// 支持公益推荐官（免费）和联创推荐官（399元）两条注册路径
// 公益推荐官收益：进群月费¥99全额、一对一¥99/次、AI陪伴¥99/人
const { ensureLogin } = require('../../utils/auth');
const { request } = require('../../utils/request');
const API = require('../../services/api');
const { USER_ROLES, getFeesSync, getCommissionRules } = require('../../utils/commissionRules');
const { createPayment, PAYMENT_TYPES } = require('../../utils/payment');
const authService = require('../../services/auth.service');

Page({
  data: {
    // 注册类型: public | partner
    applyType: 'public',

    // ===== 公益推荐官表单 =====
    // Step 1: 基础身份
    realName: '',
    gender: '',
    genderOptions: ['女', '男'],
    genderIndex: -1,
    age: '',
    // Step 2: 联系方式
    phone: '',

    // ===== 联创推荐官额外字段 =====
    // Step 1: 完整身份（含身份证号）
    idNumber: '',
    // Step 2: 联系方式（含微信）
    wechat: '',
    // Step 3: 从业资料（标签多选 + 补充文本）
    experienceTags: [
      { id: 'e1', label: '社区活动策划', checked: false },
      { id: 'e2', label: '组织过交友活动', checked: false },
      { id: 'e3', label: '志愿者服务经历', checked: false },
      { id: 'e4', label: '从事过教育/培训', checked: false },
      { id: 'e5', label: '销售/服务行业经验', checked: false },
      { id: 'e6', label: '热爱社交、人脉广', checked: false },
    ],
    experienceExtra: '',   // 其他补充
    channelTags: [
      { id: 'c1', label: '朋友圈转发', checked: false },
      { id: 'c2', label: '线下沙龙活动', checked: false },
      { id: 'c3', label: '社区/小区推广', checked: false },
      { id: 'c4', label: '微信群/私域运营', checked: false },
      { id: 'c5', label: '短视频/直播推广', checked: false },
      { id: 'c6', label: '亲友口碑推荐', checked: false },
    ],
    channelExtra: '',      // 其他补充
    // Step 4: 收款账户
    payType: '',
    payTypeOptions: ['微信零钱', '银行卡'],
    payTypeIndex: -1,
    bankAccount: '',     // 微信:openid / 银行卡:卡号
    bankName: '',        // 银行名（仅银行卡时）

    // 状态
    submitting: false,
    agreed: false,
  },

  onLoad(options) {
    const type = options.type || 'public';
    this.setData({ applyType: type });
    wx.setNavigationBarTitle({
      title: type === 'partner' ? '联创推荐官注册' : '公益推荐官注册',
    });
  },

  // ===== 表单输入 =====

  onNameInput(e) { this.setData({ realName: e.detail.value }); },
  onAgeInput(e) { this.setData({ age: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onIdNumberInput(e) { this.setData({ idNumber: e.detail.value }); },
  onWechatInput(e) { this.setData({ wechat: e.detail.value }); },

  // 社交活动经验标签切换
  onToggleExpTag(e) {
    const id = e.currentTarget.dataset.id;
    const tags = this.data.experienceTags.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    this.setData({ experienceTags: tags });
  },
  onExperienceExtraInput(e) { this.setData({ experienceExtra: e.detail.value }); },

  // 推广渠道标签切换
  onToggleChannelTag(e) {
    const id = e.currentTarget.dataset.id;
    const tags = this.data.channelTags.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    this.setData({ channelTags: tags });
  },
  onChannelExtraInput(e) { this.setData({ channelExtra: e.detail.value }); },

  // 拼合最终提交值
  _buildExperience() {
    const selected = this.data.experienceTags.filter(t => t.checked).map(t => t.label);
    const extra = this.data.experienceExtra.trim();
    return [...selected, ...(extra ? [extra] : [])].join('、');
  },
  _buildChannel() {
    const selected = this.data.channelTags.filter(t => t.checked).map(t => t.label);
    const extra = this.data.channelExtra.trim();
    return [...selected, ...(extra ? [extra] : [])].join('、');
  },

  onBankAccountInput(e) { this.setData({ bankAccount: e.detail.value }); },
  onBankNameInput(e) { this.setData({ bankName: e.detail.value }); },

  onGenderPick(e) { this.setData({ genderIndex: e.detail.value, gender: this.data.genderOptions[e.detail.value] }); },
  onPayTypePick(e) { this.setData({ payTypeIndex: e.detail.value, payType: this.data.payTypeOptions[e.detail.value] }); },

  onAgreeChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },

  onViewAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type });
  },

  // ===== 校验 =====

  _validatePublic() {
    const { realName, gender, age, phone, agreed } = this.data;
    if (!realName || realName.trim().length < 2) return '请输入真实姓名（至少2个字）';
    if (!gender) return '请选择性别';
    if (!age || parseInt(age) < 18 || parseInt(age) > 80) return '请输入有效年龄（18-80）';
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return '请输入有效的手机号';
    if (!agreed) return '请先阅读并同意用户协议';
    return null;
  },

  _validatePartner() {
    const err = this._validatePublic();
    if (err) return err;
    // 联创推荐官额外校验：选填字段不再强制
    return null;
  },

  // ===== 提交 =====

  async onSubmit() {
    const isPartner = this.data.applyType === 'partner';
    const errMsg = isPartner ? this._validatePartner() : this._validatePublic();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }

    try { await ensureLogin(); } catch (e) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (isPartner) {
      // 联创推荐官：先提交资料审核，审核通过后再支付399元
      this._submitPartnerApply();
    } else {
      // 公益推荐官：免费提交，自动审核通过
      this._submitPublicApply();
    }
  },

  /**
   * 公益推荐官申请 — 免费，提交后自动审核通过
   */
  async _submitPublicApply() {
    this.setData({ submitting: true });
    try {
      const data = await request({
        url: API.APPLY.PUBLIC_MATCHMAKER,
        method: 'POST',
        data: {
          target_role: USER_ROLES.PUBLIC_MATCHMAKER,
          real_name: this.data.realName.trim(),
          gender: this.data.gender,
          age: parseInt(this.data.age),
          phone: this.data.phone.trim(),
        },
      });
      // 更新本地用户状态（推荐码 + 角色）
      // request() 返回 body.data，即 { role, recommendCode }
      if (data && data.role) {
        authService.setUserInfo({
          role: data.role,
          recommendCode: data.recommendCode,
        });
        authService.setUserRole(data.role);
      }

      wx.showToast({ title: '申请成功，已自动通过审核', icon: 'success' });

      // 返回上一页（实名认证留到提现环节）
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e) {
      this.setData({ submitting: false });
      const msg = e && e.message ? e.message : (e && e.code === 401 ? '请先登录' : '申请失败，请重试');
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  /**
   * 联创推荐官申请 — 提交资料审核 + 支付399元运营基金
   */
  async _submitPartnerApply() {
    this.setData({ submitting: true });
    try {
      // 第一步：提交申请（后端只需要 userId，从 token 中获取）
      await request({
        url: API.APPLY.PARTNER_MATCHMAKER,
        method: 'POST',
      });

      this.setData({ submitting: false });

      // 第二步：引导支付399元运营基金
      wx.showModal({
        title: '资料已提交',
        content: '您的联创推荐官资料已提交审核，审核通过后需缴纳399元运营基金。是否立即支付？',
        confirmText: '立即支付',
        confirmColor: '#C8102E',
        success: async (modalRes) => {
          if (!modalRes.confirm) {
            wx.showToast({ title: '可稍后在社交中心支付', icon: 'none' });
            setTimeout(() => { wx.navigateBack(); }, 1500);
            return;
          }

          try {
            wx.showLoading({ title: '发起支付...' });
            const result = await createPayment({
              type: PAYMENT_TYPES.PARTNER_MATCHMAKER_UPGRADE,
              description: '联创推荐官基金',
              amount: getFeesSync().PARTNER_MATCHMAKER_JOIN,
              extra: { target_role: USER_ROLES.PARTNER_MATCHMAKER },
            });
            wx.hideLoading();

            if (result.success) {
              wx.showToast({ title: '支付成功，等待审核', icon: 'success' });

              // 支付成功：更新本地状态（角色升级为联创推荐官）
              try {
                // 先尝试从后端获取最新用户信息
                // request() 返回 body.data，即用户信息对象
                const userData = await request({ url: API.USER.PROFILE });
                if (userData) {
                  authService.setUserInfo(userData);
                  authService.setUserRole(userData.role || 'partner_matchmaker');
                } else {
                  authService.setUserRole('partner_matchmaker');
                }
              } catch (e) {
                console.error('[apply] 获取用户信息失败，使用本地更新:', e);
                authService.setUserRole('partner_matchmaker');
              }

              // 跳转实名认证（深度认证：身份证核验）
              setTimeout(() => {
                wx.redirectTo({ url: '/subpackages/user/pages/verify/verify?from=partner_apply' });
              }, 1500);
            } else if (result.reason === 'cancelled') {
              wx.showToast({ title: '已取消，可稍后支付', icon: 'none' });
              setTimeout(() => { wx.navigateBack(); }, 1500);
            }
          } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: e && e.message ? e.message : '支付失败', icon: 'none' });
          }
        },
      });
    } catch (e) {
      this.setData({ submitting: false });
      const msg = e && e.message ? e.message : (e && e.code === 401 ? '请先登录' : '申请失败，请重试');
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  // ===== 辅助 =====

  // ===== 切换注册类型 =====
  onSwitchType() {
    const target = this.data.applyType === 'public' ? 'partner' : 'public';
    // 重新加载页面（清除表单数据）
    wx.redirectTo({
      url: `/subpackages/matchmaker/pages/matchmaker/apply?type=${target}`,
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
