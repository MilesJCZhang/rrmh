// pages/salon/salon.js - 沙龙创建/管理页面
const salonService = require('../../../../services/salon.service');
const authService = require('../../../../services/auth.service');
const { DEV_MODE } = require('../../../../utils/config');
const { checkTextSafety, serverCheckText } = require('../../../../utils/contentModeration');

Page({
  data: {
    // 身份验证
    isCityFranchisee: false,
    userRole: '',

    // 模式切换
    mode: 'list', // list, create, detail

    // 沙龙详情
    salonDetail: null,
    isJoined: false,
    joinLoading: false,

    // 沙龙列表
    salons: [],
    loading: false,

    // 模板列表
    templates: [],
    selectedTemplateId: null,

    // 创建表单
    formData: {
      name: '',
      description: '',
      cover: '',
      date: '',
      time: '14:00',
      location: '',
      city: '',
      max_participants: 30,
      fee: 299,
      process: [],
      notices: [],
      template_id: null,
      safetyAcknowledged: false,
    },

    // 安全须知弹窗
    safetyModalVisible: false,

    // 流程编辑
    processModalVisible: false,
    currentProcessIndex: -1,
    processForm: { time: '', title: '', description: '' },

    // 注意事项编辑
    noticeModalVisible: false,
    noticeInput: '',

    // 城市列表
    cities: ['深圳', '广州', '上海', '北京', '成都', '杭州', '武汉', '西安', '南京', '重庆'],
    showCityPicker: false,
    showHomeBack: false,
  },

  onLoad(options) {
    // DEV_MODE 下强制显示创建入口
    const isDev = DEV_MODE;
    const pages = getCurrentPages();
    this.setData({
      isCityFranchisee: isDev || false,
      showHomeBack: pages.length <= 1,
    });

    // 检查 URL 参数
    if (options.mode === 'create') {
      this.setData({ mode: 'create' });
      this.loadTemplates();
    } else if (options.id) {
      this.loadSalonDetail(options.id);
    } else {
      this.loadSalons();
    }
  },

  onShow() {
    // 使用 authService 检查用户角色
    const userInfo = authService.getUserInfo() || {};
    const isCityFranchisee = userInfo.role === 'city_franchisee' || DEV_MODE;
    this.setData({
      isCityFranchisee,
      userRole: userInfo.role || '',
    });
  },

  // ============ 沙龙列表 ============
  loadSalons() {
    this.setData({ loading: true });
    salonService.getSalonList().then(res => {
      this.setData({
        salons: res.list || [],
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onRefreshSalons() {
    this.loadSalons();
  },

  // ============ 沙龙详情 ============
  loadSalonDetail(id) {
    this.setData({ loading: true });
    salonService.getSalonDetail(id).then(res => {
      const detail = res.data || res;
      this.setData({
        salonDetail: detail,
        loading: false,
        mode: 'detail',
      });
      // 检查报名状态
      this.checkJoinStatus(id);
    }).catch(err => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
      console.error('[loadSalonDetail]', err);
    });
  },

  checkJoinStatus(salonId) {
    salonService.getMySalons().then(res => {
      const list = res.data || res.list || res || [];
      const joined = Array.isArray(list) && list.some(s => s.id == salonId || (s.salon && s.salon.id == salonId));
      this.setData({ isJoined: joined });
    }).catch(() => {});
  },

  onJoinSalon() {
    const { salonDetail, isJoined, joinLoading } = this.data;
    if (!salonDetail || joinLoading) return;
    if (isJoined) {
      wx.showToast({ title: '您已报名', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认报名',
      content: `确认报名参加「${salonDetail.name || salonDetail.title}」？`,
      success: (res) => {
        if (res.confirm) {
          this.setData({ joinLoading: true });
          wx.showLoading({ title: '报名中...' });
          salonService.joinSalon(salonDetail.id).then(() => {
            wx.hideLoading();
            this.setData({ isJoined: true, joinLoading: false });
            wx.showToast({ title: '报名成功', icon: 'success' });
          }).catch(err => {
            wx.hideLoading();
            this.setData({ joinLoading: false });
            wx.showToast({ title: err.message || '报名失败', icon: 'none' });
            console.error('[onJoinSalon]', err);
          });
        }
      }
    });
  },

  // ============ 模板选择 ============
  loadTemplates() {
    salonService.getTemplateList().then(res => {
      const templates = res.list || [];
      this.setData({ templates });
      
      // 如果已有默认模板，应用它
      const { formData, selectedTemplateId } = this.data;
      if (selectedTemplateId) {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template) {
          this.applyTemplate(template);
        }
      }
    });
  },

  onSelectTemplate(e) {
    const templateId = e.currentTarget.dataset.id;
    const template = this.data.templates.find(t => t.id === templateId);
    if (template) {
      this.setData({ selectedTemplateId: templateId });
      this.applyTemplate(template);
    }
  },

  applyTemplate(template) {
    const { formData } = this.data;
    this.setData({
      formData: {
        ...formData,
        template_id: template.id,
        fee: template.default_fee,
        max_participants: template.default_max_count,
        process: [...(template.process || [])],
        notices: [...(template.notices || [])],
      },
    });
  },

  // ============ 表单字段更新 ============
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  onNumberInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = parseInt(e.detail.value) || 0;
    this.setData({
      [`formData.${field}`]: value,
    });
  },

  onCitySelect(e) {
    const city = this.data.cities[e.detail.value];
    this.setData({
      [`formData.city`]: city,
      showCityPicker: false,
    });
  },

  showCitySelector() {
    this.setData({ showCityPicker: true });
  },

  hideCitySelector() {
    this.setData({ showCityPicker: false });
  },

  // ============ 流程编辑 ============
  showProcessModal() {
    this.setData({
      processModalVisible: true,
      currentProcessIndex: -1,
      processForm: { time: '', title: '', description: '' },
    });
  },

  editProcess(e) {
    const index = e.currentTarget.dataset.index;
    const process = this.data.formData.process[index];
    this.setData({
      processModalVisible: true,
      currentProcessIndex: index,
      processForm: { ...process },
    });
  },

  onProcessInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`processForm.${field}`]: e.detail.value,
    });
  },

  saveProcess() {
    const { processForm, currentProcessIndex, formData } = this.data;
    const process = [...formData.process];
    
    if (currentProcessIndex >= 0) {
      process[currentProcessIndex] = { ...processForm };
    } else {
      process.push({ ...processForm });
    }

    this.setData({
      [`formData.process`]: process,
      processModalVisible: false,
    });
  },

  deleteProcess(e) {
    const index = e.currentTarget.dataset.index;
    const process = [...this.data.formData.process];
    process.splice(index, 1);
    this.setData({
      [`formData.process`]: process,
    });
  },

  // ============ 注意事项编辑 ============
  showNoticeModal() {
    this.setData({
      noticeModalVisible: true,
      noticeInput: '',
    });
  },

  onNoticeInput(e) {
    this.setData({ noticeInput: e.detail.value });
  },

  addNotice() {
    const { noticeInput, formData } = this.data;
    if (noticeInput.trim()) {
      const notices = [...formData.notices, noticeInput.trim()];
      this.setData({
        [`formData.notices`]: notices,
        noticeInput: '',
        noticeModalVisible: false,
      });
    }
  },

  deleteNotice(e) {
    const index = e.currentTarget.dataset.index;
    const notices = [...this.data.formData.notices];
    notices.splice(index, 1);
    this.setData({
      [`formData.notices`]: notices,
    });
  },

  // ============ 创建沙龙 ============
  validateForm() {
    const { formData } = this.data;
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入活动名称', icon: 'none' });
      return false;
    }
    if (!formData.description.trim()) {
      wx.showToast({ title: '请输入活动描述', icon: 'none' });
      return false;
    }
    if (!formData.date) {
      wx.showToast({ title: '请选择活动日期', icon: 'none' });
      return false;
    }
    if (!formData.time) {
      wx.showToast({ title: '请选择活动开始时间', icon: 'none' });
      return false;
    }
    if (!formData.location.trim()) {
      wx.showToast({ title: '请输入活动地点', icon: 'none' });
      return false;
    }
    if (!formData.city) {
      wx.showToast({ title: '请选择城市', icon: 'none' });
      return false;
    }
    if (formData.max_participants < 2) {
      wx.showToast({ title: '名额至少2人', icon: 'none' });
      return false;
    }
    if (!formData.safetyAcknowledged) {
      wx.showToast({ title: '请先阅读并同意安全须知', icon: 'none' });
      return false;
    }
    return true;
  },

  async onSubmitSalon() {
    if (!this.validateForm()) return;

    // ── 内容安全审核 ──
    const { formData } = this.data;
    const textFields = [
      { value: formData.name, label: '活动名称' },
      { value: formData.description, label: '活动描述' },
      { value: formData.location, label: '活动地点' },
    ];

    // Step1: 客户端本地敏感词预检
    for (const field of textFields) {
      if (field.value) {
        const check = checkTextSafety(field.value);
        if (!check.safe) {
          wx.showToast({ title: `${field.label}包含不适当内容，请修改`, icon: 'none' });
          return;
        }
      }
    }

    // Step2: 服务端微信内容安全检测（场景4：社交日志/活动）
    if (formData.description) {
      const serverResult = await serverCheckText(formData.description, 4);
      if (!serverResult.safe) {
        wx.showToast({ title: '活动描述包含不适当内容，请修改后重试', icon: 'none' });
        return;
      }
    }

    // 字段映射：前端字段名 → 服务端字段名
    const fd = this.data.formData;
    // startTime: 组装为本地时间 ISO 格式（服务端 new Date() 可直接解析）
    let startTime = undefined;
    if (fd.date && fd.time) {
      const dt = new Date(fd.date + 'T' + fd.time);
      // 转为 YYYY-MM-DDTHH:mm:ss 格式（本地时间，无 Z）
      const pad = n => String(n).padStart(2, '0');
      startTime = dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' +
        pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    }
    const payload = {
      title: fd.name,
      description: fd.description,
      location: fd.location,
      startTime: startTime,
      maxParticipants: fd.max_participants,
      registrationFee: fd.fee,
      ...(fd.cover ? { coverImage: fd.cover } : {}),
      requirements: '',
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    console.log('[onSubmitSalon] payload:', JSON.stringify(payload));
    wx.showLoading({ title: '创建中...' });

    salonService.createSalon(payload).then(res => {
      wx.hideLoading();
      wx.showToast({ title: res.message || '创建成功', icon: 'success' });
      
      // 延迟返回
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      wx.hideLoading();
      console.error('[onSubmitSalon] 完整错误:', JSON.stringify(err, null, 2));
      const errMsg = err.message || '创建失败';
      const errDetail = err.errors ? ': ' + JSON.stringify(err.errors) : '';
      wx.showToast({
        title: errMsg.length > 30 ? errMsg.substring(0, 30) + '...' : errMsg,
        icon: 'none'
      });
      // 同时在控制台打印详细错误，方便调试
      if (err.errors) console.error('[onSubmitSalon] 验证错误详情:', err.errors);
    });
  },

  // ============ 模式切换 ============
  switchToList() {
    this.setData({ mode: 'list' });
    this.loadSalons();
  },

  switchToCreate() {
    this.setData({
      mode: 'create',
      selectedTemplateId: null,
      formData: {
        name: '',
        description: '',
        cover: '',
        date: '',
        time: '14:00',
        location: '',
        city: '',
        max_participants: 30,
        fee: 299,
        process: [],
        notices: [],
        template_id: null,
        safetyAcknowledged: false,
      },
    });
    this.loadTemplates();
  },

  // ============ 安全须知 ============
  showSafetyModal() {
    this.setData({ safetyModalVisible: true });
  },

  hideSafetyModal() {
    this.setData({ safetyModalVisible: false });
  },

  onSafetyAcknowledge() {
    this.setData({
      ['formData.safetyAcknowledged']: true,
      safetyModalVisible: false,
    });
  },

  // ============ 页面跳转 ============
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  goToSalonDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/subpackages/social/pages/salon/salon?id=${id}` });
  },
});
