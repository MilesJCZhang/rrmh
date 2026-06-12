// pages/avatar/avatar.js - AI分身（画像）核心页面
// ============================================================
// 功能：
// 1. 录音采集（10道问题，语音回答）
// 2. 语音上传 + 触发 LLM 生成 AI 画像
// 3. 查看已生成的画像状态和动态
// 4. 推荐官视图：管理会员画像列表
// ============================================================

const { requestRecordPermission } = require('../../utils/auth');
const authService = require('../../services/auth.service');
const AvatarService = require('../../services/avatar.service');
const { checkTextSafety, serverCheckText } = require('../../utils/contentModeration');

// 开发模式开关（正式发布前改为 false）
const DEV_MODE = false;

// 系统预设问题库（10道，涵盖性格、生活、价值观）
const QUESTIONS = [
  '请简单介绍一下你自己，包括你的性格特点',
  '你的成长经历对你影响最深的是什么？',
  '你平时喜欢做什么，有什么兴趣爱好？',
  '你如何看待家庭和睦，你理想中的生活环境是什么样的？',
  '你认为朋友最重要的品质是什么？',
  '你的交友观是怎样的，你认为维系友谊的关键是什么？',
  '你平时的作息和生活习惯是怎样的？',
  '你在工作和生活之间如何平衡？',
  '你对健康的态度是怎样的，有什么健康习惯？',
  '如果两个人有矛盾，你会怎么处理？',
];

const recorderManager = wx.getRecorderManager();
const innerAudioContext = wx.createInnerAudioContext();

