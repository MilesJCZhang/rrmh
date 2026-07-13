// pages/partner-apply/partner-apply.js
// 统一入驻申请页 — 支持 partner(联创推荐官) / community(社区服务站) / franchisee(城市合伙人) / professional(专业推荐官) 四种类型
const { ensureLogin } = require('../../utils/auth');
const { request } = require('../../utils/request');
const { Phase2API } = require('../../utils/phaseInterfaces');
const { payment, createPayment, PAYMENT_TYPES } = require('../../utils/payment');
const { getReferrerId, getReferrerInfo, getReferrerName } = require('../../utils/referral');
const { getFeesSync, fetchPublicConfig } = require('../../utils/commissionRules');
const authService = require('../../services/auth.service');

// 各角色对应的协议类型和名称
const ROLE_AGREEMENTS = {
  partner: { type: 'matchmaker_partner', name: '联创推荐官入驻协议' },
  franchisee: { type: 'franchisee', name: '城市合伙人入驻协议' },
  professional: { type: 'professional', name: '专业推荐官入驻协议' },
  community: { type: 'community', name: '社区服务站入驻协议' },
};

// 三种申请类型的配置（partner 为公益推荐官升级联创推荐官，需补充差异信息后支付）
const APPLY_CONFIG = {
  partner: {
    title: '联创推荐官',
    bannerEmoji: '👑',
    bannerDesc: '联创基金 ¥399 · 享沙龙补贴 + 全部权益',
    apiMethod: 'upgradeToPartner',
    needPayment: true,
    needReferrer: true,      // 必须由推荐官推荐注册
    paymentType: 'PARTNER_MATCHMAKER_UPGRADE',
    paymentAmount: 399,
    paymentDesc: '联创推荐官身份升级',
    // 公益推荐官已有：姓名/性别/年龄/手机号，只需补充以下差异字段
    fields: ['idNumber', 'wechat', 'experience', 'channel', 'bankAccount', 'bankName'],
    fieldLabels: {
      idNumber: '身份证号',
      wechat: '常用微信号',
      experience: '情感社交经验',
      channel: '推广渠道说明',
      bankAccount: '收款账号',
      bankName: '开户行',
    },
    fieldHints: {
      idNumber: '需完成实名认证，与收款账户信息一致',
      experience: '用于人工审核，如：从事社交活动策划X年、组织社交活动等（至少20个字）',
      channel: '您计划如何推广会员？如：社区活动、朋友圈、线下沙龙等（至少20个字）',
      bankAccount: '用于佣金提现',
      bankName: '如：中国工商银行、中国建设银行等',
    },
    benefits: [
      { icon: '✅', text: '公益推荐官全部权益' },
      { icon: '💰', text: '推荐建档：¥99/人（50%分成）' },
      { icon: '🎉', text: '名下会员沙龙补贴 ¥99/人次' },
      { icon: '👥', text: '推荐联创：第2个起 ¥399/人' },
      { icon: '🏘️', text: '推荐社区服务站（联创专属）：永久享沉淀资金10%' },
    ],
    note: '提现扣除13%平台服务费 · 联创基金¥399',
  },
  franchisee: {
    title: '城市合伙人',
    bannerEmoji: '🏙️',
    bannerDesc: '加盟费 ¥10000 · 城市运营 · 区域独享',
    apiMethod: 'applyCityFranchisee',
    needPayment: true,
    needReferrer: true,      // 必须由推荐官推荐注册
    paymentType: 'CITY_FRANCHISEE_JOIN',
    paymentAmount: 10000,
    paymentDesc: '城市合伙人加盟费',
    fields: ['companyName', 'contactName', 'phone', 'wechat', 'city', 'region', 'experience', 'plan', 'bankAccount'],
    fieldLabels: {
      companyName: '公司/个体名称',
      contactName: '负责人姓名',
      phone: '手机号',
      wechat: '微信号',
      city: '意向城市',
      region: '意向区域/商圈',
      experience: '相关行业经验',
      plan: '运营方案',
      bankAccount: '收款账户',
    },
    fieldHints: {
      experience: '请描述您在情感社交、社区服务、活动策划等相关行业的经验（至少20个字）',
      plan: '请描述城市运营方案，包括推广计划、团队规模、预期目标等（至少30个字）',
    },
    benefits: [
      { icon: '🏆', text: '区域独家运营权' },
      { icon: '👥', text: '发展推荐官团队和社区驿站' },
      { icon: '📊', text: '区域沉淀资金分成：70%' },
      { icon: '🎯', text: '承办沙龙（优惠期）票价¥299，到手¥200/人' },
      { icon: '💰', text: '承办沙龙（正价期）票价¥399，到手¥200/人' },
    ],
    note: '加盟费 ¥10000 · 沉淀资金70%净额 · 其他收益提现扣13%服务费',
  },
  professional: {
    title: '专业推荐官',
    bannerEmoji: '💎',
    bannerDesc: '升级费 ¥3999 · 全业务推荐收益',
    apiMethod: 'upgradeToProfessional',
    needPayment: true,
    needReferrer: true,      // 必须由推荐官推荐注册
    paymentType: 'PROFESSIONAL_UPGRADE',
    paymentAmount: 3999,
    paymentDesc: '专业推荐官升级费',
    fields: ['realName', 'gender', 'age', 'phone', 'wechat', 'idNumber', 'experience', 'certification', 'channel'],
    fieldLabels: {
      realName: '真实姓名',
      gender: '性别',
      age: '年龄',
      phone: '手机号',
      wechat: '微信号',
      idNumber: '身份证号',
      experience: '情感社交经验',
      certification: '相关资质/证书',
      channel: '推广渠道',
    },
    fieldHints: {
      experience: '请详细描述情感社交行业从业经验，如从业年限、服务客户数、成功案例等（至少30个字）',
      certification: '如有心理咨询师、婚姻家庭咨询师等证书请填写，无则填"无"',
      channel: '请描述您的推广渠道和资源，如社区合作、企业合作、线上运营等（至少20个字）',
    },
    benefits: [
      { icon: '💰', text: '推荐建档：¥99/人（50%分成）' },
      { icon: '💎', text: '推荐公益推荐官：名下会员参加沙龙¥99/次' },
      { icon: '👑', text: '推荐联创：第2个起¥399/人' },
      { icon: '🏙️', text: '推荐城市合伙人：第2个起¥10000/人 + 永久3%沉淀资金分红' },
    ],
    note: '升级费 ¥3999 · 所有身份均可升级',
  },
  community: {
    title: '社区服务站',
    bannerEmoji: '🌿',
    bannerDesc: '免费入驻申请 · 深耕本地社区',
    apiMethod: 'applyCommunityPartner',
    needPayment: false,    // 注册审核制，无需缴费
    needReferrer: true,     // 必须有联创推荐官推荐
    // 单位类型、名称、地址、负责人、联系电话（必填）、微信号（选填）、
    // 单位简介（选填）、收款银行账户
    fields: ['orgType', 'orgName', 'address', 'contactPerson', 'phone', 'wechat', 'orgDescription', 'bankAccount', 'bankName'],
    fieldLabels: {
      orgType: '单位类型',
      orgName: '单位名称',
      address: '单位地址',
      contactPerson: '负责人',
      phone: '联系电话',
      wechat: '微信号',
      orgDescription: '单位简介',
      bankAccount: '收款账号',
      bankName: '开户行',
    },
    fieldHints: {
      orgName: '请填写营业执照或登记证书上的单位全称',
      address: '请填写单位详细地址，精确到街道/门牌号',
      orgDescription: '请简要介绍单位主营业务或服务内容（选填）',
      bankAccount: '用于接收结算款项，请确保账户信息准确',
      bankName: '如：中国工商银行深圳华强支行',
    },
    // 不显示建档费、沉淀资金等费用信息，只保留审核说明
    benefits: [
      { icon: '🌱', text: '免费入驻，无任何费用' },
      { icon: '📋', text: '深耕本地社区，提供便民服务' },
    ],
    note: '审核周期 1-3 个工作日',
  },
};

