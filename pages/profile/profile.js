// pages/profile/profile.js
const { request, uploadFile } = require('../../utils/request');
const { API_BASE_URL } = require('../../utils/config');
const { checkTextSafety, serverCheckText, serverCheckImageUpload } = require('../../utils/contentModeration');
const authService = require('../../services/auth.service');
const API = require('../../services/api');

Page({
  data: {
    form: { nickname: '', intro: '', wechatAccount: '', gender: '' },
    avatar: '',
    saving: false,
    introCount: 0,
    showPrivacyPopup: false,
    nicknameFocus: false,
  },

  async onLoad() {
    // 优先从本地缓存读取（快速出数据）
    const cached = authService.getUserInfo() || {};
    this.setData({
      form: {
        nickname: cached.nickname || '',
        intro: cached.intro || '',
        wechatAccount: cached.wechatAccount || '',
        gender: cached.gender || '',
      },
      avatar: cached.avatar || '',
      introCount: (cached.intro || '').length,
    });

    // 如果本地缓存为空（首次打开或被清缓存），从服务端兜底拉取
    const isEmpty = !cached.nickname && !cached.intro && !cached.wechatAccount && !cached.avatar;
    if (isEmpty) {
      try {
        const serverData = await request({ url: '/v1/user/profile', method: 'GET' });
        if (serverData && typeof serverData === 'object') {
          this.setData({
            form: {
              nickname: serverData.nickname || '',
              intro: serverData.intro || '',
              wechatAccount: serverData.wechatAccount || '',
              gender: serverData.gender || '',
            },
            avatar: serverData.avatar || '',
            introCount: (serverData.intro || '').length,
          });
          // 同步到本地缓存，下次直接读取
          authService.setUserInfo({ ...serverData });
        }
      } catch (e) {
        // 网络异常时静默降级，使用（空）本地缓存
      }
    }
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const patch = { [`form.${key}`]: value };
    if (key === 'intro') patch.introCount = value.length;
    this.setData(patch);
  },

  // 微信选择头像回调
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;
    this.setData({ avatar: avatarUrl });
  },

  // 登录入口（被 wxml bindtap 引用）
  onLogin() {
    const app = getApp();
    if (app && app.login) app.login();
  },

  // 跳转建档（被 wxml bindtap 引用）
  onGoRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  // 昵称实时输入
  onNicknameInput(e) {
    const nickname = e.detail.value;
    this.setData({ 'form.nickname': nickname });
  },

  // 微信昵称选择回调（open-type="chooseNickname"）
  // 用户点击按钮后弹出微信昵称选择，选择后回调此函数
  onChooseNickname(e) {
    console.log('[chooseNickname] 回调事件:', e);
    this._nicknameEventTriggered = true;
    // 兼容 iOS/Android 不同版本的字段名
    const detail = e.detail || {};
    const nickname = detail.nickname || detail.nickName || detail.value || '';
    const errMsg = detail.errMsg || '';

    if (!nickname) {
      if (errMsg.indexOf('deny') > -1 || errMsg.indexOf('fail') > -1) {
        wx.showToast({ title: '已取消授权，可手动输入昵称', icon: 'none' });
      } else {
        // chooseNickname 无返回 → 自动聚焦到 type="nickname" 输入框
        wx.showToast({ title: '请点击输入框选择微信昵称', icon: 'none' });
        // 自动聚焦昵称输入框
        this.setData({ nicknameFocus: true });
      }
      return;
    }
    // 授权成功，自动回填昵称
    this.setData({ 'form.nickname': nickname, nicknameFocus: false });
    wx.showToast({ title: '已获取微信昵称', icon: 'success' });
  },

  // 聚焦昵称输入框（兜底方案：当 chooseNickname 不生效时手动输入）
  onTapFocusNickname() {
    this.setData({ nicknameFocus: true });
    wx.showToast({ title: '请点击输入框选择或手动输入昵称', icon: 'none', duration: 2000 });
  },

  // 隐私弹窗关闭
  onPrivacyClose() {
    this.setData({ showPrivacyPopup: false });
  },

  // 昵称输入框获得焦点（保持空函数避免 setData 导致弹窗闪退）
  onNicknameFocus() {
    // type="nickname" input 的 focus 事件中不要执行 setData，否则会关闭微信昵称选择器
  },

  // 微信昵称输入完成
  onNicknameBlur(e) {
    const nickname = e.detail.value;
    if (!nickname) return;
    this.setData({ 'form.nickname': nickname });
  },

  // 性别选择
  onGenderTap(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ 'form.gender': val });
  },

  async onSave() {
    if (this.data.saving) return;
    wx.vibrateShort({ type: 'medium' });

    const { nickname, intro, wechatAccount, gender } = this.data.form;
    const localAvatar = this.data.avatar;
    // 真正需要上传的情况：本地临时文件（微信 chooseAvatar 返回的 http://tmp/ 格式临时路径）
    const isTrueLocalFile = localAvatar && (
      localAvatar.startsWith('http://tmp/') ||
      localAvatar.startsWith('wxfile://') ||
      localAvatar.startsWith('http://dldir') ||
      localAvatar.startsWith('http://usr')
    );

    console.log('[profile.onSave] 开始保存', { nickname, intro, wechatAccount, gender, localAvatar, isTrueLocalFile });

    // 客户端敏感词预检（昵称和简介）
    if (nickname) {
      const check = checkTextSafety(nickname);
      if (!check.safe) {
        wx.showToast({ title: '昵称包含不适当内容，请修改', icon: 'none' });
        return;
      }
    }
    if (intro) {
      const check = checkTextSafety(intro);
      if (!check.safe) {
        wx.showToast({ title: '简介包含不适当内容，请修改', icon: 'none' });
        return;
      }
    }

    this.setData({ saving: true });
    try {
      // 服务端内容安全检查（简介）
      if (intro) {
        console.log('[profile.onSave] 正在进行简介内容安全检查...');
        const serverResult = await serverCheckText(intro, 1);
        console.log('[profile.onSave] 简介内容安全检查结果:', serverResult);
        if (!serverResult.safe) {
          wx.showToast({ title: serverResult.label === 'review' ? '简介正在审核中' : '简介包含不适当内容', icon: 'none' });
          this.setData({ saving: false });
          return;
        }
      }

      // 上传新头像（仅处理真正的本地临时文件）
      let avatarUrl = '';
      if (isTrueLocalFile) {
        console.log('[profile.onSave] 正在上传本地头像...');
        const res = await uploadFile(localAvatar, 'avatar');
        avatarUrl = res.url || res.data?.url || '';
        console.log('[profile.onSave] 头像上传结果:', res, 'avatarUrl:', avatarUrl);
        if (!avatarUrl) {
          wx.showToast({ title: '头像上传失败', icon: 'none' });
          this.setData({ saving: false });
          return;
        }
        this.setData({ avatar: avatarUrl });
      } else if (localAvatar && (localAvatar.startsWith('https://') || localAvatar.startsWith('/'))) {
        // 已有 https URL 或相对路径，直接使用
        avatarUrl = localAvatar;
      }
      // 如果 localAvatar 为空（旧数据无头像）或异常状态，avatarUrl 保持为空

      // 提交更新
      const updateData = {
        nickname,
        intro,
        wechatAccount,
        gender,
      };
      // 只有真正获取到有效 avatarUrl 时才传给后端（避免覆盖数据库中的已有头像）
      if (avatarUrl) {
        updateData.avatar = avatarUrl;
      }
      console.log('[profile.onSave] 准备提交更新到 API:', API.USER.UPDATE_PROFILE, JSON.stringify(updateData));

      const res = await request({ url: API.USER.UPDATE_PROFILE, method: 'PUT', data: updateData });
      console.log('[profile.onSave] API 响应成功:', JSON.stringify(res));

      // 同步本地状态
      let updatedUserInfo = { ...authService.getUserInfo() };
      // API 响应中可能包含 profileScore、scoreTier 等非用户字段，不要合并到 userInfo
      // 只同步后端返回的实际用户字段
      if (res && typeof res === 'object') {
        const USER_FIELDS = ['id', 'nickname', 'avatar', 'gender', 'role', 'phone', 'wechatAccount', 'intro',
          'city', 'age', 'education', 'maritalStatus', 'occupation', 'income', 'referrerId', 'roleList'];
        for (const field of USER_FIELDS) {
          if (res[field] !== undefined) {
            updatedUserInfo[field] = res[field];
          }
        }
      }
      // 确保提交的字段一定写入本地缓存
      if (updateData.gender) updatedUserInfo.gender = updateData.gender;
      if (updateData.avatar) updatedUserInfo.avatar = updateData.avatar;
      if (updateData.nickname) updatedUserInfo.nickname = updateData.nickname;
      if (updateData.wechatAccount !== undefined) updatedUserInfo.wechatAccount = updateData.wechatAccount;
      if (updateData.intro !== undefined) updatedUserInfo.intro = updateData.intro;
      authService.setUserInfo(updatedUserInfo);

      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      console.error('[profile] onSave 出错:', JSON.stringify(e), 'message:', e.message, 'code:', e.code, 'status:', e.status);
      // 401 = 登录过期，特殊提示
      if (e.code === 401) {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      } else if (e.status === -1 || e.status === 'ETIMEDOUT' || e.code === 'ETIMEDOUT') {
        wx.showToast({ title: '网络超时，请检查网络后重试', icon: 'none' });
      } else {
        wx.showToast({ title: e.message || '保存失败', icon: 'none' });
      }
    } finally {
      this.setData({ saving: false });
    }
  },
});
