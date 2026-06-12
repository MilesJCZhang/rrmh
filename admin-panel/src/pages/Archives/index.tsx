import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Input, Select, Space, Modal, Descriptions, Row, Col, Statistic, message, Tabs, Button } from 'antd';
import PageHeader from '../../components/PageHeader';
import commissionService from '../../services/commission.service';

const { TabPane } = Tabs;
const { Search } = Input;

const ArchivesPage: React.FC = () => {
  const [archives, setArchives] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scoreTier, setScoreTier] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const fetchData = async (p = 1, tier = scoreTier, kw = keyword) => {
    setLoading(true);
    try {
      const res = await commissionService.getArchives({ scoreTier: tier || undefined, keyword: kw || undefined, page: p, pageSize: 20 });
      if (res.code === 0) {
        setArchives(res.data.list);
        setTotal(res.data.total);
        setPage(p);
      }
    } catch (error) {
      message.error('获取档案列表失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const showDetail = async (userId: number) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await commissionService.getArchiveDetail(userId);
      if (res.code === 0) {
        setDetailData(res.data);
      }
    } catch (error) {
      message.error('获取档案详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const tierColorMap: Record<string, string> = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', unrated: '#999' };
  const tierLabelMap: Record<string, string> = { gold: '优质', silver: '良好', bronze: '基础', unrated: '未评分' };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 100 },
    { title: '性别', dataIndex: 'gender', key: 'gender', width: 60, render: (v: string) => v === 'male' ? '男' : v === 'female' ? '女' : '-' },
    { title: '角色', dataIndex: 'role', key: 'role', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '评分', dataIndex: 'total_score', key: 'total_score', width: 80,
      render: (v: number) => v ? <span style={{ fontWeight: 'bold', color: tierColorMap[v >= 80 ? 'gold' : v >= 60 ? 'silver' : 'bronze'] }}>{v}</span> : '-',
    },
    {
      title: '等级', dataIndex: 'score_tier', key: 'score_tier', width: 80,
      render: (v: string) => <Tag color={tierColorMap[v]}>{tierLabelMap[v] || v || '未评分'}</Tag>,
    },
    {
      title: '人脸认证', dataIndex: 'face_auth_status', key: 'face_auth_status', width: 80,
      render: (v: string) => v === 'verified' ? <Tag color="green">已认证</Tag> : <Tag>未认证</Tag>,
    },
    {
      title: '资产验证', dataIndex: 'asset_verified_status', key: 'asset_verified_status', width: 80,
      render: (v: string) => v === 'verified' ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag>,
    },
    { title: '建档时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: unknown, record: any) => (
        <Button type="link" size="small" onClick={() => showDetail(record.id)}>详情</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="档案管理" subtitle="用户建档资料 + 服务记录" />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Search
            placeholder="搜索昵称/手机号"
            allowClear
            style={{ width: 240 }}
            onSearch={(v) => { setKeyword(v); fetchData(1, scoreTier, v); }}
          />
          <span>评分等级:</span>
          <Select style={{ width: 120 }} allowClear placeholder="全部" value={scoreTier || undefined} onChange={(v) => { setScoreTier(v || ''); fetchData(1, v || '', keyword); }}>
            <Select.Option value="gold">优质(80+)</Select.Option>
            <Select.Option value="silver">良好(60-79)</Select.Option>
            <Select.Option value="bronze">基础(&lt;60)</Select.Option>
            <Select.Option value="unrated">未评分</Select.Option>
          </Select>
        </Space>
      </Card>

      <Table
        dataSource={archives}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => fetchData(p) }}
        size="small"
        scroll={{ x: 1000 }}
      />

      {/* 详情弹窗 */}
      <Modal
        title="用户档案详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>加载中...</div>
        ) : detailData ? (
          <Tabs defaultActiveKey="profile">
            <TabPane tab="基本信息" key="profile">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="昵称">{detailData.user?.nickname}</Descriptions.Item>
                <Descriptions.Item label="性别">{detailData.user?.gender === 'male' ? '男' : detailData.user?.gender === 'female' ? '女' : '-'}</Descriptions.Item>
                <Descriptions.Item label="手机">{detailData.user?.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="角色">{detailData.user?.role}</Descriptions.Item>
                <Descriptions.Item label="评分">
                  <span style={{ color: tierColorMap[detailData.user?.score_tier], fontWeight: 'bold' }}>
                    {detailData.user?.total_score || 0}分 ({tierLabelMap[detailData.user?.score_tier] || '未评分'})
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="人脸认证">{detailData.user?.face_auth_status === 'verified' ? '已认证' : '未认证'}</Descriptions.Item>
              </Descriptions>

              {detailData.user?.total_score > 0 && (
                <Card title="评分详情" size="small" style={{ marginTop: 16 }}>
                  <Row gutter={16}>
                    <Col span={4}><Statistic title="基础" value={detailData.user?.basic_score || 0} suffix="/40" /></Col>
                    <Col span={4}><Statistic title="职业" value={detailData.user?.career_score || 0} suffix="/15" /></Col>
                    <Col span={4}><Statistic title="爱好" value={detailData.user?.hobby_score || 0} suffix="/15" /></Col>
                    <Col span={4}><Statistic title="择偶" value={detailData.user?.preference_score || 0} suffix="/10" /></Col>
                    <Col span={4}><Statistic title="认证" value={detailData.user?.verification_score || 0} suffix="/12" /></Col>
                    <Col span={4}><Statistic title="资产" value={detailData.user?.asset_score || 0} suffix="/8" /></Col>
                  </Row>
                </Card>
              )}
            </TabPane>

            <TabPane tab="高端验资" key="premium">
              {detailData.premiumVerifications?.length > 0 ? (
                <Table
                  dataSource={detailData.premiumVerifications}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '类型', dataIndex: 'verify_type', render: (v: string) => v === 'online' ? '在线' : '线下' },
                    { title: '资产类型', dataIndex: 'asset_type' },
                    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'approved' ? 'green' : v === 'pending' ? 'orange' : 'red'}>{v}</Tag> },
                    { title: '时间', dataIndex: 'created_at' },
                  ]}
                />
              ) : <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>暂无验资记录</div>}
            </TabPane>

            <TabPane tab="基金托管" key="custody">
              {detailData.custodyRecords?.length > 0 ? (
                <Table
                  dataSource={detailData.custodyRecords}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '托管金额', dataIndex: 'amount', render: (v: number) => `¥${(v / 100).toLocaleString()}` },
                    { title: '年限', dataIndex: 'custody_years', render: (v: number) => `${v}年` },
                    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'active' ? 'blue' : 'green'}>{v}</Tag> },
                    { title: '时间', dataIndex: 'created_at' },
                  ]}
                />
              ) : <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>暂无托管记录</div>}
            </TabPane>

            <TabPane tab="订单记录" key="orders">
              {detailData.orders?.length > 0 ? (
                <Table
                  dataSource={detailData.orders}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '类型', dataIndex: 'type' },
                    { title: '金额', dataIndex: 'total_fee', render: (v: number) => `¥${v}` },
                    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'paid' ? 'green' : 'orange'}>{v}</Tag> },
                    { title: '时间', dataIndex: 'created_at' },
                  ]}
                />
              ) : <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>暂无订单记录</div>}
            </TabPane>
          </Tabs>
        ) : null}
      </Modal>
    </div>
  );
};

export default ArchivesPage;