Page({
  data: {
    // ── 身份 ──
    userRole: '',        // 当前活跃角色，用于区分会员/推荐官视图
    hasAvatar: false,
    isMatchmaker: false,

    // ── 已有画像信息 ──
    userAvatar: '',
    avatarName: '',
    avatarTags: [],
    avatarSummary: '',   // AI 生成的性格简述
    avatarOnline: true,
    avatarStatus: 'ready',  // ready / processing / failed
    groupFreeRemain: 30,
    activities: [],

    // ── 录音流程 ──
    step: 'intro',  // intro / recording / generating / done
    currentQuestionIndex: 0,
    totalQuestions: QUESTIONS.length,
    currentQuestion: QUESTIONS[0],
    recording: false,
    recordTime: 0,
    recordedAnswers: [],   // [{questionIndex, question, filePath}]
    playingIndex: -1,      // 当前播放的录音索引

    // ── 生成进度 ──
    generating: false,
    generateProgress: 0,   // 0~100
    generateStatusText: '',
    generateJobId: '',

    // ── 推荐官视图 ──
    mkStats: { total: 0, active: 0, matched: 0, chatting: 0 },
    memberAvatarList: [],
    // 查看他人画像（推荐官点击会员）
    viewingMemberId: '',
  },

  onLoad(options) {
    // 查看他人画像（推荐官点击会员）
    if (options.id) {
      const memberId = options.id;
      this.setData({ step: 'done', isMatchmaker: false, hasAvatar: true, viewingMemberId: memberId });
      this._loadOtherAvatar(memberId);
      return;
    }

    const userInfo = authService.getUserInfo() || {};
    const hasAvatar = authService.hasAvatar();
    const hasProfile = authService.hasProfile();
    const isMatchmaker = authService.isMatchmaker();
    const userRole = authService.getUserRole();

    // 推荐官直接进会员管理视图，无需档案检测
    if (isMatchmaker) {
      this.setData({
        userRole, hasAvatar, isMatchmaker,
        userAvatar: userInfo.avatar || '/assets/images/Logo.jpg',
        avatarName: `${userInfo.nickname || '您'}的AI画像`,
        step: 'matchmaker_view',
      });
      this.loadMemberAvatars();
      this._setupRecorder();
      this._setupAudio();
      return;
    }

    // ↓ 以下仅会员逻辑 ↓
    // 检查档案是否完善
    const { nickname, intro } = userInfo;
    const isProfileComplete = nickname && nickname.trim() !== '' && intro && intro.trim() !== '';

    // 如果档案不完善，提示用户先完善档案
    if (hasProfile && !isProfileComplete) {
      wx.showModal({
        title: '完善会员档案',
        content: '请先完善会员档案（昵称、个人简介），AI才能为您生成更准确的画像。',
        confirmText: '去完善',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/register/register' });
          } else {
            wx.navigateBack({ delta: 1 });
          }
        },
        fail: () => {
          wx.navigateBack({ delta: 1 });
        }
      });
      return;
    }

    // 确定初始步骤
    // 规则：
    // 1. 已有画像 → 显示画像管理（step: 'done'）
    // 2. 档案完善 + 无画像 → 直接开始录音问答（step: 'recording'）
    // 3. 其他情况 → 显示介绍页（step: 'intro'）
    let initialStep = 'intro';
    if (hasAvatar) {
      initialStep = 'done';
    } else if (hasProfile && isProfileComplete) {
      initialStep = 'recording';
    }

    this.setData({
      userRole, hasAvatar, isMatchmaker,
      userAvatar: userInfo.avatar || '/assets/images/Logo.jpg',
      avatarName: `${userInfo.nickname || '您'}的AI画像`,
      step: initialStep,
    });

    if (hasAvatar) {
      this.loadAvatarData();
    }
    this._setupRecorder();
    this._setupAudio();
  },

  onShow() {
    const prevIsMatchmaker = this.data.isMatchmaker;
    const prevHasAvatar = this.data.hasAvatar;
    const userRole = authService.getUserRole();
    const hasAvatar = authService.hasAvatar();
    const isMatchmaker = authService.isMatchmaker();

    this.setData({
      userRole,
      hasAvatar,
      isMatchmaker,
    });

    // 角色切换检测：切换后刷新对应视图数据
    const roleChanged = prevIsMatchmaker !== isMatchmaker;

    if (isMatchmaker) {
      // 推荐官视图：刷新会员画像管理数据
      this.loadMemberAvatars();
    } else {
      // 会员视图：刷新自己的画像数据（切换角色或刚生成完成后）
      if (hasAvatar && (roleChanged || !prevHasAvatar)) {
        this.loadAvatarData();
      } else if (hasAvatar) {
        this.loadAvatarData();
      }
      // 角色从推荐官切回会员时，根据画像状态调整 step
      if (roleChanged) {
        if (hasAvatar) {
          this.setData({ step: 'done' });
        } else {
          const userInfo = authService.getUserInfo() || {};
          const hasProfile = authService.hasProfile();
          const { nickname, intro } = userInfo;
          const isProfileComplete = nickname && nickname.trim() !== '' && intro && intro.trim() !== '';
          this.setData({ step: (hasProfile && isProfileComplete) ? 'recording' : 'intro' });
        }
      }
    }
  },

  onHide() {
    // 页面隐藏时停止录音计时和进度轮询，防止回调访问已隐藏页面
    this._stopRecordTimer();
    this._stopProgressPolling();
  },

  onUnload() {
    this._stopRecordTimer();
    innerAudioContext.destroy();
    this._stopProgressPolling();
  },

  // ──────────────────────────────────────────────────────────
  // 数据加载
  // ──────────────────────────────────────────────────────────

  async loadAvatarData() {
    try {
      const data = await AvatarService.getAvatarInfo();
      this.setData({
        avatarOnline: data.online,
        groupFreeRemain: data.groupFreeRemain || 0,
        avatarTags: data.tags || [],
        avatarSummary: data.summary || '',
        avatarStatus: data.status || 'ready',
      });
      // 如果后端还在处理，继续轮询
      if (data.status === 'processing') {
        this._startProgressPolling(data.jobId || '');
      }
      // 内容安全审核（AI 画像描述展示前检查）
      if (data.summary) {
        const result = checkTextSafety(data.summary);
        if (!result.safe) {
          this.setData({ avatarSummary: '[内容已脱敏]' });
        }
      }
    } catch (e) {
      // 静默失败，不影响UI
    }
    this.loadActivities();
  },

  async loadActivities() {
    try {
      const list = await AvatarService.getAvatarActivities(5);
      this.setData({ activities: list || [] });
    } catch (e) {}
  },

  /**
   * 加载他人AI画像（推荐官查看会员画像）
   */
  async _loadOtherAvatar(memberId) {
    try {
      const req = require('../../utils/request').request;
      const API = require('../../services/api');
      // AVATAR_INFO: '/v1/user/:id/avatar-info'
      const url = API.USER.AVATAR_INFO.replace(':id', memberId);
      const data = await req({ url, method: 'GET' });
      if (data) {
        this.setData({
          avatarOnline: data.online !== false,
          groupFreeRemain: data.groupFreeRemain || 0,
          avatarTags: data.tags || [],
          avatarSummary: data.summary || '暂无画像描述',
          avatarStatus: data.status || 'ready',
          userAvatar: data.avatar || '/assets/images/Logo.jpg',
          avatarName: data.avatarName || data.nickname || '会员画像',
          activities: data.activities || [],
        });
      }
    } catch (e) {
      console.error('[avatar] _loadOtherAvatar 失败:', e);
    }
  },

  async loadMemberAvatars() {
    try {
      const data = await AvatarService.getMemberAvatars();
      // 后端返回: { list: [{ id, avatarName, avatar, age, city, intro, tags, matchScore, role, createdAt }], total, page, pageSize }
      const now = Date.now();
      const list = (data.list || data.data || []).map(m => {
        // 根据 createdAt 推算最近活跃（暂无画像状态字段，默认活跃）
        const createdMs = m.createdAt ? new Date(m.createdAt).getTime() : now;
        const daysAgo = Math.max(0, Math.floor((now - createdMs) / 86400000));
        return {
          id: m.id || '',
          name: m.avatarName || m.name || m.nickname || '会员',
          avatar: m.avatar || '',
          age: m.age || 0,
          city: m.city || '未知',
          online: true,   // 暂无后端状态，默认在线
          matching: true, // 暂无后端状态，默认活跃
          statusText: '画像活跃中',
          lastActive: daysAgo === 0 ? '刚刚' : `${daysAgo}天前`,
        };
      });
      // 统计（直接按总数算）
      const stats = data.stats || {
        total: data.total || list.length,
        active: list.length,
        matched: list.length,
        chatting: 0,
      };
      this.setData({
        mkStats: stats,
        memberAvatarList: list,
      });
    } catch (e) {
      console.error('[avatar] loadMemberAvatars 失败:', e);
    }
  },

  // ──────────────────────────────────────────────────────────
  // 录音管理
  // ──────────────────────────────────────────────────────────

  _setupRecorder() {
    this.recordTimer = null;

    recorderManager.onStart(() => {
      this._startRecordTimer();
    });

    recorderManager.onStop((res) => {
      this._stopRecordTimer();
      this.setData({ recording: false });
      if (res.duration >= 1500) {
        this._saveAnswer(res.tempFilePath);
      } else {
        wx.showToast({ title: '回答太短啦，请重新录制', icon: 'none' });
      }
    });

    recorderManager.onError(() => {
      this.setData({ recording: false });
      this._stopRecordTimer();
      wx.showToast({ title: '录音出错，请重试', icon: 'none' });
    });
  },

  _setupAudio() {
    innerAudioContext.onEnded(() => {
      this.setData({ playingIndex: -1 });
    });
    innerAudioContext.onError(() => {
      this.setData({ playingIndex: -1 });
    });
  },

  _startRecordTimer() {
    this.setData({ recordTime: 0 });
    this.recordTimer = setInterval(() => {
      // 检查页面是否还存在
      if (!this || !this.data) return;
      const t = this.data.recordTime + 1;
      if (t >= 120) {
        // 最长2分钟自动停止
        this.onRecordEnd();
      } else {
        this.setData({ recordTime: t });
      }
    }, 1000);
  },

  _stopRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  _saveAnswer(filePath) {
    const answers = [...this.data.recordedAnswers];
    const idx = this.data.currentQuestionIndex;
    const existing = answers.findIndex(a => a.questionIndex === idx);
    const entry = { questionIndex: idx, question: QUESTIONS[idx], filePath };
    if (existing >= 0) {
      answers[existing] = entry;
    } else {
      answers.push(entry);
    }
    // 自动跳到下一题（若还有）
    const nextIdx = idx < QUESTIONS.length - 1 ? idx + 1 : idx;
    this.setData({
      recordedAnswers: answers,
      currentQuestionIndex: nextIdx,
      currentQuestion: QUESTIONS[nextIdx],
    });
  },

  // 开始录音（bindtouchstart）
  async onRecordStart() {
    if (this.data.recording) return;
    try {
      await requestRecordPermission();
      this.setData({ recording: true });
      recorderManager.start({
        duration: 120000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 64000,
        format: 'aac',
      });
    } catch (e) {
      this.setData({ recording: false });
      wx.showToast({ title: '需要麦克风权限', icon: 'none' });
    }
  },

  // 松开停止（bindtouchend）
  onRecordEnd() {
    if (this.data.recording) {
      recorderManager.stop();
    }
  },

  // 播放已录答案
  onPlayAnswer(e) {
    const idx = e.currentTarget.dataset.index;
    const answer = this.data.recordedAnswers[idx];
    if (!answer) return;

    if (this.data.playingIndex === idx) {
      // 再次点击：停止
      innerAudioContext.stop();
      this.setData({ playingIndex: -1 });
    } else {
      innerAudioContext.src = answer.filePath;
      innerAudioContext.play();
      this.setData({ playingIndex: idx });
    }
  },

  // 删除答案（重录）
  onDeleteAnswer(e) {
    const idx = e.currentTarget.dataset.index;
    const answers = [...this.data.recordedAnswers];
    const deleted = answers.splice(idx, 1)[0];
    // 回到被删除的题
    this.setData({
      recordedAnswers: answers,
      currentQuestionIndex: deleted.questionIndex,
      currentQuestion: QUESTIONS[deleted.questionIndex],
    });
  },

  // 切换到指定题目
  onJumpQuestion(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    this.setData({
      currentQuestionIndex: idx,
      currentQuestion: QUESTIONS[idx],
    });
  },

  // 开始录音（从 intro 页面点击"开始录入语音"）
  onStartRecording() {
    this.setData({ step: 'recording' });
  },

  // 跳过录音（使用文字模式）
  onSkipRecording() {
    wx.showModal({
      title: '确认跳过？',
      content: '跳过录音后，AI画像的性格特征会较为通用，无法完整还原您的真实个性',
      confirmText: '确认跳过',
      cancelText: '继续录入',
      success: (res) => {
        if (res.confirm) {
          // 使用 authService 统一更新状态
          authService.setHasAvatar(true);
          wx.switchTab({ url: '/pages/match/match' });
        }
      },
    });
  },

  // ──────────────────────────────────────────────────────────
  // AI 画像生成
  // ──────────────────────────────────────────────────────────

  async onGenerateAvatar() {
    if (this.data.generating) return;
    if (this.data.recordedAnswers.length < 3) {
      wx.showToast({ title: '至少回答3道题才能生成画像', icon: 'none' });
      return;
    }

    this.setData({ generating: true, generateProgress: 0, generateStatusText: '上传语音中…', step: 'generating' });
    wx.showLoading({ title: '上传语音中…', mask: true });

    try {
      // Step1: 上传所有语音文件
      const total = this.data.recordedAnswers.length;
      const uploads = [];
      for (let i = 0; i < total; i++) {
        const ans = this.data.recordedAnswers[i];
        this.setData({
          generateProgress: Math.round((i / total) * 40),
          generateStatusText: `上传语音 ${i + 1}/${total}…`,
        });
        wx.showLoading({ title: `上传录音 ${i + 1}/${total}`, mask: true });
        const uploaded = await AvatarService.uploadVoice(ans.filePath);
        uploads.push({
          questionIndex: ans.questionIndex,
          question: ans.question,
          voiceUrl: uploaded.url,
        });
      }

      // Step2: 触发 AI 生成
      wx.showLoading({ title: 'AI 正在理解您…', mask: true });
      this.setData({ generateProgress: 45, generateStatusText: 'AI 正在分析您的语音特征…' });

      const result = await AvatarService.generateAvatar(uploads);
      const jobId = result.jobId || '';
      this.setData({ generateJobId: jobId });

      wx.hideLoading();

      // Step3: 轮询生成进度
      if (jobId) {
        this._startProgressPolling(jobId);
      } else {
        // 同步返回（mock 模式）
        this._onGenerateSuccess();
      }

    } catch (e) {
      wx.hideLoading();
      this.setData({ generating: false, generateProgress: 0, step: 'recording' });
      wx.showToast({ title: e.message || '生成失败，请重试', icon: 'none' });
    }
  },

  // 开始轮询进度
  _startProgressPolling(jobId) {
    this._stopProgressPolling();
    let attempt = 0;
    const maxAttempts = 60; // 最多等3分钟

    this.pollTimer = setInterval(async () => {
      // 检查页面是否还存在
      if (!this || !this.data) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        return;
      }
      
      attempt++;
      if (attempt > maxAttempts) {
        this._stopProgressPolling();
        this.setData({ generating: false });
        wx.showToast({ title: '生成超时，请稍后重试', icon: 'none' });
        return;
      }

      try {
        const res = await AvatarService.getAvatarGenerateStatus(jobId);
        
        // 再次检查页面是否还存在（异步操作后）
        if (!this || !this.data) return;
        
        const progress = Math.min(50 + Math.round((attempt / maxAttempts) * 50), 99);

        const statusMap = {
          pending:    'AI 正在排队中…',
          processing: 'AI 正在理解您的性格特征…',
          analyzing:  'AI 正在生成个性化画像…',
          ready:      '画像生成完成！',
          failed:     '生成失败',
        };

        this.setData({
          generateProgress: res.progress || progress,
          generateStatusText: statusMap[res.status] || 'AI 处理中…',
        });

        if (res.status === 'ready') {
          this._stopProgressPolling();
          this._onGenerateSuccess();
        } else if (res.status === 'failed') {
          this._stopProgressPolling();
          this.setData({ generating: false });
          wx.showToast({ title: 'AI 生成失败，请重新录音', icon: 'none' });
        }
      } catch (e) {
        // 网络波动，继续轮询
      }
    }, 3000);
  },

  _stopProgressPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  _onGenerateSuccess() {
    this.setData({ generating: false, generateProgress: 100, generateStatusText: '画像已就绪！' });
    // 使用 authService 统一更新状态
    authService.setHasAvatar(true);
    wx.setStorageSync('avatar_voice_done', true);

    wx.showModal({
      title: '🎉 AI画像生成成功！',
      content: '您的专属AI画像已就绪，可以开始让画像代替您与推荐对象深度交流了',
      confirmText: '开始使用',
      showCancel: false,
      success: () => {
        this.setData({ hasAvatar: true });
        this.loadAvatarData();
      },
    });
  },

  // ──────────────────────────────────────────────────────────
  // 已有画像的操作
  // ──────────────────────────────────────────────────────────

  // 切换画像在线状态
  async onToggleOnline() {
    const newState = !this.data.avatarOnline;
    try {
      await AvatarService.updateAvatarSettings({ online: newState });
      this.setData({ avatarOnline: newState });
      wx.showToast({ title: newState ? '画像已上线' : '画像已暂停', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onEnterGroup() {
    wx.navigateTo({ url: '/subpackages/social/pages/group/group' });
  },

  onOneOnOne() {
    wx.switchTab({ url: '/pages/match/match' });
  },

  onActivityAction(e) {
    const { id, type, actiondata } = e.currentTarget.dataset;
    if (type === 'view_chat' || type === 'suggest_meet') {
      wx.navigateTo({ url: `/subpackages/social/pages/chat/chat?chat_id=${actiondata}&mode=view` });
    }
  },

  onReRecord() {
    wx.showModal({
      title: '重新录入？',
      content: '重新录音将覆盖当前画像，原有社交数据保留。确认继续？',
      confirmText: '重新录入',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            hasAvatar: false,
            step: 'recording',
            currentQuestionIndex: 0,
            currentQuestion: QUESTIONS[0],
            recordedAnswers: [],
            generateProgress: 0,
          });
        }
      },
    });
  },

  onViewMember(e) {
    const id = e.currentTarget.dataset.id;
    // 查看会员的AI分身画像，而非基本资料
    wx.navigateTo({ url: `/pages/avatar/avatar?id=${id}` });
  },
});
