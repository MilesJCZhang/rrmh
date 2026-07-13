// subpackages/activity/pages/female-salon-create/female-salon-create.js
// 女推荐官沙龙创建页 - 独立页面，粉色商务风，类型自动锁定为 female_salon
const authService = require('../../../../services/auth.service');
const salonService = require('../../../../services/salon.service');
const { uploadFile } = require('../../../../utils/request');

Page({
  data: {
    // 类型锁定：女推荐官沙龙
    salonType: 'female_salon',
    typeLabel: '女推荐官沙龙',
    themeColor: '#C2185B',
    themeGradient: 'linear-gradient(135deg, #C2185B 0%, #F06292 100%)',
    
    // 表单字段
    title: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    maxParticipants: 27,    // 全场人数上限（含随行）
    maxRecommenders: 9,  // 推荐官席位上限
    registrationFee: 399,
    coverImage: '',
    coverImageTempPath: '',
    
    // 日期时间选择器
    startDate: '',
    startTimeVal: '',
    endDate: '',
    endTimeVal: '',
    minDate: '',
    
    // 审核状态
    isEditMode: false,
    salonId: null,
    auditStatus: '',
    rejectReason: '',
    
    submitting: false,
  },

  onLoad(options) {
    // 设置最小日期为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = this.formatDate(tomorrow);
    
    // 检查权限：仅女推荐官可创建
    const userInfo = authService.getUserInfo();
    if (!userInfo || userInfo.gender !== 'female') {
      wx.showModal({
        title: '权限不足',
        content: '仅女性推荐官可创建女推荐官沙龙',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }
    
    // 编辑模式
    if (options.id) {
      this.setData({
        isEditMode: true,
        salonId: Number(options.id),
        minDate,
      });
      this.loadSalonData(Number(options.id));
    } else {
      this.setData({ minDate });
    }
    
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#C2185B',
    });
  },

  /** 格式化日期 YYYY-MM-DD */
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /** 加载沙龙数据（编辑模式） */
  async loadSalonData(id) {
    try {
      const salon = await salonService.getSalonDetail(id);
      if (!salon) {
        wx.showToast({ title: '沙龙不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }
      
      // 解析时间
      let startDate = '', startTimeVal = '', endDate = '', endTimeVal = '';
      if (salon.start_time) {
        const start = new Date(salon.start_time);
        startDate = this.formatDate(start);
        startTimeVal = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      }
      if (salon.end_time) {
        const end = new Date(salon.end_time);
        endDate = this.formatDate(end);
        endTimeVal = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      }
      
      this.setData({
        title: salon.title || '',
        description: salon.description || '',
        location: salon.location || '',
        startTime: salon.start_time || '',
        endTime: salon.end_time || '',
        maxParticipants: salon.total_cap || 27,
        maxRecommenders: salon.max_recommenders || 9,
        registrationFee: salon.registration_fee || 399,
        coverImage: salon.cover_image || '',
        coverImageTempPath: salon.cover_image || '',
        startDate,
        startTimeVal,
        endDate,
        endTimeVal,
        auditStatus: salon.audit_status || '',
        rejectReason: salon.reject_reason || '',
      });
    } catch (err) {
      console.error('[female-salon-create] loadSalonData error:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /** 表单输入 */
  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onDescInput(e) { this.setData({ description: e.detail.value }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  onMaxParticipantsInput(e) { 
    const val = Number(e.detail.value) || 27;
    if (val > 27) {
      wx.showToast({ title: '人数上限不超过27人', icon: 'none' });
      this.setData({ maxParticipants: 27 });
    } else {
      this.setData({ maxParticipants: val });
    }
  },
  onFeeInput(e) { this.setData({ registrationFee: Number(e.detail.value) || 399 }); },

  /** 日期时间选择 */
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
          console.warn('[female-salon-create] cover upload failed:', err);
          // 上传失败也保留本地预览
          this.setData({ coverImage: tempPath });
        });
      },
    });
  },

  /** 提交表单 */
  async submitForm() {
    const { 
      salonType, title, description, location, startTime, endTime, 
      maxParticipants, maxRecommenders, registrationFee, coverImage, 
      isEditMode, salonId 
    } = this.data;

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
    if (maxParticipants > 27) {
      wx.showToast({ title: '人数上限不超过27人', icon: 'none' });
      return;
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认提交',
        content: `将提交"${title}"的审核申请，审核通过后可发布。`,
        confirmText: '确认提交',
        confirmColor: this.data.themeColor,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ submitting: true });
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startTime: startTime,
        endTime: endTime || undefined,
        maxParticipants: maxParticipants,
        registrationFee: registrationFee,
        coverImage: coverImage || undefined,
        type: salonType,
      };

      if (isEditMode && salonId) {
        // 编辑模式：更新沙龙
        await salonService.updateSalon(salonId, data);
        wx.showToast({ title: '更新成功，等待审核', icon: 'none', duration: 2500 });
      } else {
        // 创建模式：提交审核
        await salonService.createSalon(data);
        wx.showToast({ title: '提交成功，等待审核', icon: 'none', duration: 2500 });
      }
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 下架沙龙 */
  async onTakeDownSalon() {
    const { salonId } = this.data;
    if (!salonId) return;

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '下架沙龙',
        content: '确认下架此沙龙？下架后将不再接受报名。',
        confirmText: '确认下架',
        confirmColor: '#F44336',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;
    try {
      await salonService.takeDownSalon(salonId);
      wx.showToast({ title: '下架成功', icon: 'none' });
      this.loadSalonData(salonId);
    } catch (e) {
      wx.showToast({ title: e.message || '下架失败', icon: 'none' });
    }
  },

  /** 去完善资料 */
  onGoRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },
});