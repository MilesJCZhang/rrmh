// subpackages/premium/pages/custody/custody.js
// 基金托管详情页
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');

Page({
  data: {
    custodyAccounts: [],
    loading: true,
    // 创建托管
    matchRecordId: '',
    custodyYears: 3,
    creating: false,
    showCreateForm: false,
  },

  onLoad(options) {
    if (options.match_record_id) {
      this.setData({ matchRecordId: options.match_record_id, showCreateForm: true });
    }
    this.loadCustodyStatus();
  },

  async loadCustodyStatus() {
    try {
      const resp = await request({ url: API.PREMIUM.CUSTODY_STATUS });
      const data = resp?.data || resp || [];
      this.setData({ custodyAccounts: data, loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  onYearsChange(e) {
    this.setData({ custodyYears: Number(e.detail.value) || 3 });
  },

  // 创建托管
  async onCreateCustody() {
    if (!this.data.matchRecordId) {
      wx.showToast({ title: '缺少匹配记录', icon: 'none' });
      return;
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认创建基金托管',
        content: `托管金额：10万元\n托管期限：${this.data.custodyYears}年\n结婚各扣1.5万服务费\n到期未结婚全额退还`,
        confirmText: '确认创建',
        confirmColor: '#A07820',
        success: res => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    this.setData({ creating: true });
    try {
      await request({
        url: API.PREMIUM.CUSTODY_CREATE,
        method: 'POST',
        data: {
          match_record_id: Number(this.data.matchRecordId),
          custody_years: this.data.custodyYears,
        },
      });
      wx.showToast({ title: '托管申请已创建', icon: 'success' });
      this.setData({ showCreateForm: false });
      this.loadCustodyStatus();
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },
});
