import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Tag,
  Form,
  message,
  DatePicker,
  Statistic,
  Row,
  Col,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DollarOutlined,
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  GiftOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { financeService } from '../../services/finance.service';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Earnings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [searchParams, setSearchParams] = useState({
    userId: '',
    type: '',
    startDate: '',
    endDate: '',
  });
  const [searchForm] = Form.useForm();
  const [earningsStats, setEarningsStats] = useState({ today: 0, settled: 0, pending: 0 });

  const loadList = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const res = await financeService.getEarnings({
          page,
          pageSize,
          ...(searchParams.userId ? { userId: Number(searchParams.userId) } : {}),
          ...(searchParams.type ? { type: searchParams.type } : {}),
          ...(searchParams.startDate ? { startDate: searchParams.startDate } : {}),
          ...(searchParams.endDate ? { endDate: searchParams.endDate } : {}),
        });
        // axios interceptor 返回 response.data，所以 res = { code:200, data:{...}, message:"..." }
        const result = res.data || res;
        setDataSource(result.list || []);
        const pag = result.pagination || {};
        setPagination({
          current: pag.page || page,
          pageSize: pag.pageSize || pageSize,
          total: pag.total || 0,
        });
        if (result.stats) setEarningsStats(result.stats);
      } catch (error: any) {
        console.error('加载收益明细失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSearch = (values: any) => {
    const startDate = values.dateRange?.[0]?.format('YYYY-MM-DD');
    const endDate = values.dateRange?.[1]?.format('YYYY-MM-DD');
    setSearchParams({
      userId: values.userId || '',
      type: values.type || '',
      startDate: startDate || '',
      endDate: endDate || '',
    });
  };

  const handleReset = () => {
    searchForm.resetFields();
    setSearchParams({ userId: '', type: '', startDate: '', endDate: '' });
  };

  const handleTableChange = (paginationConfig: any) => {
    loadList(paginationConfig.current, paginationConfig.pageSize);
  };

  const typeMap: Record<string, { color: string; text: string }> = {
    recommend_single: { color: 'blue', text: '推荐单身会员' },
    recommend_matchmaker: { color: 'green', text: '推荐媒婆' },
    recommend_station: { color: 'cyan', text: '推荐驿站' },
    recommend_franchisee: { color: 'purple', text: '推荐加盟商' },
    passive: { color: 'orange', text: '被动收益' },
    activity: { color: 'pink', text: '活动收益' },
    other: { color: 'default', text: '其他' },
  };

  const columns = [
    { title: '收益单号', dataIndex: 'id', key: 'id', width: 100 },
    {
      title: '用户',
      key: 'userInfo',
      render: (_: any, record: any) => (
        <div>
          <div><UserOutlined /> <span style={{ color: '#1890ff' }}>{record.userWechat || '-'}</span></div>
          <div style={{ fontSize: 12, color: '#999' }}>ID:{record.userId}</div>
        </div>
      ),
    },
    {
      title: '实名认证',
      key: 'verification',
      width: 100,
      render: (_: any, record: any) => {
        const name = record.verifiedRealName || record.userRealName || '';
        const verified = record.verificationStatus === 'verified' || record.verificationStatus === 'approved';
        return name ? (
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <Tag color={verified ? 'success' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
              {verified ? '已认证' : '未认证'}
            </Tag>
          </div>
        ) : <span style={{ color: '#999' }}>-</span>;
      },
    },
    {
      title: '收益类型',
      key: 'type',
      render: (_: any, record: any) => {
        const displayName = record.type_name || record.type || '-';
        const config = typeMap[record.type] || { color: 'default', text: displayName };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>¥{amount}</span>,
    },
    {
      title: '分成比例',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate: number) => rate > 0 ? <Tag color="blue">{(rate * 100).toFixed(0)}%</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'confirmed' ? 'success' : status === 'pending' ? 'processing' : 'default'}>
          {status === 'confirmed' ? '已确认' : status === 'pending' ? '待确认' : status}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const stats = {
    total: pagination.total || 0,
    today: earningsStats.today,
    settled: earningsStats.settled,
    pending: earningsStats.pending,
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>收益明细</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="总收益笔数" value={stats.total} prefix={<DollarOutlined style={{ color: '#f5222d' }} />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="今日收益" value={stats.today} prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="已结算" value={stats.settled} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="待结算" value={stats.pending} prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="userId" label="用户ID">
            <Input placeholder="用户ID" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="type" label="收益类型">
            <Select placeholder="全部" style={{ width: 140 }} allowClear>
              <Option value="recommend_single">推荐单身会员</Option>
              <Option value="recommend_matchmaker">推荐媒婆</Option>
              <Option value="recommend_station">推荐驿站</Option>
              <Option value="recommend_franchisee">推荐加盟商</Option>
              <Option value="passive">被动收益</Option>
              <Option value="activity">活动收益</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="时间范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>搜索</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Spin spinning={loading}>
          <Table
            scroll={{ y: 'calc(100vh - 300px)' }}
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={handleTableChange}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default Earnings;
