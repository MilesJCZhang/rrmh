Component({
  properties: {
    // 总分 0-100
    score: {
      type: Number,
      value: 0,
    },
    // 评分等级 gold/silver/bronze/unrated
    tier: {
      type: String,
      value: 'unrated',
    },
    // 是否显示详细维度
    showDetail: {
      type: Boolean,
      value: false,
    },
    // 各维度分数 { basic: 32, career: 10, ... }
    groupScores: {
      type: Object,
      value: {},
    },
    // 是否紧凑模式（用于卡片内）
    compact: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    tierLabel: '',
    tierColor: '',
    progressPercent: 0,
    groups: [],
  },

  observers: {
    'score, tier, groupScores': function (score, tier, groupScores) {
      const TIER_MAP = {
        gold: { label: '优质', color: '#FFD700' },
        silver: { label: '良好', color: '#C0C0C0' },
        bronze: { label: '基础', color: '#CD7F32' },
        unrated: { label: '未建档', color: '#999' },
      };
      const tierInfo = TIER_MAP[tier] || TIER_MAP.unrated;

      const GROUP_CONFIG = [
        { key: 'basic', label: '基础信息', max: 40 },
        { key: 'career', label: '职业收入', max: 15 },
        { key: 'hobby', label: '兴趣爱好', max: 15 },
        { key: 'preference', label: '择偶需求', max: 10 },
        { key: 'verification', label: '认证', max: 12 },
        { key: 'asset', label: '资产', max: 8 },
      ];

      const groups = GROUP_CONFIG.map(g => ({
        ...g,
        earned: groupScores[g.key] || 0,
        percent: g.max > 0 ? Math.round((groupScores[g.key] || 0) / g.max * 100) : 0,
      }));

      this.setData({
        tierLabel: tierInfo.label,
        tierColor: tierInfo.color,
        progressPercent: Math.min(score, 100),
        groups,
      });
    },
  },

  methods: {
    onTapBar() {
      this.triggerEvent('tap');
    },
  },
});
