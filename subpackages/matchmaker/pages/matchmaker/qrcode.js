// pages/matchmaker/qrcode.js - 推广码页面（支持管理员分配的邀请码）
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');
const app = getApp();

Page({
  data: {
    // 原有海报数据
    posterUrl: '',
    matchmakerId: '',
    generating: false,
    canShareTimeline: true,

    // 新增：邀请码相关
    referralCode: '',
    codeTypeName: '',
    hasReferralCode: false,
    qrcodeLoading: false,
    qrcodeBase64: '',
    qrCodeBase64: '',       // 普通二维码（可被 wx.scanCode 扫描识别）
    qrcodeLocalPath: '',   // 存成本地路径，用于分享图片
    invitationCode: '',
  },

  onLoad() {
    // 并行加载：邀请码 + 小程序码（海报功能暂未上线，跳过 loadQrcode）
    this.loadReferralCode();
  },

  // ─── 原有逻辑：加载海报 ───
  loadQrcode() {
    this.setData({ generating: true });
    // 检查后端是否有此路由，如果没有则使用 mock 数据
    request({ 
      url: '/v1/matchmaker/qrcode',
      withToken: false, // 海报生成可能不需要 token
    }).then((resp) => {
      const data = resp.data || resp;
      this.setData({
        posterUrl: data.posterUrl,
        matchmakerId: data.matchmakerId,
        generating: false,
      });
    }).catch((err) => {
      console.warn('[loadQrcode] 加载海报失败，使用mock数据:', err);
      // Mock 数据（原有逻辑）
      this.setData({
        posterUrl: '/images/mock_poster.png', // 使用本地 mock 图片
        matchmakerId: 'mock_' + Date.now(),
        generating: false,
      });
    });
  },

  // ─── 新增：获取管理员分配的邀请码 ───
  loadReferralCode() {
    console.log('[qrcode] loadReferralCode called');
    request({
      url: API.REFERRAL.MY_CODE,
      method: 'GET',
    }).then((resp) => {
      console.log('[qrcode] loadReferralCode response:', JSON.stringify(resp));
      const data = resp.data || resp;
      console.log('[qrcode] loadReferralCode data:', JSON.stringify(data));
      console.log('[qrcode] raw keys:', Object.keys(data));

      // 兼容多种后端返回格式：
      // 格式1: { recommendCode: "RC000003" }
      // 格式2: { has_code: true, code: "RC000003", code_type: "xxx" }
      // 格式3: { hasCode: true, code: "RC000003", codeTypeName: "xxx" }
      const code = data.code || data.recommendCode || '';
      const hasCode = !!(data.hasCode || data.has_code || data.recommendCode);

      console.log('[qrcode] code:', code, '| hasCode:', hasCode);
      
      if (hasCode && code) {
        console.log('[qrcode] 有推荐码:', code);
        this.setData({
          referralCode: code,
          codeTypeName: data.codeTypeName || data.code_type || '',
          hasReferralCode: true,
          invitationCode: code,
        });
        // 获取到邀请码后，自动生成小程序码
        this.loadMiniappQrcode();
      } else {
        console.log('[qrcode] 没有推荐码');
        this.setData({ hasReferralCode: false });
      }
    }).catch((err) => {
      console.error('[qrcode] loadReferralCode 获取邀请码失败:', err);
      this.setData({ hasReferralCode: false });
    });
  },

  // ─── 新增：生成小程序码 ───
  loadMiniappQrcode() {
    this.setData({ qrcodeLoading: true });
    request({
      url: API.REFERRAL.MINIAPP_QRCODE,
      method: 'GET',
    }).then((resp) => {
      const data = resp.data || resp;
      const base64 = data.qrcodeBase64 || '';
      const qrCode64 = data.qrCodeBase64 || '';
      // base64 图片存成本地文件，用于分享
      let localPath = '';
      if (base64 && base64.startsWith('data:image')) {
        try {
          const fs = wx.getFileSystemManager();
          const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
          localPath = `${wx.env.USER_DATA_PATH}/qrcode_share_${Date.now()}.png`;
          fs.writeFileSync(localPath, base64Data, 'base64');
        } catch (e) {
          console.error('[qrcode] 保存分享图片失败:', e);
        }
      }
      this.setData({
        qrcodeBase64: base64,
        qrCodeBase64: qrCode64,
        qrcodeLocalPath: localPath,
        qrcodeLoading: false,
      });
    }).catch((err) => {
      console.error('[loadMiniappQrcode] 生成小程序码失败:', err);
      this.setData({ qrcodeLoading: false });
      wx.showToast({
        title: '二维码生成失败，请重试',
        icon: 'none',
        duration: 2000,
      });
    });
  },

  // ─── 复制推荐ID（原有）───
  onCopyId() {
    wx.setClipboardData({
      data: this.data.matchmakerId,
      success: () => wx.showToast({ title: '已复制推荐ID', icon: 'success' }),
    });
  },

  // ─── 新增：复制邀请码 ───
  onCopyCode() {
    const code = this.data.referralCode || this.data.invitationCode;
    if (!code) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制邀请码', icon: 'success' }),
    });
  },

  // ─── 预览海报（原有）───
  onPreviewPoster() {
    const url = this.data.qrcodeBase64 || this.data.posterUrl;
    if (url) {
      wx.previewImage({ urls: [url] });
    }
  },

  // ─── 保存海报（原有逻辑，兼容新的小程序码）───
  onSavePoster() {
    const url = this.data.qrcodeBase64 || this.data.posterUrl;
    if (!url) {
      wx.showToast({ title: '海报生成中…', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在保存…' });

    // 如果是 base64，先写入临时文件
    if (url.startsWith('data:image')) {
      const fs = wx.getFileSystemManager();
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '');
      const filePath = `${wx.env.USER_DATA_PATH}/qrcode_${Date.now()}.png`;
      try {
        fs.writeFileSync(filePath, base64Data, 'base64');
        this._saveToAlbum(filePath);
      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
      return;
    }

    // 网络图片，先下载到本地
    if (url.startsWith('http')) {
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            this._saveToAlbum(res.tempFilePath);
          } else {
            wx.hideLoading();
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        },
      });
    } else {
      // 本地图片直接保存
      this._saveToAlbum(url);
    }
  },

  // 保存到相册的内部方法
  _saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: (err) => {
        wx.hideLoading();
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  // ─── 分享给好友 ───
  onShareAppMessage() {
    const invitationCode = this.data.invitationCode;
    const matchmakerId = this.data.matchmakerId;

    // 优先使用邀请码分享（新逻辑），兜底用推荐ID（旧逻辑）
    const sharePath = invitationCode
      ? `/pages/index/index?invitationCode=${invitationCode}`
      : `/pages/index/index?referrer_id=${matchmakerId}`;

    return {
      title: '来人人媒好认识新朋友，AI画像帮你开启交流～',
      path: sharePath,
      imageUrl: this.data.qrcodeLocalPath || this.data.posterUrl || '',
    };
  },

  // ─── 分享到朋友圈 ───
  onShareTimeline() {
    const invitationCode = this.data.invitationCode;
    const matchmakerId = this.data.matchmakerId;
    const qrcodeBase64 = this.data.qrcodeBase64;
    let qrcodeLocalPath = this.data.qrcodeLocalPath;
    const posterUrl = this.data.posterUrl;

    console.log('[qrcode] onShareTimeline triggered:', JSON.stringify({
      invitationCode, matchmakerId,
      qrcodeBase64Len: qrcodeBase64 ? qrcodeBase64.length : 0,
      qrcodeLocalPath: qrcodeLocalPath,
      posterUrl: posterUrl,
    }));

    if (!invitationCode && !matchmakerId) {
      wx.showToast({ title: '请先获取推广码', icon: 'none' });
      return false;
    }

    const query = invitationCode
      ? `invitationCode=${invitationCode}`
      : `referrer_id=${matchmakerId}`;

    let imageUrl = qrcodeLocalPath || posterUrl || '';
    if (!imageUrl && qrcodeBase64 && qrcodeBase64.startsWith('data:image')) {
      try {
        const fs = wx.getFileSystemManager();
        const base64Data = qrcodeBase64.replace(/^data:image\/\w+;base64,/, '');
        const tempPath = `${wx.env.USER_DATA_PATH}/qrcode_share_${Date.now()}.png`;
        fs.writeFileSync(tempPath, base64Data, 'base64');
        imageUrl = tempPath;
        console.log('[qrcode] onShareTimeline generated temp image:', imageUrl);
      } catch (e) {
        console.error('[qrcode] onShareTimeline writeFile failed:', e);
      }
    }

    if (!imageUrl) {
      wx.showToast({ title: '请等待二维码生成完成', icon: 'none' });
      return false;
    }

    return {
      title: '来人人媒好认识新朋友，AI画像帮你开启交流～',
      query: query,
      imageUrl: imageUrl,
    };
  },
});