// 表单数据映射（从 data 取值的 key → 发送给后端的 key）
const DATA_TO_API_KEY = {
  // community
  orgType: 'org_type',
  orgName: 'org_name',
  address: 'address',
  contactPerson: 'contact_person',
  // community / professional 共用
  realName: 'real_name',
  gender: 'gender',
  age: 'age',
  phone: 'phone',
  wechat: 'wechat',
  experience: 'experience',
  // franchisee
  companyName: 'company_name',
  city: 'city',
  // partner
  idNumber: 'id_number',
  certification: 'certification',
  channel: 'channel',
  // community / partner / franchisee 收款账户
  bankAccount: 'bank_account',
  bankName: 'bank_name',
};

Page({
  data: {
    // 申请类型: station | franchisee | professional | community
    applyType: 'station',
    config: null,

    // 通用表单字段
    formData: {},

    // 性别选择器
    genderOptions: ['女', '男'],
    genderIndex: -1,

    // 机构类型选择器（社区服务站专用）
    orgTypeOptions: ['社区', '团体', '事业单位'],
    orgTypeIndex: -1,

    // 状态
    submitting: false,
    agreed: false,

    // 当前角色协议
    agreementType: '',
    agreementName: '',

    // 联创推荐官信息（社区服务站申请专用）
    partnerReferrer: null,   // { id, name, role }
    partnerNameLoading: false, // 推荐官姓名加载中
    noReferrerHint: false,    // 无推荐人时显示提示
  },

  onLoad(options) {
    const type = options.type || 'community';
    const config = APPLY_CONFIG[type];
    if (!config) {
      wx.showToast({ title: '申请类型无效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 初始化表单数据
    const formData = {};
    config.fields.forEach((f) => { formData[f] = ''; });
    // 机构类型默认值（社区服务站）
    if (type === 'community') {
      formData.orgType = '社区';
      formData.orgDescription = '';
      formData.wechat = '';
    }

    // 需要推荐官推荐的申请：必须携带推荐人信息
    let partnerReferrer = null;
    let noReferrerHint = false;
    if (config.needReferrer) {
      const referrerId = getReferrerId();
      const referrerInfo = getReferrerInfo();
      if (referrerId) {
        // 优先使用已存储的推荐官信息，若无名字则异步拉取真实姓名
        if (referrerInfo && referrerInfo.name) {
          partnerReferrer = {
            id: referrerId,
            name: referrerInfo.name,
            role: referrerInfo.role || '',
          };
        } else {
          // 本地无名字，调后端接口获取真实姓名
          partnerReferrer = { id: referrerId, name: '', role: '' };
          this._loadPartnerName(referrerId);
        }
      } else {
        noReferrerHint = true;
      }
    }

    this.setData({
      applyType: type,
      config,
      agreementType: ROLE_AGREEMENTS[type] ? ROLE_AGREEMENTS[type].type : 'platform',
      agreementName: ROLE_AGREEMENTS[type] ? ROLE_AGREEMENTS[type].name : '平台入驻协议',
      formData,
      partnerReferrer,
      noReferrerHint,
    });

    wx.setNavigationBarTitle({ title: config.title + '申请' });

    // 异步加载最新配置，并更新支付金额
    this._refreshConfigAmounts(type);
  },

  /**
   * 从后端获取最新配置，动态更新支付金额
   */
  async _refreshConfigAmounts(type) {
    try {
      const config = await fetchPublicConfig();
      if (!config) return;

      // 根据类型动态更新支付金额
      const feeKeyMap = {
        partner: { key: 'partner_matchmaker_join_fee', defaultVal: 399 },
        franchisee: { key: 'city_franchisee_join_fee', defaultVal: 10000 },
        professional: { key: 'professional_recommender_upgrade_fee', defaultVal: 3999 },
        community: null,  // 免费，无需更新
      };

      const feeInfo = feeKeyMap[type];
      if (!feeInfo) return;

      const amount = parseFloat(config[feeInfo.key]) || feeInfo.defaultVal;

      // 更新当前 config 对象中的 paymentAmount
      const currentConfig = this.data.config;
      if (currentConfig && currentConfig.paymentAmount !== amount) {
        this.setData({
          'config.paymentAmount': amount,
          'config.bannerDesc': this._buildBannerDesc(type, amount, config),
        });
      }
    } catch (e) {
      // 静默失败，使用默认值
      console.warn('[partner-apply] 动态配置加载失败:', e);
    }
  },

  /**
   * 根据类型和费用配置构建 bannerDesc
   */
  _buildBannerDesc(type, amount, config) {
    const feeRate = parseFloat(config.platform_withdraw_fee_rate) || 0.13;
    const franchiseeRate = parseFloat(config.city_franchisee_withdrawal_rate) || 0.70;
    switch (type) {
      case 'partner':
        return `联创基金 ¥${amount} · 享沙龙补贴 + 全部权益`;
      case 'franchisee':
        return `加盟费 ¥${amount} · 城市运营 · 区域独享`;
      case 'professional':
        return `升级费 ¥${amount} · 全业务推荐收益`;
      default:
        return this.data.config.bannerDesc;
    }
  },

  // ===== 表单输入 =====

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onGenderPick(e) {
    const idx = e.detail.value;
    this.setData({
      genderIndex: idx,
      'formData.gender': this.data.genderOptions[idx],
    });
  },

  onOrgTypePick(e) {
    const idx = e.detail.value;
    this.setData({
      orgTypeIndex: idx,
      'formData.orgType': this.data.orgTypeOptions[idx],
    });
  },

  onAgreeChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },

  onViewAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type });
  },

  // ===== 校验 =====

  _validate() {
    const { config, formData, partnerReferrer, noReferrerHint } = this.data;

    // 需要推荐官推荐的申请：必须携带推荐人
    if (config.needReferrer && noReferrerHint) {
      return `${config.title}申请需由推荐官推荐，请通过推荐官分享的链接进入`;
    }

    for (const field of config.fields) {
      const val = (formData[field] || '').trim();
      const label = config.fieldLabels[field];

      // 以下字段可选填
      if (field === 'gender' && !val) return `请选择${label}`;
      if (field === 'bankAccount') continue;  // 收款账户选填
      if (field === 'bankName') continue;     // 开户行选填
      if (field === 'wechat') continue;       // 微信号选填
      if (field === 'orgDescription') continue; // 单位简介选填

      if (!val) return `请填写${label}`;

      if (field === 'phone' && !/^1[3-9]\d{9}$/.test(val)) return '请输入有效的手机号';
      if (field === 'age' && (parseInt(val) < 18 || parseInt(val) > 80)) return '请输入有效年龄（18-80）';
      if (field === 'idNumber' && !/^\d{17}[\dXx]$/.test(val)) return '请输入有效的18位身份证号';
      if (field === 'plan' && val.length < 20) return '运营计划至少20个字';
      if (field === 'experience' && val.length < 20) return '从业经验至少20个字';
    }
    if (!this.data.agreed) return '请先阅读并同意用户协议';
    return null;
  },

  // ===== 提交 =====

  async onSubmit() {
    const errMsg = this._validate();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }

    try { await ensureLogin(); } catch (e) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      // 组装 API 参数
      const { config, formData, partnerReferrer } = this.data;
      const apiData = {};
      config.fields.forEach((field) => {
        const apikey = DATA_TO_API_KEY[field] || field;
        apiData[apikey] = (formData[field] || '').trim();
      });

      // 社区服务站申请：附加推荐官ID
      if (config.needReferrer && partnerReferrer) {
        apiData.referrer_id = partnerReferrer.id || getReferrerId();
      }

      await Phase2API[config.apiMethod](apiData);

      wx.hideLoading();
      this.setData({ submitting: false });

      // 联创推荐官：提交后拉起支付
      if (config.needPayment) {
        this._doUpgradePayment(config);
        return;
      }

      // ★ 获取最新角色和推荐码（免费申请成功后应已生成）
      const roleInfo = await this._fetchRoleAndCode();
      wx.showModal({
        title: '🎉 申请成功',
        content: roleInfo?.recommendCode
          ? `您已成为「${config.title}」\n您的推荐码：${roleInfo.recommendCode}\n快去分享给好友吧！`
          : `${config.title}申请已成功提交，我们将在1-3个工作日内审核。`,
        confirmText: roleInfo?.recommendCode ? '查看推广码' : '我知道了',
        confirmColor: '#C8102E',
        success: (modalRes) => {
          if (modalRes.confirm && roleInfo?.recommendCode) {
            wx.redirectTo({ url: '/pages/matchmaker/qrcode' });
          } else {
            wx.navigateBack();
          }
        },
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: e.message || '提交失败，请重试', icon: 'none' });
    }
  },

  /**
   * 升级支付（联创/驿站/合伙人/推荐官通用）
   * 支付成功后获取推荐码并弹窗展示
   */
  async _doUpgradePayment(config) {
    try {
      const result = await createPayment({
        type: PAYMENT_TYPES[config.paymentType] || PAYMENT_TYPES.PARTNER_MATCHMAKER_UPGRADE,
        description: config.paymentDesc,
        amount: config.paymentAmount,
        extra: {},
      });
      if (result.success) {
        // ★ 获取最新角色和推荐码
        const roleInfo = await this._fetchRoleAndCode();
        wx.showModal({
          title: '🎉 升级成功',
          content: roleInfo?.recommendCode
            ? `您已成为「${config.title}」\n推荐码：${roleInfo.recommendCode}\n分享推荐码，开始赚取佣金！`
            : `${config.title}费用已支付，我们将尽快审核，请留意微信通知。`,
          confirmText: roleInfo?.recommendCode ? '查看推广码' : '我知道了',
          confirmColor: '#C8102E',
          success: (modalRes) => {
            if (modalRes.confirm && roleInfo?.recommendCode) {
              wx.redirectTo({ url: '/pages/matchmaker/qrcode' });
            } else {
              wx.navigateBack();
            }
          },
        });
      } else if (result.reason === 'cancelled') {
        wx.showModal({
          title: '支付未完成',
          content: '您的申请已提交，可稍后在申请页面完成支付。',
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#C8102E',
          success: () => {
            wx.navigateBack();
          },
        });
      }
    } catch (e) {
      wx.showModal({
        title: '支付遇到问题',
        content: '您的申请已提交，请稍后重试支付。' + (e.message ? '（' + e.message + '）' : ''),
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#C8102E',
        success: () => {
          wx.navigateBack();
        },
      });
    }
  },

  /**
   * 异步加载联创推荐官真实姓名（社区服务站申请页专用）
   */
  _loadPartnerName(referrerId) {
    this.setData({ partnerNameLoading: true });
    request({
      url: `/user/${referrerId}/avatar-info`,
      withToken: false,
    }).then((data) => {
      const name = data.name || data.nickname || '联创推荐官';
      this.setData({
        'partnerReferrer.name': name,
        partnerNameLoading: false,
      });
    }).catch(() => {
      this.setData({
        'partnerReferrer.name': '联创推荐官',
        partnerNameLoading: false,
      });
    });
  },

  /**
   * 获取用户最新角色和推荐码，更新本地状态
   */
  async _fetchRoleAndCode() {
    try {
      const API = require('../../services/api');
      const resp = await request({
        url: API.APPLY.STATUS || '/v1/apply/status',
        method: 'GET',
      });
      const data = resp.data || resp;
      if (data && data.role) {
        authService.setUserRole(data.role);
        const userInfo = authService.getUserInfo() || {};
        userInfo.role = data.role;
        userInfo.recommendCode = data.recommendCode || userInfo.recommendCode;
        authService.setUserInfo(userInfo);
        const app = getApp();
        if (app) app.globalData.userRole = data.role;
        return { role: data.role, recommendCode: data.recommendCode || '' };
      }
    } catch (e) {
      console.warn('[partner-apply] 获取角色信息失败:', e.message);
    }
    return null;
  },

  onBack() {
    wx.navigateBack();
  },
});
