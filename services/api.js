// services/api.js - API Endpoint 注册表
// ============================================================
// 所有后端接口路径统一在此定义，页面/服务层禁止硬编码路径
// 后端路径变更时只改此文件即可
// ============================================================

const API = {

  // ==================== 认证 ====================
  AUTH: {
    WECHAT_LOGIN:    '/v1/auth/wechat-login',     // POST 微信登录
    REFRESH_TOKEN:   '/v1/auth/refresh',          // POST 刷新 token
    LOGOUT:          '/v1/auth/logout',           // POST 退出登录
    BIND_PHONE:      '/v1/auth/bind-phone',       // POST 绑定手机号
  },

  // ==================== 用户/会员 ====================
  USER: {
    PROFILE:         '/v1/user/profile',          // GET  获取当前用户信息
    UPDATE_PROFILE:  '/v1/user/profile/update',  // PUT  更新用户资料
    UPLOAD_AVATAR:   '/v1/upload/avatar',         // POST 上传头像
    AI_AVATAR:       '/v1/user/ai-avatar',        // POST 生成/更新 AI 画像
    AI_AVATAR_STATUS:'/v1/user/ai-avatar/status', // GET  AI 画像生成状态
    AVATAR_INFO:     '/v1/user/:id/avatar-info',  // GET  用户画像信息（聊天页用）
    SWITCH_ROLE:     '/v1/user/switch-role',     // POST 切换当前活跃角色
  },

  // ==================== 会员建档 ====================
  MEMBER: {
    REGISTER:        '/v1/member/register',       // POST 会员建档
    DETAIL:          '/v1/member/detail',         // GET  会员详情
    LIST:            '/v1/member/list',           // GET  我名下的会员列表（推荐官用）
    UPDATE:          '/v1/member/update',         // PUT  更新会员信息
  },

  // ==================== 推荐关系 ====================
  REFERRAL: {
    BIND:            '/v1/referral/bind',         // POST 绑定推荐关系
    INFO:            '/v1/referral/info',         // GET  获取推荐人信息
    VERIFY_CODE:     '/v1/referral/verify',       // POST 验证推荐码
    MY_CODE:         '/v1/referral/my-code',      // GET  获取我的邀请码
    MY_INSIGHT:      '/v1/referral/my-insight',   // GET  获取我的推荐洞察数据
    MINIAPP_QRCODE:  '/v1/referral/miniapp-qrcode', // GET  获取小程序二维码
    // 推荐官工作台数据看板
    WORKBENCH_STATS: '/v1/referral/workbench-stats',      // GET  四大分类统计数据
    WORKBENCH_DETAIL:'/v1/referral/workbench-detail',     // GET  分类明细列表（分页、搜索）
    VISITOR_LOG:    '/v1/referral/visitor-log',        // POST 记录访客到访
    VISITOR_UPDATE:  '/v1/referral/visitor-update',  // PUT  更新访客注册状态
  },

  // ==================== 评分系统 ====================
  SCORE: {
    PROFILE:         '/v1/score/profile',         // GET  获取当前用户评分详情
    RULES:           '/v1/score/rules',          // GET  获取评分规则列表
    RECALCULATE:     '/v1/score/recalculate',     // POST 手动触发评分重算
    TIER_INFO:       '/v1/score/tier-info',       // GET  获取分数等级说明
  },

  // ==================== 收益/提现 ====================
  INCOME: {
    SUMMARY:         '/v1/income/summary',        // GET  收益概览（今日/本月/累计/可提现）
    RECORDS:         '/v1/income/records',        // GET  收益明细列表
    WITHDRAW:        '/v1/income/withdraw',       // POST 申请提现
    WITHDRAW_STATUS: '/v1/income/withdraw/:id',   // GET  提现状态查询
    STATS:           '/v1/income/stats',          // GET  业务统计（建档数/联创数/沙龙次数）
  },

  // ==================== 角色升级/申请 ====================
  APPLY: {
    PUBLIC_MATCHMAKER:   '/v1/apply/public-matchmaker',      // POST 申请公益推荐官
    PARTNER_MATCHMAKER:  '/v1/apply/partner-matchmaker',     // POST 申请联创推荐官（含支付）
    PROFESSIONAL:        '/v1/apply/professional-recommender', // POST 申请专业推荐官（含支付）
    CITY_FRANCHISEE:     '/v1/apply/city-franchisee',        // POST 申请城市合伙人（含支付）
    COMMUNITY_STATION:   '/v1/apply/community-station',      // POST 申请社区服务站（审核制）
    STATUS:              '/v1/apply/status',                 // GET  申请审核状态
  },

  // ==================== 支付 ====================
  PAYMENT: {
    CREATE:          '/v1/payment/create',        // POST 创建支付订单
    STATUS:          '/v1/payment/status/:id',    // GET  支付状态查询
    NOTIFY:          '/v1/payment/notify',        // POST 支付回调（后端用）
    REFUND:         '/v1/payment/refund/:id',  // POST 申请退款
    ORDER:           '/v1/payment/order/:id',    // GET  订单详情
    ORDER_LIST:      '/v1/payment/orders',       // GET  订单列表
  },

  // ==================== 沙龙 ====================
  SALON: {
    LIST:            '/v1/salon/list',            // GET  沙龙列表
    DETAIL:          '/v1/salon/detail/:id',      // GET  沙龙详情
    JOIN:            '/v1/salon/:id/join',       // POST 报名参加
    CANCEL:          '/v1/salon/:id/cancel',      // POST 取消报名
    CHECKIN:         '/v1/salon/:id/checkin',     // POST 签到
    CREATE:          '/v1/salon/create',          // POST 创建沙龙（城市合伙人）
    CREATE_GENDER:   '/v1/salon/create-gender',   // POST 创建性别主体沙龙（推荐官）
    APPROVE:         '/v1/salon/:id/approve',     // PUT  审核沙龙（管理员）
    PUBLISH:         '/v1/salon/:id/publish',     // POST 发布沙龙（推荐官）
    MY_LIST:         '/v1/salon/my-list',         // GET  我参与/举办的沙龙
    UPCOMING:        '/v1/salon/upcoming',      // GET  即将开始的沙龙
    WEEKLY_SCHEDULE: '/v1/salon/weekly-schedule', // GET  获取周历报名状况
    TEMPLATE_LIST:   '/v1/template/list',       // GET  活动模板列表
    TEMPLATE_DETAIL: '/v1/template/detail/:id', // GET  活动模板详情
    EXPORT:          '/v1/salon/:id/export',   // GET  导出Excel
    POSTER:          '/v1/salon/:id/poster',    // POST 生成海报
  },

  // ==================== 推荐官（前端用，后端暂未实现）====================
  MATCHMAKER: {
    STATUS:          '/v1/matchmaker/status',      // GET  推荐官状态
    LIST:            '/v1/matchmaker/list',        // GET  推荐官列表
    DETAIL:          '/v1/matchmaker/:id/info',   // GET  推荐官详情（:id 需替换）
    DASHBOARD:       '/v1/matchmaker/dashboard',   // GET  推荐官工作台数据
    WITHDRAW:       '/v1/matchmaker/withdraw',    // POST 推荐官提现
    MY_MEMBERS:     '/v1/matchmaker/my-members',  // GET  我的会员列表（推荐官视角）
  },

  // ==================== 实名认证 ====================
  VERIFY: {
    SUBMIT:          '/v1/verify/submit',         // POST 提交实名认证
    STATUS:          '/v1/verify/status',         // GET  认证状态
  },

  // ==================== 上传 ====================
  UPLOAD: {
    IMAGE:           '/v1/upload/image',          // POST 上传图片
    VOICE:           '/v1/upload/voice',          // POST 上传语音
  },

  // ==================== AI 分身 ====================
  AVATAR: {
    INFO:      '/v1/avatar/info',          // GET  AI分身基本信息
    ACTIVITIES:'/v1/avatar/activities',   // GET  AI分身动态列表
    GENERATE:  '/v1/avatar/generate',     // POST 生成AI分身
    GEN_STATUS:'/v1/avatar/generate/status', // GET  生成进度
    SETTINGS:  '/v1/avatar/settings',     // PUT  更新分身设置
  },

  // ==================== 匹配推荐 ====================
  MATCH: {
    RECOMMEND:'/v1/match/recommend',     // GET  推荐匹配列表（含分层过滤）
    TIER_ACCESS:'/v1/match/tier-access', // GET  获取当前用户tier访问权限
  },

  // ==================== 线上解锁 ====================
  UNLOCK: {
    ONLINE:  '/v1/unlock/online',       // POST 线上解锁（199/299元）
    STATUS:  '/v1/unlock/status',       // GET  查询解锁状态
  },

  // ==================== 高端验资匹配 ====================
  PREMIUM: {
    VERIFY:          '/v1/premium/verify',            // POST 提交验资资料
    VERIFY_STATUS:   '/v1/premium/verify/status',     // GET  查询验资状态
    MATCH_START:     '/v1/premium/match/start',       // POST 开始高端AI匹配
    MATCH_STATUS:    '/v1/premium/match/status',      // GET  查询匹配状态
    MATCH_CONFIRM:   '/v1/premium/match/confirm',     // POST 确认匹配对象
    CUSTODY_CREATE:  '/v1/premium/custody/create',    // POST 创建10万基金托管
    CUSTODY_STATUS:  '/v1/premium/custody/status',    // GET  查询托管状态
  },

  // ==================== 约见/联谊（union）====================
  REUNION: {
    CHAT_MESSAGES:  '/v1/reunion/chat/:chatId/messages',  // GET  联谊聊天消息
    ARRANGE_MEET:   '/v1/reunion/arrange-meet',             // POST 安排见面
  },

  // ==================== 群组/聊天 ====================
  GROUP: {
    MINE:     '/v1/group/mine',      // GET  我的群组信息
    JOIN:     '/v1/group/join',      // POST 加入推荐群
    DETAIL:   '/v1/group/detail',    // GET  群组详情
  },
  CHAT: {
    HISTORY:  '/v1/chat/history',        // GET  聊天记录
    MESSAGES: '/v1/chat/:chatId/messages', // GET  画像聊天消息记录
    START:    '/v1/chat/start',          // POST 开始AI画像聊天
  },

  // ==================== 约见 ====================
  MEET: {
    APPLY: '/v1/meet/apply',            // POST 申请推荐官约见
  },

  // ==================== 配置 ====================
  CONFIG: {
    PUBLIC_MAP:      '/v1/config/public-map',    // GET  公开配置（分润规则等）
    MAP:             '/v1/config/map',           // GET  所有配置键值对（需登录）
  },

  // ==================== 统计 ====================
  STATS: {
    OVERVIEW:        '/v1/stats/overview',      // GET  首页统计概览
  },

  // ==================== 管理后台（管理员用）====================
  ADMIN: {
    STATISTICS:      '/v1/admin/statistics',      // GET  仪表盘统计
    USERS:           '/v1/admin/users',          // GET  用户管理列表
    ACTIVITIES:      '/v1/admin/activities',     // GET/POST 活动管理
    WITHDRAWALS:     '/v1/admin/withdrawals',    // GET  提现审核列表
    PAYMENTS:        '/v1/admin/payments',       // GET  支付记录
    EARNINGS:        '/v1/admin/earnings',       // GET  收益明细（被动）
    VERIFICATIONS:   '/v1/admin/verifications', // GET  实名认证审核
    VERIFY_STATS:    '/v1/admin/verifications/stats', // GET  认证统计
    MATCHMAKERS:     '/v1/admin/matchmakers',   // GET  推荐官列表
    STATIONS:        '/v1/admin/stations',       // GET  社区服务站点列表
    FRANCHISEES:     '/v1/admin/franchisees',   // GET  城市合伙人列表
    OFFICERS:        '/v1/admin/officers',       // GET  推荐专员列表
    ACTIVITY_TEMPLATES: '/v1/admin/activity-templates', // GET  活动模板
    REFERRAL_CODES:  '/api/admin/referral-codes/list', // GET  邀请码列表
    // 阶段五新增
    SCORE_RULES:     '/v1/admin/score/rules',          // GET/PUT 评分规则
    SCORE_RULE_TOGGLE: '/v1/admin/score/rules/:id/toggle', // POST 启用/禁用规则
    SCORE_OVERVIEW:  '/v1/admin/score/overview',       // GET  评分分布统计
    SCORE_RECALC_ALL:'/v1/admin/score/recalculate-all',// POST 批量重算
    ORDERS:          '/v1/admin/orders',               // GET  订单管理
    COMMISSIONS:     '/v1/admin/commissions',          // GET  佣金管理
    ARCHIVES:        '/v1/admin/archives',             // GET  档案管理
    ARCHIVE_DETAIL:  '/v1/admin/archives/:id',         // GET  档案详情
    PREMIUM_VERIFICATIONS: '/v1/admin/premium-verifications', // GET  高端验资审核
    PREMIUM_VERIFY_ACTION: '/v1/admin/premium-verifications/:id', // PUT  审核操作
    FUND_CUSTODY:    '/v1/admin/fund-custody',         // GET  基金托管列表
    FUND_CUSTODY_SETTLE: '/v1/admin/fund-custody/:id', // PUT  结算操作
  },
};

module.exports = API;
