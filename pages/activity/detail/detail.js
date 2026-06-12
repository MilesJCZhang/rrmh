// 活动详情页面
const authService = require('../../../services/auth.service');

Page({
  data: {
    activityId: '',
    activity: null,
    loading: true,
    isOrganizer: false,
    hasJoined: false,
    joinStatus: '未报名',
    participants: [],
    showParticipants: false,
    showJoinModal: false,
    joinFormData: {
      gender: '',
      age: '',
      profession: '',
      interest: '',
      selfIntro: ''
    }
  },

  onLoad(options) {
    const activityId = options.id;
    this.setData({ activityId });
    this.loadActivityDetail(activityId);
    this.checkUserJoinStatus(activityId);
  },

  // 加载活动详情
  loadActivityDetail(activityId) {
    this.setData({ loading: true });
    
    // 模拟API调用
    setTimeout(() => {
      const mockActivity = {
        id: activityId,
        title: 'AI精准推荐沙龙 · 70/80后上午场',
        coverImage: '/images/activity-demo.jpg',
        date: '2026-03-20',
        time: '09:00-12:00',
        location: '私密会客空间（具体地址推荐成功后通知）',
        address: '推荐成功后由推荐官一对一通知',
        price: 299,
        originalPrice: 399,
        capacity: 6,
        currentParticipants: 4,
        genderRatio: {
          male: 50,
          female: 50
        },
        status: '进行中',
        type: '70/80后专场',
        tags: ['70/80后', 'AI精准推荐', '3对私密', '实名认证'],
        description: 'AI大数据360维度深度推荐，同城纯私密、小范围精准见面。每场严格限定3对（共6人），所有推荐对象均为360维度同频人群。联创推荐官全程现场引荐，拒绝大型嘈杂聚会，专注高效结缘。',
        
        requirements: {
          ageRange: '25-40岁',
          education: '大专及以上',
          income: '年收入10万以上',
          verification: '实名认证+学历认证'
        },
        
        schedule: [
          { time: '08:50-09:00', activity: '签到入场' },
          { time: '09:00-09:30', activity: '推荐官引荐介绍' },
          { time: '09:30-10:30', activity: '一对一深度交流' },
          { time: '10:30-11:30', activity: '自由交流环节' },
          { time: '11:30-12:00', activity: '推荐官反馈与后续跟进' }
        ],
        
        organizer: {
          id: 'org001',
          name: '威海市情感社交服务中心',
          type: '认证推荐官机构',
          avatar: '/images/organizer-avatar.jpg',
          rating: 4.8,
          certified: true
        },
        
        refundPolicy: '活动开始前24小时可全额退款，24小时内退款50%',
        notes: '请携带身份证原件进行现场验证，建议着正装出席'
      };
      
      this.setData({
        activity: mockActivity,
        loading: false,
        isOrganizer: false // 模拟判断用户是否为组织者
      });
    }, 500);
  },

  // 检查用户报名状态
  checkUserJoinStatus(activityId) {
    // 模拟API调用检查用户是否已报名
    setTimeout(() => {
      this.setData({
        hasJoined: false,
        joinStatus: '未报名'
      });
    }, 300);
  },

  // 报名活动
  joinActivity() {
    const { activity } = this.data;
    
    // 检查活动状态
    if (activity.status === '已满') {
      wx.showToast({
        title: '活动名额已满',
        icon: 'none'
      });
      return;
    }
    
    // 检查用户是否已登录
    const userInfo = authService.getUserInfo();
    if (!userInfo) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能报名活动',
        success: (res) => {
          if (res.confirm) {
            const { requireLogin } = require('../../../utils/auth');
            requireLogin('请先登录后再报名', false);
          }
        }
      });
      return;
    }
    
    // 检查是否是8090后专区用户
    if (activity.type.includes('80后专区') && userInfo.age < 25) {
      wx.showToast({
        title: '该活动仅限8090后参加',
        icon: 'none'
      });
      return;
    }
    
    // 显示报名表单
    this.setData({ 
      showJoinModal: true,
      joinFormData: {
        gender: userInfo.gender || '',
        age: userInfo.age || '',
        profession: userInfo.profession || '',
        interest: '',
        selfIntro: ''
      }
    });
  },

  // 处理报名表单输入
  onFormInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    const formData = { ...this.data.joinFormData };
    formData[field] = value;
    
    this.setData({ joinFormData: formData });
  },

  // 提交报名
  submitJoin() {
    const { joinFormData, activityId } = this.data;
    
    // 验证表单
    if (!joinFormData.gender || !joinFormData.age || !joinFormData.profession) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }
    
    // 显示支付
    wx.showLoading({ title: '正在处理...' });
    
    // 模拟支付和报名流程
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟支付成功
      wx.showModal({
        title: '报名成功',
        content: '您已成功报名该活动，请准时参加。活动前会收到提醒通知。',
        showCancel: false,
        success: () => {
          this.setData({
            showJoinModal: false,
            hasJoined: true,
            joinStatus: '已报名'
          });
          
          // 更新活动参与人数
          const activity = { ...this.data.activity };
          activity.currentParticipants += 1;
          this.setData({ activity });
        }
      });
    }, 1500);
  },

  // 取消报名
  cancelJoin() {
    wx.showModal({
      title: '确认取消报名',
      content: '取消后如需重新报名需重新支付费用',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          setTimeout(() => {
            wx.hideLoading();
            this.setData({
              hasJoined: false,
              joinStatus: '未报名'
            });
            
            // 更新活动参与人数
            const activity = { ...this.data.activity };
            activity.currentParticipants -= 1;
            this.setData({ activity });
            
            wx.showToast({
              title: '已取消报名',
              icon: 'success'
            });
          }, 1000);
        }
      }
    });
  },

  // 查看参与者
  viewParticipants() {
    // 模拟加载参与者数据
    const mockParticipants = [
      { id: 'p1', name: '张先生', age: 32, gender: '男', profession: 'IT工程师', avatar: '/images/avatar1.jpg' },
      { id: 'p2', name: '李小姐', age: 28, gender: '女', profession: '设计师', avatar: '/images/avatar2.jpg' },
      { id: 'p3', name: '王先生', age: 35, gender: '男', profession: '金融分析师', avatar: '/images/avatar3.jpg' },
      { id: 'p4', name: '赵小姐', age: 30, gender: '女', profession: '律师', avatar: '/images/avatar4.jpg' }
    ];
    
    this.setData({
      participants: mockParticipants,
      showParticipants: true
    });
  },

  // 联系主办方
  contactOrganizer() {
    wx.showActionSheet({
      itemList: ['拨打电话', '在线客服'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({
            phoneNumber: '400-123-4567'
          });
        } else {
          wx.navigateTo({
            url: '/pages/customer-service/customer-service'
          });
        }
      }
    });
  },

  // 分享活动
  onShareAppMessage() {
    const { activity } = this.data;
    
    return {
      title: `${activity.title} - AI精准推荐 3对私密见面`,
      path: `/subpackages/social/pages/activity/detail/detail?id=${activity.id}`,
      imageUrl: activity.coverImage
    };
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showJoinModal: false,
      showParticipants: false
    });
  },

  // 导航到地点
  navigateToLocation() {
    const { activity } = this.data;
    
    wx.openLocation({
      latitude: 31.223, // 模拟坐标
      longitude: 121.443,
      name: activity.location,
      address: activity.address
    });
  }
});