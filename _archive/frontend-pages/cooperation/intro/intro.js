// 合作加盟介绍页面
const authService = require('../../../services/auth.service');

Page({
  data: {
    // 合作模式数据
    cooperationModels: [
      {
        id: 1,
        title: '传统推荐官同行合作',
        icon: '👩‍❤️‍👨',
        description: '已有社交服务机构或推荐官工作室的专业合作',
        features: [
          '资源共享平台，扩大客户资源库',
          '专业培训和技术支持',
          '统一品牌形象和营销推广',
          '收益分成机制透明'
        ],
        requirements: [
          '持有相关服务资质证明',
          '3年以上社交服务经验',
          '至少1名专职推荐官',
          '年服务客户50人以上'
        ],
        investment: '5,000-20,000元加盟费',
        earnings: '收益分成：60%-80%',
        target: '现有社交服务机构、推荐官工作室'
      },
      {
        id: 2,
        title: '团队团长合作',
        icon: '👥',
        description: '沟通能力强、有人脉资源的个人合作',
        features: [
          '灵活的工作时间和方式',
          '线上+线下活动组织权限',
          '团队成员招募和管理权限',
          '高额佣金和奖金制度'
        ],
        requirements: [
          '25岁以上，大专及以上学历',
          '良好沟通和组织能力',
          '本地人脉资源丰富',
          '至少5名团队成员'
        ],
        investment: '2,000-5,000元保证金',
        earnings: '高额佣金+团队奖金',
        target: '社群领袖、活动组织者'
      },
      {
        id: 3,
        title: '社区社交驿站',
        icon: '🏠',
        description: '社区实体店的连锁加盟模式',
        features: [
          '统一的店面形象和装修标准',
          '完整的运营管理系统',
          '专业培训和技术支持',
          '区域保护政策'
        ],
        requirements: [
          '20-100平方米经营场地',
          '10-20万元启动资金',
          '2-3名专职工作人员',
          '接受统一管理培训'
        ],
        investment: '10-20万元总投资',
        earnings: '活动收入+会员费',
        target: '创业者、社区服务提供者'
      },
      {
        id: 4,
        title: '城市合伙人加盟',
        icon: '🌆',
        description: '城市级别的独家代理权',
        features: [
          '城市独家代理权利',
          '完整的市场开发支持',
          '独立运营管理系统',
          '品牌授权和技术输出'
        ],
        requirements: [
          '50-100万元资金实力',
          '本地政府和社会资源',
          '5人以上管理团队',
          '3-5年发展规划'
        ],
        investment: '50-100万元加盟费',
        earnings: '区域总收入分成',
        target: '大型社交平台机构、投资方'
      }
    ],
    
    // 收益分析数据
    earningsAnalysis: [
      {
        model: '传统推荐官同行',
        monthlyEarnings: '10,000-50,000元',
        roi: '3-6个月',
        example: '每月组织2场活动，每场50人，每人收费199元'
      },
      {
        model: '团队团长',
        monthlyEarnings: '5,000-30,000元',
        roi: '1-3个月',
        example: '每月发展10名会员，组织1场活动'
      },
      {
        model: '社区社交驿站',
        monthlyEarnings: '20,000-100,000元',
        roi: '6-12个月',
        example: '固定会员50人，每月组织4场活动'
      },
      {
        model: '城市合伙人加盟',
        monthlyEarnings: '50,000-500,000元',
        roi: '12-24个月',
        example: '发展10个社区驿站，20个团队团长'
      }
    ],
    
    // 成功案例
    successCases: [
      {
        name: '张女士',
        role: '传统推荐官合作',
        region: '威海环翠',
        story: '合作前每月服务20人，合作后通过平台资源每月服务80人，收入增长300%',
        earnings: '月均收入显著提升'
      },
      {
        name: '王先生',
        role: '团队团长',
        region: '威海经区',
        story: '原为互联网公司项目经理，转型后组建15人团队，半年组织12场活动',
        earnings: '团队月均收益可观'
      },
      {
        name: '李女士',
        role: '社区驿站',
        region: '威海高区',
        story: '利用社区店面优势，建立稳定的会员体系，实现稳定的现金流',
        earnings: '驿站月均盈利稳定'
      }
    ],
    
    // 支持体系
    supportSystem: [
      '平台技术系统支持：完整的小程序、管理系统',
      '专业培训体系：推荐官技能、活动组织、客户服务',
      '营销推广支持：线上引流、品牌宣传、活动策划',
      '运营管理支持：标准化流程、客户管理系统',
      '法律合规支持：合同模板、风险防范、纠纷处理'
    ],
    
    // 当前选中的合作模式
    selectedModel: 1,
    
    // 用户信息
    userInfo: null,
    canApply: false,
    
    // 弹窗状态
    showApplyModal: false,
    showContactModal: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 页面显示时刷新用户信息
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = authService.getUserInfo();
    this.setData({
      userInfo,
      canApply: userInfo && userInfo.verified && userInfo.age >= 25
    });
  },

  // 选择合作模式
  selectModel(e) {
    const modelId = e.currentTarget.dataset.id;
    this.setData({ selectedModel: modelId });
  },

  // 前往申请页面
  goToApply() {
    if (!this.data.userInfo) {
      const { requireLogin } = require('../../../utils/auth');
      requireLogin('需要登录后才能申请合作加盟', false);
      return;
    }
    
    if (!this.data.canApply) {
      wx.showModal({
        title: '申请条件不符',
        content: '需年满25岁且完成实名认证才能申请合作加盟',
        confirmText: '去认证',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/subpackages/user/pages/verify/verify'
            });
          }
        }
      });
      return;
    }
    
    // 前往申请页面
    wx.navigateTo({
      url: `/subpackages/partner/pages/cooperation/apply/apply?modelId=${this.data.selectedModel}`
    });
  },

  // 查看合作伙伴
  viewPartners() {
    wx.navigateTo({
      url: '/subpackages/partner/pages/cooperation/partners/partners'
    });
  },

  // 在线咨询
  startOnlineConsultation() {
    if (!this.data.userInfo) {
      const { requireLogin } = require('../../../utils/auth');
      requireLogin('需要登录后才能进行在线咨询', false);
      return;
    }
    
    wx.navigateTo({
      url: '/pages/customer-service/customer-service'
    });
  },

  // 下载资料
  downloadMaterials() {
    wx.showLoading({ title: '准备下载...' });
    
    setTimeout(() => {
      wx.hideLoading();
      
      const fileList = [
        '《合作加盟手册》PDF版',
        '《收益分析报告》Excel版',
        '《运营管理指南》Word版',
        '《合同模板》文档版'
      ];
      
      wx.showActionSheet({
        itemList: fileList,
        success: (res) => {
          const selectedFile = fileList[res.tapIndex];
          wx.showToast({
            title: `${selectedFile}已准备就绪`,
            icon: 'success'
          });
          
          // 模拟文件下载
          setTimeout(() => {
            wx.showModal({
              title: '下载提示',
              content: `文件已保存到您的设备中。如需进一步帮助，请联系客服。`,
              showCancel: false
            });
          }, 1000);
        }
      });
    }, 1500);
  },

  // 分享合作信息
  onShareAppMessage() {
    return {
      title: '人人好媒合作加盟计划 - 共创情感社交服务新生态',
      path: '/subpackages/partner/pages/cooperation/intro/intro',
      imageUrl: '/images/cooperation-share.jpg'
    };
  },

  // 计算收益
  calculateEarnings() {
    const modelId = this.data.selectedModel;
    const model = this.data.cooperationModels.find(m => m.id == modelId);
    
    wx.showModal({
      title: `${model.title}收益计算器`,
      content: `请前往专业计算页面进行详细收益测算，或联系客服获取个性化分析报告。`,
      confirmText: '前往计算',
      cancelText: '联系客服',
      success: (res) => {
        if (res.confirm) {
          // 前往收益计算页面
          wx.navigateTo({
            url: '/subpackages/partner/pages/cooperation/calculator/calculator'
          });
        } else if (res.cancel) {
          this.startOnlineConsultation();
        }
      }
    });
  },

  // 查看成功案例详情
  viewCaseDetail(e) {
    const index = e.currentTarget.dataset.index;
    const caseData = this.data.successCases[index];
    
    wx.showModal({
      title: `${caseData.name}的成功故事`,
      content: `地区：${caseData.region}
合作类型：${caseData.role}
具体成就：${caseData.story}
月收入：${caseData.earnings}`,
      showCancel: false
    });
  },

  // 联系我们
  contactUs() {
    this.setData({ showContactModal: true });
  },

  // 复制联系方式（[V2] 页面WXML未完成，暂用占位；上线时改用 open-type=contact）
  copyContactInfo(e) {
    const type = e.currentTarget.dataset.type;
    // 所有联系方式统一引导至在线客服
    wx.showToast({ title: '请联系在线客服', icon: 'none' });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showApplyModal: false,
      showContactModal: false
    });
  }
});