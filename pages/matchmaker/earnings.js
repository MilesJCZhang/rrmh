// pages/matchmaker/earnings.js - 收益明细 & 会员列表
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const incomeService = require('../../services/income.service');

Page({
  data: {
    tab: 'earnings',
    earnings: [],
    members: [],
    loading: true,
    page: 1,
    hasMore: true,
    totalIncome: '0.00',
    totalMembers: 0,
  },

  onLoad(options) {
    const tab = options.tab || 'earnings';
    this.setData({ tab });
    wx.setNavigationBarTitle({ title: tab === 'members' ? '我的会员' : '收益明细' });
  },

  onShow() {
    this.refresh();
  },

  /**
   * 刷新数据
   */
  refresh() {
    this.setData({ page: 1, loading: true });
    if (this.data.tab === 'earnings') {
      this.loadEarnings();
    } else {
      this.loadMembers();
    }
  },

  /**
   * 加载收益明细
   */
  loadEarnings() {
    const { page } = this.data;
    incomeService.getRecords({ page, pageSize: 20 }).then((data) => {
      // 兼容后端返回数组 或 { list, total } 两种格式
      const list = Array.isArray(data) ? data : (data.list || []);
      const total = Array.isArray(data) ? data.length : (data.total || 0);
      const mapped = list.map(e => ({
        ...e,
        typeIcon: this._getEarningIcon(e.type),
        typeName: this._getEarningTypeName(e.type) || e.title || '',
      }));
      this.setData({
        earnings: page === 1 ? mapped : this.data.earnings.concat(mapped),
        totalIncome: data.totalIncome || data.total_income || '0.00',
        hasMore: list.length >= 20,
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  /**
   * 加载会员列表 - 调用 /v1/referral/my-insight 获取真实推荐关系
   */
  loadMembers() {
    this.setData({ loading: true });
    request({
      url: '/v1/referral/my-insight',
      method: 'GET',
    }).then((res) => {
      const chain = res.referral_chain || [];
      const list = chain.map((r) => {
        const role = r.role;
        const isActive = role && role !== 'user' && role !== null;
        const ageStr = r.age ? r.age + '岁' : '';
        const cityStr = r.wechat_account || r.phone || '';
        const meta = ageStr && cityStr ? ageStr + ' · ' + cityStr : (ageStr || cityStr);
        return {
          id: r.id,
          name: r.nickname || '未设置昵称',
          avatar: r.avatar || '',
          age: r.age || 0,
          city: cityStr,
          meta: meta,
          active: isActive,
          joinDate: r.createdAt ? r.createdAt.split('T')[0] : '--',
          matchCount: 0,
          status: isActive ? '活跃' : '待激活',
        };
      });
      this.setData({
        members: list,
        totalMembers: list.length,
        hasMore: false,
        loading: false,
      });
    }).catch((err) => {
      console.error('加载会员失败:', err);
      this.setData({ loading: false });
    });
  },

  /**
   * 加载更多
   */
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    if (this.data.tab === 'earnings') {
      this.loadEarnings();
    } else {
      this.loadMembers();
    }
  },

  _getEarningIcon(type) {
    const icons = {
      // 推荐建档
      single_registration: '💑',
      // 推荐联创推荐官
      partner_referral: '👑',
      // 推荐城市合伙人
      city_referral: '🏙️',
      // 沙龙补贴（联创推荐官专属）
      salon_subsidy: '🎉',
      // 沙龙承办收益（城市合伙人）
      salon_host: '🎪',
      // 沉淀资金分成
      platform_fund: '💎',
      // 身份升级
      upgrade: '⬆️',
      default: '💰',
    };
    return icons[type] || icons.default;
  },

  _getEarningTypeName(type) {
    const names = {
      // 推荐建档收益（所有推荐官身份）
      single_registration: '推荐建档',
      // 推荐联创推荐官（第2个起399元）
      partner_referral: '推荐联创推荐官',
      // 推荐城市合伙人（第2个起10000元+3%沉淀）
      city_referral: '推荐城市合伙人',
      // 沙龙补贴（联创推荐官专属）
      salon_subsidy: '沙龙补贴',
      // 沙龙承办收益（城市合伙人）
      salon_host: '沙龙承办收益',
      // 沉淀资金分成
      platform_fund: '沉淀资金分成',
      // 身份升级
      upgrade: '身份升级',
    };
    return names[type] || '其他收益';
  },
});
