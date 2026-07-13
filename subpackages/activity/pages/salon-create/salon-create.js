// subpackages/activity/pages/salon-create/salon-create.js
const authService = require('../../../../services/auth.service');
const salonService = require('../../../../services/salon.service');
const { uploadFile } = require('../../../../utils/request');

Page({
  data: {
    salonType: '',        // male_salon / female_salon（锁定，不可编辑）
    typeLabel: '',        // 男推荐官沙龙 / 女推荐官沙龙
    themeColor: '#C8102E',
    themeGradient: 'linear-gradient(135deg, #C8102E, #E8454A)',

    // 表单字段
    title: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    maxParticipants: 6,
    maxPerGender: 3,
    registrationFee: 399,
    coverImage: '',
    coverImageTempPath: '',

    // 3男3女分组配置
    isGrouped: true,
    allowedTiers: ['gold', 'silver', 'bronze'],
    tierOptions: [
      { key: 'gold', label: '优质(80+)', checked: true },
      { key: 'silver', label: '良好(60-79)', checked: true },
      { key: 'bronze', label: '基础(<60)', checked: true },
    ],

    // 日期时间选择器
    startDate: '',
    startTimeVal: '',
    endDate: '',
    endTimeVal: '',
    minDate: '',

    submitting: false,
  },

  onLoad(options) {
    const salonType = options.type || '';
    let typeLabel = '沙龙';
    let themeColor = '#C8102E';
    let themeGradient = 'linear-gradient(135deg, #C8102E, #E8454A)';

    if (salonType === 'male_salon') {
      typeLabel = '男推荐官沙龙';
      themeColor = '#1565C0';
      themeGradient = 'linear-gradient(135deg, #1565C0, #42A5F5)';
    } else if (salonType === 'female_salon') {
      typeLabel = '女推荐官沙龙';
      themeColor = '#C2185B';
      themeGradient = 'linear-gradient(135deg, #C2185B, #F06292)';
    }

    // 设置最小日期为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = this.formatDate(tomorrow);

    this.setData({
      salonType,
      typeLabel,
      themeColor,
      themeGradient,
      minDate,
    });

    // 校验申办权限：联创推荐官、社区服务站、城市合伙人、专业推荐官可申办
    // 公益推荐官无申办权限，仅可报名参会
    // 角色值须与 constants/roles.js 中的 ROLE_HIERARCHY 键名完全一致
    const ALLOWED_CREATE_ROLES = ['partner_matchmaker', 'community_station', 'city_franchisee', 'professional_recommender'];
    const userInfo = authService.getUserInfo();
    if (!userInfo || !ALLOWED_CREATE_ROLES.includes(userInfo.role)) {
      wx.showModal({
        title: '权限不足',
        content: '仅联创推荐官、社区服务站、城市合伙人、专业推荐官可申办沙龙，公益推荐官仅可报名参会',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
    }
  },

  /** 格式化日期 YYYY-MM-DD */
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /** 表单输入 */
  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onDescInput(e) { this.setData({ description: e.detail.value }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  onMaxInput(e) { this.setData({ maxPerGender: Number(e.detail.value) || 3 }); },
  onFeeInput(e) { this.setData({ registrationFee: Number(e.detail.value) || 399 }); },

  /** 分组模式切换 */
  onGroupedChange(e) { this.setData({ isGrouped: e.detail.value }); },

  /** Tier选项切换 */
  onTierToggle(e) {
    const key = e.currentTarget.dataset.key;
    const tierOptions = this.data.tierOptions.map(t => {
      if (t.key === key) t.checked = !t.checked;
      return t;
    });
    const allowedTiers = tierOptions.filter(t => t.checked).map(t => t.key);
    this.setData({ tierOptions, allowedTiers });
  },

  /** 日期选择 */
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
    this.updateStartTime();
  },
  onStartTimeChange(e) {
    this.setData({ startTimeVal: e.detail.value });
    this.updateStartTime();
  },
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
    this.updateEndTime();
  },
  onEndTimeChange(e) {
    this.setData({ endTimeVal: e.detail.value });
    this.updateEndTime();
  },

  updateStartTime() {
    const { startDate, startTimeVal } = this.data;
    if (startDate && startTimeVal) {
      this.setData({ startTime: `${startDate} ${startTimeVal}:00` });
    }
  },
  updateEndTime() {
    const { endDate, endTimeVal } = this.data;
    if (endDate && endTimeVal) {
      this.setData({ endTime: `${endDate} ${endTimeVal}:00` });
    }
  },

  /** 上传封面图 */
  chooseCoverImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.setData({ coverImageTempPath: tempPath });
        // 上传到服务器
        uploadFile(tempPath, 'image').then((data) => {
          const url = data.data?.url || data.url || data.data?.data?.url || tempPath;
          this.setData({ coverImage: url });
          wx.showToast({ title: '封面上传成功', icon: 'success' });
        }).catch((err) => {
          console.warn('[salon-create] cover upload failed:', err);
          // 上传失败也保留本地预览
          this.setData({ coverImage: tempPath });
        });
      },
    });
  },

  /** 提交表单 */
  async submitForm() {
    const { title, description, location, startTime, endTime, maxPerGender, registrationFee, coverImage, salonType, isGrouped, allowedTiers } = this.data;

    // 表单校验
    if (!title.trim()) {
      wx.showToast({ title: '请输入沙龙标题', icon: 'none' });
      return;
    }
    if (!description.trim()) {
      wx.showToast({ title: '请输入沙龙描述', icon: 'none' });
      return;
    }
    if (!location.trim()) {
      wx.showToast({ title: '请输入活动地点', icon: 'none' });
      return;
    }
    if (!startTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'none' });
      return;
    }
    if (!salonType) {
      wx.showToast({ title: '沙龙类型异常', icon: 'none' });
      return;
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认提交',
        content: `将提交"${title}"的审核申请，审核通过后可发布。`,
        confirmColor: this.data.themeColor,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ submitting: true });

    try {
      const result = await salonService.createGenderSalon({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startTime,
        endTime: endTime || undefined,
        maxParticipants: (maxPerGender || 3) * 2,
        registrationFee: registrationFee,
        coverImage: coverImage || undefined,
        type: salonType, // 后端期望 male_salon / female_salon
      });

      wx.showToast({ title: '提交成功，等待审核', icon: 'none', duration: 2500 });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
