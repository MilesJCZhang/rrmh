// app.js - 人人媒好小程序入口
const { request, refreshToken } = require('./utils/request');
const { bindReferrer, initReferral, bindByCode, parseReferralScene } = require('./utils/referral');
const authService = require('./services/auth.service');
const { preloadConfig } = require('./utils/commissionRules');
const { isMatchmakerRole } = require('./constants/roles');

App({
  globalData: {
    userInfo: null,
    openid: null,
    token: null,
    isLogin: false,
    referrerId: null,
    referrerInfo: null,
    invitationCode: null,
    isGuest: true,
    profileScore: 0,
    scoreTier: 'unrated',
    hasProfile: false,
    hasAvatar: false,
    avatarVoiceDone: false,
    userRole: 'user',
    isVerified: false,
    verificationLevel: 0,
    privacyResolveCallback: null,
    showPrivacyPopup: false,
    _onLoginSuccess: null,
    hasUserInfoAuth: false
  },

  onLaunch(options) {
    // 全局错误捕获
    wx.onError && wx.onError(function(err) {
      // 过滤微信基础库内部已知 bug（子包加载 / 页面路由）
      if (typeof err === 'string') {
        if (err.indexOf('__subPageFrameEndTime__') > -1 || err.indexOf('appLaunch with non-empty page stack') > -1) return;
      }
      if (err && err.message) {
        if (err.message.indexOf('__subPageFrameEndTime__') > -1 || err.message.indexOf('appLaunch with non-empty page stack') > -1) return;
      }
      console.error('[App.onError]', err);
    });
    
    // 分享到朋友圈需要微信7.0.7+，用canIUse兜底
    if (wx.canIUse('showShareMenu#menus.shareTimeline')) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    } else {
      wx.showShareMenu({ withShareTicket: true });
    }

    wx.onNeedPrivacyAuthorization((resolve) => {
      this.globalData.privacyResolveCallback = resolve;
      this.globalData.showPrivacyPopup = true;
      const pages = getCurrentPages();
      const curPage = pages[pages.length - 1];
      if (curPage && curPage.setData) {
        curPage.setData({ showPrivacyPopup: true });
      }
    });

    wx.requirePrivacyAuthorize({
      success: () => console.log('[privacy] 用户已同意'),
      fail: () => console.log('[privacy] 用户拒绝'),
    });

    const MODE = require('./utils/request').MODE || 'mock';
    if (MODE === 'container' && wx.cloud) {
      wx.cloud.init({ env: '', traceUser: true });
    }

    initReferral();
    preloadConfig();
    this._handleScene(options);
    this._initStorage();
    this._autoLogin();
  },

  onShow(options) {
    this._handleScene(options);
    this._checkLogin();
  },

  _checkLogin() {
    const token = wx.getStorageSync('token');
    if (token && !this.globalData.isLogin) {
      // 有 token 但未同步到全局，重新获取用户信息
      // 防止并发：如果已经在拉取中，不再发起第二次
      if (this._profileFetching) return;
      this._profileFetching = true;
      request({ url: '/v1/user/profile', method: 'GET' })
        .then(userData => {
          this._profileFetching = false;
          if (userData) {
            this._syncUserData(userData);
            this.globalData.isLogin = true;
            this._lastProfileRefresh = Date.now();
          }
        })
        .catch((err) => {
          this._profileFetching = false;
          // 只有 401 才重新登录；业务错误（400）不需要重登
          if (err && err.code === 401) {
            this.login();
          } else {
            console.warn('[checkLogin] 获取用户信息失败（非401，不触发重新登录）:', err && err.message);
          }
        });
    } else if (token && this.globalData.isLogin) {
      // 已登录状态：每60秒最少刷新一次profile（检测角色变更等）
      const now = Date.now();
      const lastRefresh = this._lastProfileRefresh || 0;
      if (now - lastRefresh > 60000 && !this._profileFetching) {
        this._profileFetching = true;
        request({ url: '/v1/user/profile', method: 'GET' })
          .then(userData => {
            this._profileFetching = false;
            if (userData) {
              this._syncUserData(userData);
              this._lastProfileRefresh = Date.now();
            }
          })
          .catch(() => { this._profileFetching = false; });
      }
    } else if (!token && !this.globalData.isLogin) {
      // 无 token，自动登录
      this.login();
    }
  },

  _handleScene(options) {
    // 开发者工具环境：不处理 scene 中的推荐人数据，避免测试 scene 导致无意义的绑定请求
    let inDevtools = false;
    try { inDevtools = wx.getSystemInfoSync().platform === 'devtools'; } catch (e) {}
    if (inDevtools) {
      this._lastSceneReferrerId = null;
      this._lastSceneInvitationCode = null;
      this.globalData.pendingReferrerId = null;
      this.globalData.invitationCode = null;
      wx.removeStorageSync('pending_referrer_id');
      wx.removeStorageSync('invitation_code');
      return; // 开发者工具环境直接返回，不处理 scene
    }

    const { referrerId, invitationCode } = parseReferralScene(options);

    // 只保存当前 scene 的有效推荐信息（onLaunch 时处理一次）
    if (referrerId) {
      if (this._lastSceneReferrerId === referrerId) return; // 已处理过，跳过
      this._lastSceneReferrerId = referrerId;
      wx.setStorageSync('pending_referrer_id', referrerId);
      this.globalData.pendingReferrerId = referrerId;
    } else {
      this._lastSceneReferrerId = null;
      this.globalData.pendingReferrerId = null;
      wx.removeStorageSync('pending_referrer_id');
    }

    if (invitationCode) {
      if (this._lastSceneInvitationCode === invitationCode) return;
      this._lastSceneInvitationCode = invitationCode;
      wx.setStorageSync('invitation_code', invitationCode);
      this.globalData.invitationCode = invitationCode;
    } else {
      this._lastSceneInvitationCode = null;
      this.globalData.invitationCode = null;
      wx.removeStorageSync('invitation_code');
    }

    // 如果已登录，立即绑定
    // 优先使用 invitationCode（bindByCode 会验证推荐码并正确更新 use_count）
    // bindReferrer 仅在只有 referrerId（无推荐码）时单独使用
    if (this.globalData.isLogin && invitationCode) {
      bindByCode(invitationCode, { silent: true }).catch(() => {
        wx.removeStorageSync('invitation_code');
        delete this.globalData.invitationCode;
      });
    } else if (this.globalData.isLogin && referrerId) {
      bindReferrer(referrerId, null, { silent: true }).catch(() => {
        wx.removeStorageSync('pending_referrer_id');
        delete this.globalData.pendingReferrerId;
      });
    }
  },

  _autoLogin() {
    const token = wx.getStorageSync('token');
    if (token) {
      if (this._profileFetching) return; // 防止并发
      this._profileFetching = true;
      request({ url: '/v1/user/profile', method: 'GET' })
        .then(userData => {
          this._profileFetching = false;
          if (userData) {
            this._syncUserData(userData);
            this.globalData.isLogin = true; // 修复：同步后标记已登录
          }
        })
        .catch((err) => {
          this._profileFetching = false;
          // 只有 401 才重新登录；业务错误不需要
          if (err && err.code === 401) {
            this.login();
          } else {
            console.warn('[autoLogin] 获取用户信息失败（非401，不触发重新登录）:', err && err.message);
          }
        });
    } else {
      this.login();
    }
  },

  _initStorage() {
    const g = this.globalData;
    g.token = wx.getStorageSync('token');
    g.openid = wx.getStorageSync('openid');
    g.userInfo = wx.getStorageSync('user_info');
    g.hasProfile = wx.getStorageSync('has_profile') || false;
    g.hasAvatar = wx.getStorageSync('has_avatar') || false;
    g.avatarVoiceDone = wx.getStorageSync('avatar_voice_done') || false;
    g.userRole = wx.getStorageSync('user_role') || 'user';
    g.isVerified = wx.getStorageSync('is_verified') || false;
    g.verificationLevel = wx.getStorageSync('verification_level') || 0;
    g.referrerId = wx.getStorageSync('referrer_id') || null;
    g.referrerInfo = wx.getStorageSync('referrer_info') || null;
    g.invitationCode = wx.getStorageSync('invitation_code') || null;
    g.hasUserInfoAuth = wx.getStorageSync('has_userinfo_auth') || false;

    if (g.token) {
      g.isLogin = true;
      g.isGuest = !g.hasProfile;
    }
  },

  login() {
    if (this._loginPromise) return this._loginPromise;

    this._loginPromise = new Promise((resolve, reject) => {
      wx.login({
        success: res => {
          if (!res.code) return reject(new Error('获取登录凭证失败'));
          const code = res.code;
          const refId = this.globalData.referrerId || wx.getStorageSync('referrer_id');
          const invitationCode = this.globalData.invitationCode;

          request({
            url: '/v1/auth/wechat-login',
            method: 'POST',
            data: { code, referrer_id: refId, referral_code: invitationCode },
            withToken: false
          }).then(resp => {
            const data = resp.data || resp;
            this.globalData.token = data.token;
            this.globalData.openid = data.openid;
            this.globalData.isLogin = true;

            // 登录成功后，如果有待绑定的推荐人/推荐码，触发绑定
            const pendingReferrerId = this.globalData.pendingReferrerId || wx.getStorageSync('pending_referrer_id');
            if (pendingReferrerId) {
              bindReferrer(pendingReferrerId, null, { silent: true }).catch(() => {});
              wx.removeStorageSync('pending_referrer_id');
              delete this.globalData.pendingReferrerId;
            }
            const pendingCode = wx.getStorageSync('invitation_code');
            if (pendingCode && !pendingReferrerId) {
              bindByCode(pendingCode, { silent: true }).catch(() => {
                // 绑定失败，清除失效的 invitation_code，避免重复重试
                wx.removeStorageSync('invitation_code');
              });
            }

            wx.setStorageSync('token', data.token);
            wx.setStorageSync('openid', data.openid);
            if (data.refresh_token) wx.setStorageSync('refresh_token', data.refresh_token);

            // 同步评分数据
            this._syncScoreData();

            if (data.user) {
              this._syncUserData(data.user);
              // 检查用户是否为推荐官角色（访客/会员不提示）
              const u = data.user;
              const roleList = u.roleList || (u.role ? [u.role] : []);
              const isMatchmaker = roleList.some(r => isMatchmakerRole(r));
              if (isMatchmaker) {
                const needWechatAccount = !u.wechatAccount;
                const needProfile = !u.nickname || u.nickname === '未设置昵称';
                const needAvatar = !u.avatar;
                if (needWechatAccount || needProfile || needAvatar) {
                  // 只提示一次，避免每次登录都弹窗（完善后数据持久化在服务端）
                  if (!wx.getStorageSync('profile_prompted')) {
                    setTimeout(() => {
                      wx.showModal({
                        title: '完善个人信息',
                        content: '请补充微信号、头像和昵称，以便获得更好的体验。',
                        confirmText: '去完善',
                        success: (res) => {
                          if (res.confirm) {
                            wx.switchTab({ url: '/pages/mine/mine' });
                          }
                        }
                      });
                      wx.setStorageSync('profile_prompted', true);
                    }, 1500);
                  }
                }
              }
            } else {
              authService.setHasProfile(false);
              authService.setHasAvatar(false);
            }

            if (data.isNewUser) {
              wx.showToast({ title: '注册成功', icon: 'success' });
            }

            if (this.globalData._onLoginSuccess) {
              this.globalData._onLoginSuccess();
              this.globalData._onLoginSuccess = null;
            }
            resolve(data);
          }).catch(reject);
        },
        fail: reject
      });
    }).finally(() => {
      this._loginPromise = null;
    });
    return this._loginPromise;
  },

  _syncUserData(user) {
    authService.syncUserData(user, { syncToken: false });
    this.globalData.userInfo = user;
    this.globalData.gender = user.gender;
    const hasNickname = !!user.nickname && user.nickname !== '未设置昵称';
    const hasAvatar = !!user.avatar && !user.avatar.includes('default-avatar');
    const hasWechatAccount = !!user.wechatAccount;
    this.globalData.hasProfile = hasNickname;
    this.globalData.hasAvatar = hasAvatar;
    this.globalData.hasUserInfoAuth = hasNickname && hasAvatar && hasWechatAccount;
    this.globalData.isGuest = !hasNickname;
  },

  // 同步评分数据（登录后、资料更新后调用）
  _syncScoreData() {
    const API = require('./services/api').default || require('./services/api').API;
    request({
      url: (API && API.SCORE && API.SCORE.PROFILE) || '/v1/score/profile',
      method: 'GET',
      withToken: true,
    }).then(data => {
      if (data) {
        this.globalData.profileScore = data.totalScore || 0;
        this.globalData.scoreTier = data.tier || 'unrated';
        wx.setStorageSync('profile_score', data.totalScore || 0);
        wx.setStorageSync('score_tier', data.tier || 'unrated');
      }
    }).catch(() => {
      // 评分同步失败不影响主流程
    });
  },

  logout() {
    request({
      url: '/auth/logout',
      method: 'POST',
      withToken: true
    }).finally(() => {
      authService.clearUserState();
      Object.assign(this.globalData, {
        token: null, userInfo: null, isLogin: false, isGuest: true,
        hasProfile: false, hasAvatar: false, userRole: 'user',
        isVerified: false, verificationLevel: 0, hasUserInfoAuth: false
      });
      wx.removeStorageSync('has_userinfo_auth');
      wx.reLaunch({ url: '/pages/index/index' });
    });
  },

  /**
   * 如果有待上报的访客日志且 openid 可用，调用 logVisitor 上报
   */
  _logVisitorIfNeeded() {
    const openid = this.globalData.openid;
    if (!openid) return;

    const pendingCode = this.globalData.pendingVisitorCode || wx.getStorageSync('pending_visitor_code');
    const pendingReferrer = this.globalData.pendingVisitorReferrer || wx.getStorageSync('pending_visitor_referrer');

    let visitorCode = pendingCode;
    // 如果没有 invitationCode 但有 referrerId，尝试从 globalData 获取
    if (!visitorCode && pendingReferrer) {
      visitorCode = wx.getStorageSync('invitation_code') || null;
    }

    if (!visitorCode) return;

    // 异步上报，不阻塞主流程
    const userInfo = this.globalData.userInfo || {};
    referralService.logVisitor({
      referrer_code: visitorCode,
      visitor_openid: openid,
      visitor_nickname: userInfo.nickname || '',
      visitor_avatar: userInfo.avatar || '',
    }).then(() => {
      // 上报成功后清除 pending 标记
      wx.removeStorageSync('pending_visitor_code');
      wx.removeStorageSync('pending_visitor_referrer');
      delete this.globalData.pendingVisitorCode;
      delete this.globalData.pendingVisitorReferrer;
    }).catch(err => {
      console.warn('[app] 访客日志上报失败:', err);
    });
  },

  checkPermission(permission) {
    return authService.checkPermission(permission);
  }
});
