// pages/matchmaker/apply/apply.js
const applyService = require('../../services/apply.service');

Page({
  data: {
    form: {
      real_name: '',
      gender: 'male', // 默认值
      phone: '',
      wechat: '',
      referrer_id: ''
    },
    loading: false
  },

  onLoad(options) {
    // 如果有推荐人 ID，自动填充
    if (options.referrer_id) {
      this.setData({ 'form.referrer_id': options.referrer_id });
    }
  },

  // 输入框绑定
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({ 'form.gender': e.detail.value });
  },

  // 提交申请
  async onSubmit() {
    const { form, loading } = this.data;
    if (loading) return;

    // 表单验证
    if (!form.real_name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!form.phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...' });

    try {
      const result = await applyService.applyPublicMatchmaker(form);
      wx.hideLoading();
      wx.showToast({ title: '申请提交成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
})