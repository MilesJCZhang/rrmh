import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Button, message, Popconfirm,
  Progress, Skeleton, Empty, Space,
} from 'antd';
import {
  UserOutlined, TeamOutlined, ShoppingCartOutlined, DollarOutlined,
  AuditOutlined, TrophyOutlined, StarOutlined, ReloadOutlined,
  ArrowUpOutlined, ArrowDownOutlined, BarChartOutlined,
  PieChartOutlined, LoadingOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import scoreService from '../../services/score.service';
import axios from '../../utils/axios.config';
import './index.scss';

interface DashboardStats {
  totalUsers: number;
  todayNewUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPartners: number;
  pendingWithdrawals: number;
}

interface ScoreOverview {
  tierDistribution: { score_tier: string; count: number }[];
  avgScore: { avg: string; max: number; min: number };
  totalUsers: number;
  scoredUsers: number;
  scoreBuckets: { score_range: string; count: number }[];
}

interface StatCardConfig {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
  bgGradient: string;
  iconBg: string;
  iconColor: string;
  textColor?: string;
  trend?: { direction: 'up' | 'down'; text: string };
}

const PIE_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#d9d9d9'];

const tierLabelMap: Record<string, string> = {
  gold: '优质 (80+)',
  silver: '良好 (60-79)',
  bronze: '基础 (<60)',
  unrated: '未评分',
};
const tierColorMap: Record<string, string> = {
  gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', unrated: '#999',
};
const tierBgMap: Record<string, string> = {
  gold: '#FFFBE6', silver: '#FAFAFA', bronze: '#FFF7EF', unrated: '#F5F5F5',
};

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [scoreOverview, setScoreOverview] = useState<ScoreOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [statsError, setStatsError] = useState(false);
  const [scoreError, setScoreError] = useState(false);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const fetchStats = useCallback(async () => {
    try {
      setStatsError(false);
      // TypeScript 后端统计端点：/v1/admin/statistics
      const res: any = await axios.get('/v1/admin/statistics');
      const d = res?.data?.data || res?.data || res || {};
      setStats({
        totalUsers: d.userStats?.total ?? 0,
        todayNewUsers: 0,
        totalOrders: d.activityStats?.registrations ?? 0,
        totalRevenue: Number(d.financialStats?.totalEarnings ?? 0),
        pendingPartners: d.userStats?.recommend_officers ?? 0,
        pendingWithdrawals: 0,
      });
    } catch (error) {
      console.error('获取统计数据失败', error);
      setStatsError(true);
    }
  }, []);

  const fetchScoreOverview = useCallback(async () => {
    try {
      setScoreError(false);
      const res = await scoreService.getOverview();
      if (res.code === 0) {
        setScoreOverview(res.data);
      } else {
        setScoreError(true);
      }
    } catch (error) {
      console.error('获取评分统计失败', error);
      setScoreError(true);
    }
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    await Promise.all([fetchStats(), fetchScoreOverview()]);
    setLastUpdate(now());
    if (isRefresh) {
      setTimeout(() => setRefreshing(false), 400);
    }
    setLoading(false);
  }, [fetchStats, fetchScoreOverview]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRecalcAll = async () => {
    try {
      const res = await scoreService.recalculateAll();
      if (res.code === 0) {
        message.success(res.message || '批量重算成功');
        await fetchScoreOverview();
      } else {
        message.error(res.message || '重算失败');
      }
    } catch {
      message.error('批量重算失败');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <PageHeader title="仪表盘" subtitle="数据概览" />
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col xs={24} sm={12} md={8} lg={4} key={i}>
              <div className="skeleton-card" />
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
          </Col>
        </Row>
      </div>
    );
  }

  const statCards: StatCardConfig[] = [
    {
      key: 'totalUsers', label: '总用户数', value: stats?.totalUsers ?? 0,
      icon: <UserOutlined />, bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
      trend: stats?.todayNewUsers ? { direction: 'up', text: `今日 +${stats.todayNewUsers}` } : undefined,
    },
    {
      key: 'todayNew', label: '今日新增', value: stats?.todayNewUsers ?? 0,
      icon: <TeamOutlined />, bgGradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
    },
    {
      key: 'totalOrders', label: '总订单数', value: stats?.totalOrders ?? 0,
      icon: <ShoppingCartOutlined />, bgGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
    },
    {
      key: 'totalRevenue', label: '总收益', value: stats?.totalRevenue ?? 0, prefix: '¥',
      icon: <DollarOutlined />, bgGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
    },
    {
      key: 'pendingPartners', label: '待审合伙人', value: stats?.pendingPartners ?? 0,
      icon: <AuditOutlined />, bgGradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
    },
    {
      key: 'pendingWithdrawals', label: '待处理提现', value: stats?.pendingWithdrawals ?? 0,
      icon: <DollarOutlined />, bgGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      iconBg: 'rgba(255,255,255,0.2)', iconColor: '#fff', textColor: '#fff',
    },
  ];

  // 分数段柱状图数据
  const barData = scoreOverview?.scoreBuckets.map((b) => ({
    range: b.score_range,
    count: b.count,
  })) ?? [];

  // 等级分布饼图数据
  const pieData = scoreOverview?.tierDistribution
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: tierLabelMap[t.score_tier] || t.score_tier,
      value: t.count,
      color: tierColorMap[t.score_tier] || '#999',
    })) ?? [];

  const maxBucketCount = Math.max(...barData.map((d) => d.count), 1);

  return (
    <div className="dashboard-page">
      <PageHeader title="仪表盘" subtitle="数据概览" />

      {/* 刷新栏 */}
      <div className="refresh-bar">
        <span className="last-update-time">
          上次更新：{lastUpdate || '--'}
        </span>
        <Button
          type="primary"
          size="small"
          icon={refreshing ? <LoadingOutlined /> : <ReloadOutlined />}
          onClick={() => loadAll(true)}
          loading={refreshing}
        >
          刷新数据
        </Button>
      </div>

      {/* 统计数据卡片 */}
      {statsError && !stats && (
        <Card style={{ marginBottom: 16 }}>
          <Empty description="无法获取统计数据，请检查服务连接" />
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} md={8} lg={4} key={card.key}>
            <Card className="stat-card" bodyStyle={{ padding: '20px' }}
              style={{ background: card.bgGradient }}>
              <div className="stat-card-content">
                <div>
                  <div className="stat-card-value" style={{ color: card.textColor }}>
                    {card.prefix}{card.value.toLocaleString()}
                  </div>
                  <div className="stat-card-label" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {card.label}
                  </div>
                  {card.trend && (
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, display: 'inline-block' }}>
                      <ArrowUpOutlined /> {card.trend.text}
                    </span>
                  )}
                </div>
                <div className="stat-card-icon" style={{ background: card.iconBg, color: card.iconColor }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 评分分布统计 */}
      {scoreOverview && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 28 }}>
            {/* 评分概览卡片 */}
            <Col xs={24} lg={12}>
              <Card
                className="chart-card"
                title={
                  <div className="dashboard-section-title">
                    <TrophyOutlined style={{ color: '#faad14' }} />
                    评分概览
                  </div>
                }
                extra={
                  <Popconfirm title="确认重算所有用户评分？" onConfirm={handleRecalcAll}>
                    <Button type="primary" size="small" icon={<ReloadOutlined />}>
                      批量重算
                    </Button>
                  </Popconfirm>
                }
              >
                <Row gutter={[16, 24]}>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="已评分用户"
                      value={scoreOverview.scoredUsers}
                      suffix={`/ ${scoreOverview.totalUsers}`}
                      prefix={<StarOutlined style={{ color: '#faad14' }} />}
                    />
                    <Progress
                      percent={scoreOverview.totalUsers > 0
                        ? Math.round((scoreOverview.scoredUsers / scoreOverview.totalUsers) * 100)
                        : 0}
                      size="small"
                      style={{ marginTop: 8 }}
                      strokeColor="#faad14"
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="平均分"
                      value={scoreOverview.avgScore.avg}
                      suffix="/ 100"
                      prefix={<TrophyOutlined style={{ color: '#FFD700' }} />}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="最高分"
                      value={scoreOverview.avgScore.max}
                      valueStyle={{ color: '#FFD700' }}
                      prefix={<ArrowUpOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="最低分"
                      value={scoreOverview.avgScore.min}
                      valueStyle={{ color: '#CD7F32' }}
                      prefix={<ArrowDownOutlined />}
                    />
                  </Col>
                </Row>

                {/* 等级分布 */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: '#595959' }}>
                    等级分布
                  </div>
                  <Row gutter={[12, 12]}>
                    {scoreOverview.tierDistribution.map((item) => {
                      const pct = scoreOverview.totalUsers > 0
                        ? Math.round((item.count / scoreOverview.totalUsers) * 100)
                        : 0;
                      return (
                        <Col xs={12} sm={6} key={item.score_tier}>
                          <Card
                            size="small"
                            className="tier-card"
                            bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}
                            style={{ borderLeft: `4px solid ${tierColorMap[item.score_tier] || '#999'}`, background: tierBgMap[item.score_tier] || '#fff' }}
                          >
                            <div className="tier-count" style={{ color: tierColorMap[item.score_tier] }}>
                              {item.count}
                            </div>
                            <div className="tier-label">{tierLabelMap[item.score_tier] || item.score_tier}</div>
                            <Progress
                              percent={pct}
                              size="small"
                              showInfo={false}
                              strokeColor={tierColorMap[item.score_tier]}
                              style={{ marginTop: 4 }}
                            />
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </div>
              </Card>
            </Col>

            {/* 分数段分布柱状图 */}
            <Col xs={24} lg={12}>
              <Card
                className="chart-card"
                title={
                  <div className="dashboard-section-title">
                    <BarChartOutlined style={{ color: '#1890ff' }} />
                    分数段分布
                  </div>
                }
              >
                {barData.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <RechartsTooltip
                          formatter={(value: any) => [`${value} 人`, '人数']}
                          contentStyle={{ borderRadius: 8 }}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                          {barData.map((_, index) => (
                            <Cell key={index} fill={['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'][index % 6]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty description="暂无分数段数据" style={{ padding: 40 }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* 等级分布饼图 */}
          {pieData.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={12}>
                <Card
                  className="chart-card"
                  title={
                    <div className="dashboard-section-title">
                      <PieChartOutlined style={{ color: '#722ed1' }} />
                      等级占比
                    </div>
                  }
                >
                  <div className="chart-container" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#ccc' }}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend
                          formatter={(value: any) => <span style={{ color: '#595959' }}>{value}</span>}
                        />
                        <RechartsTooltip
                          formatter={(value: any, name: any) => [`${value} 人`, name]}
                          contentStyle={{ borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Col>

              {/* 分数段标签展示 */}
              <Col xs={24} lg={12}>
                <Card
                  className="chart-card"
                  title={
                    <div className="dashboard-section-title">
                      <StarOutlined style={{ color: '#52c41a' }} />
                      分数段明细
                    </div>
                  }
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {scoreOverview.scoreBuckets.map((b) => {
                      const pct = scoreOverview.totalUsers > 0
                        ? Math.round((b.count / scoreOverview.totalUsers) * 100)
                        : 0;
                      return (
                        <div key={b.score_range} className="score-bucket">
                          <span style={{ minWidth: 80, fontWeight: 500, color: '#262626' }}>
                            {b.score_range} 分
                          </span>
                          <div className="bucket-bar">
                            <div
                              className="bucket-fill"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                background: pct > 50 ? '#52c41a' : pct > 20 ? '#faad14' : '#1890ff',
                              }}
                            />
                          </div>
                          <span style={{ minWidth: 50, textAlign: 'right', color: '#8c8c8c' }}>
                            {b.count} 人
                          </span>
                          <span style={{ minWidth: 36, textAlign: 'right', color: '#bfbfbf', fontSize: 12 }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </Space>
                  {scoreOverview.scoreBuckets.length === 0 && (
                    <Empty description="暂无分数段数据" style={{ padding: 20 }} />
                  )}
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* 评分模块错误状态 */}
      {scoreError && !scoreOverview && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card>
              <Empty description="评分数据加载失败，请刷新重试">
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => loadAll(true)}>
                  重新加载
                </Button>
              </Empty>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default DashboardPage;
