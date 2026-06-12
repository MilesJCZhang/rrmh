// subpackages/premium/pages/verify/verify.js
// 高端验资资料提交页
const { request, uploadFile } = require('../../../../utils/request');
const API = require('../../../../services/api');
const authService = require('../../../../services/auth.service');

Page({
  data: {
    // 验资状态
    verifyRecords: [],
    hasApprovedVerification: false,
    // 表单
    verifyType: 'online',
    assetType: '',
    assetDescription: '',
    documentUrls: [],
    estimatedValue: '',
    contactPhone: '',
    preferredTime: '',
    preferredLocation: '',
    // 选项
    assetTypeOptions: [
      { val: 'property', label: '房产' },
      { val: 'vehicle', label: '车辆' },
      { val: 'deposit', label: '银行存款' },
      { val: 'income', label: '收入证明' },
      { val: 'other', label: '其他资产' },
    ],
    submitting: false,
    uploading: false,
    loading: true,
  },

  onLoad() {
    this.loadVerifyStatus();
  },

  async loadVerifyStatus() {
    try {
      const resp = await request({ url: API.PREMIUM.VERIFY_STATUS });
      const records = resp?.data || resp || [];
      const hasApproved = records.some(r => r.status === 'approved');
      this.setData({ verifyRecords: records, hasApprovedVerification: hasApproved, loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  // 验资方式切换
  onVerifyTypeChange(e) {
    this.setData({ verifyType: e.currentTarget.dataset.type });
  },

  // 资产类型选择
  onAssetTypeTap(e) {
    this.setData({ assetType: e.currentTarget.dataset.val });
  },

  // 输入
  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value });
  },

  // 上传材料
  onUploadDocument() {
    const remaining = 6 - this.data.documentUrls.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传6张材料', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ uploading: true });
        const uploadPromises = res.tempFilePaths.map(path =>
          uploadFile(path, 'image').then(data => {
            return data.data?.url || data.url || data.data?.data?.url || path;
          }).catch(() => path)
        );
        Promise.all(uploadPromises).then(urls => {
          this.setData({
            documentUrls: [...this.data.documentUrls, ...urls],
            uploading: false,
          });
        });
      },
    });
  },

  // 删除材料
  onRemoveDocument(e) {
    const idx = e.currentTarget.dataset.index;
    const documentUrls = [...this.data.documentUrls];
    documentUrls.splice(idx, 1);
    this.setData({ documentUrls });
  },

  // 提交验资
  async onSubmit() {
    const { verifyType, assetType, assetDescription, documentUrls, estimatedValue, contactPhone, preferredTime, preferredLocation } = this.data;

    if (!assetType) {
      wx.showToast({ title: '请选择资产类型', icon: 'none' });
      return;
    }
    if (documentUrls.length === 0 && verifyType === 'online') {
      wx.showToast({ title: '请上传验资材料', icon: 'none' });
      return;
    }
    if (!contactPhone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await request({
        url: API.PREMIUM.VERIFY,
        method: 'POST',
        data: {
          verify_type: verifyType,
          asset_type: assetType,
          asset_description: assetDescription,
          document_urls: documentUrls,
          estimated_value: estimatedValue,
          contact_phone: contactPhone,
          preferred_time: verifyType === 'offline' ? preferredTime : undefined,
          preferred_location: verifyType === 'offline' ? preferredLocation : undefined,
        },
      });
      wx.showToast({ title: '申请已提交', icon: 'success' });
      setTimeout(() => this.loadVerifyStatus(), 1000);
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 去匹配页
  onGoMatch() {
    wx.navigateTo({ url: '/subpackages/premium/pages/match/match' });
  },

  onGoBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
