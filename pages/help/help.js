// pages/help/help.js - 帮助与反馈
const app = getApp();
const { request } = require('../../utils/request');

// FAQ数据
const FAQ_DATA = [
  {
    category: '🆕 新手入门',
    items: [
      { id: 'q1', question: '如何注册并建档？', answer: '您需要通过推荐官推荐码才能注册建档。联系平台客服或身边的推荐官获取推荐码，在首页点击"扫推荐官推荐码"扫描绑定后，即可进入建档流程填写个人资料。' },
      { id: 'q2', question: '什么是AI画像？', answer: 'AI画像是基于您录入的语音和资料生成的智能助手。它可以24小时在线，代替您与其他会员进行初步的沟通交流。当双方聊得投缘时，再转为真人直接交流。' },
      { id: 'q3', question: '推荐码绑定后可以更换吗？', answer: '推荐码一旦绑定成功，将永久锁定，不可更换。这是为了保障推荐官的推荐权益，请确认后再绑定。' },
    ],
  },
  {
    category: '💰 费用说明',
    items: [
      { id: 'q4', question: '建档需要收费吗？', answer: '会员建档费用为199元/人，完成支付后档案正式生效。建档后可免费浏览其他会员的公开资料。' },
      { id: 'q5', question: 'AI画像进群月费是多少？', answer: 'AI画像进群月费为99元/月，支付后AI画像将自动在交友群中为您与其他会员互动聊天。' },
      { id: 'q6', question: '一对一服务如何收费？', answer: 'AI画像一对一服务199元/次，由AI画像与指定对象进行一对一的深度交流。' },
      { id: 'q7', question: '如何申请退款？', answer: '进入"我的"页面查看订单记录，找到对应订单点击申请退款。未使用的服务可在7天内申请全额退款。' },
    ],
  },
  {
    category: '🔒 隐私与安全',
    items: [
      { id: 'q8', question: '我的信息会被公开吗？', answer: '不会。您的真实姓名、手机号等敏感信息不会对其他会员公开。沟通时使用昵称，且在双方同意前不会展示联系方式。' },
      { id: 'q9', question: '实名认证需要什么资料？', answer: '基础实名认证需要提供真实姓名和身份证号码，信息经加密传输至公安机关进行核验，我们不会存储您的身份证照片。' },
      { id: 'q10', question: '遇到不良用户怎么举报？', answer: '在聊天页面点击右上角"..."选择"举报"，或在意见反馈中选择"举报投诉"类型，我们会尽快核实处理。' },
    ],
  },
  {
    category: '👩‍❤️‍👨 推荐官服务',
    items: [
      { id: 'q11', question: '如何成为推荐官？', answer: '在首页进入"我是推荐官"提交申请，免费成为公益推荐官。推荐会员成功建档后可获得佣金收益。' },
      { id: 'q12', question: '推荐收益如何计算？', answer: '公益推荐官每成功推荐一位会员建档，可获得99元佣金。联创推荐官除推荐建档收益外，还可在名下会员每次参加沙龙活动时获得99元补贴。具体收益以签署的合作协议为准。' },
      { id: 'q13', question: '推荐收益如何提现？', answer: '进入"社交中心"→"我的收益"页面，累计可提现金额达到50元即可申请提现，1-3个工作日到账。' },
    ],
  },
];

Page({
  data: {
    activeTab: 'faq',
    searchKey: '',
    expandedId: '',
    faqData: FAQ_DATA,
    filteredFaq: FAQ_DATA,

    // 反馈表单
    feedbackTypes: [
      { label: '功能建议', value: 'suggestion' },
      { label: 'Bug反馈', value: 'bug' },
      { label: '举报投诉', value: 'report' },
      { label: '账号问题', value: 'account' },
      { label: '其他', value: 'other' },
    ],
    feedbackType: 'suggestion',
    feedbackDesc: '',
    feedbackContact: '',
    submitting: false,
    submitted: false,
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'faq') {
      this.setData({ filteredFaq: FAQ_DATA, searchKey: '' });
    }
  },

  onSearchInput(e) {
    const key = e.detail.value.trim().toLowerCase();
    this.setData({ searchKey: key });
    if (!key) {
      this.setData({ filteredFaq: FAQ_DATA });
      return;
    }
    const filtered = FAQ_DATA.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.question.toLowerCase().includes(key) ||
        item.answer.toLowerCase().includes(key)
      ),
    })).filter(group => group.items.length > 0);
    this.setData({ filteredFaq: filtered });
  },

  onClearSearch() {
    this.setData({ searchKey: '', filteredFaq: FAQ_DATA });
  },

  onToggleFaq(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  onSelectType(e) {
    this.setData({ feedbackType: e.currentTarget.dataset.value });
  },

  onInputDesc(e) {
    this.setData({ feedbackDesc: e.detail.value });
  },

  onInputContact(e) {
    this.setData({ feedbackContact: e.detail.value });
  },

  onSubmitFeedback() {
    if (!this.data.feedbackDesc.trim()) {
      wx.showToast({ title: '请填写详细描述', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    request({
      url: '/user/feedback',
      method: 'POST',
      data: {
        type: this.data.feedbackType,
        content: this.data.feedbackDesc.trim(),
        contact: this.data.feedbackContact.trim(),
      },
    })
      .then(() => {
        this.setData({ submitting: false, submitted: true, feedbackDesc: '', feedbackContact: '', feedbackType: 'suggestion' });
        wx.showToast({ title: '提交成功', icon: 'success' });
      })
      .catch(() => {
        this.setData({ submitting: false, submitted: true });
        wx.showToast({ title: '已收到反馈', icon: 'success' });
      });
  },
});
