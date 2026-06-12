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
    const isLocalFile = localAvatar && !localAvatar.startsWith('https://') && localAvatar.startsWith('http');

    // 客户端敏感词预检
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
      // 服务端内容安全检查
      if (intro) {
        const serverResult = await serverCheckText(intro, 1);
        if (!serverResult.safe) {
          wx.showToast({ title: serverResult.label === 'review' ? '简介正在审核中' : '简介包含不适当内容', icon: 'none' });
          this.setData({ saving: false });
          return;
        }
      }

      // 上传新头像（若是本地临时文件）
      let avatarUrl = localAvatar && localAvatar.startsWith('https://') ? localAvatar : '';
      if (isLocalFile) {
        const res = await uploadFile(localAvatar, 'avatar');
        avatarUrl = res.data?.url || res.url || '';
        if (!avatarUrl) {
          wx.showToast({ title: '头像上传失败', icon: 'none' });
          this.setData({ saving: false });
          return;
        }
        this.setData({ avatar: avatarUrl });
      }

      // 提交更新
      const updateData = {
        nickname,
        intro,
        wechatAccount,
        gender,
        avatar: avatarUrl || localAvatar,
      };
      const res = await request({ url: API.USER.UPDATE_PROFILE, method: 'PUT', data: updateData });

      // 同步本地状态：优先使用服务端返回的完整用户数据（包含同步后的角色）
      // request() 已自动提取 body.data，res 本身就是 { id, role, ... }
      // 注意：部分 API 可能不回传 gender 等字段，需要从 updateData 兜底补充
      let updatedUserInfo = { ...authService.getUserInfo() };
      if (res && typeof res === 'object') {
        updatedUserInfo = { ...updatedUserInfo, ...res };
      }
      // 确保提交的性别一定写入本地缓存（防止 API 不回传 gender）
      if (updateData.gender) updatedUserInfo.gender = updateData.gender;
      // 确保提交的头像、昵称等也写入
      if (updateData.avatar) updatedUserInfo.avatar = updateData.avatar;
      if (updateData.nickname) updatedUserInfo.nickname = updateData.nickname;
      authService.setUserInfo(updatedUserInfo);

      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
