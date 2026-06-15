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
  WechatOutlined,
  AlipayCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { financeService } from '../../services/finance.service';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Payments: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState({ userId: '', status: '', startDate: '', endDate: '' });
  const [searchForm] = Form.useForm();

  const loadList = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const result = await financeService.getPayments({
          page, pageSize,
          ...(searchParams.userId ? { userId: Number(searchParams.userId) } : {}),
          ...(searchParams.status ? { status: searchParams.status } : {}),
          ...(searchParams.startDate ? { startDate: searchParams.startDate } : {}),
          ...(searchParams.endDate ? { endDate: searchParams.endDate } : {}),
        });
        setDataSource(result.list || []);
        setPagination({ current: result.page || page, pageSize: result.pageSize || pageSize, total: result.total || 0 });
      } catch (error: any) {
        message.error('加载支付记录失败');
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => { loadList(); }, [loadList]);

  const handleSearch = (values: any) => {
    setSearchParams({
      userId: values.userId || '',
      status: values.status || '',
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || '',
    });
  };

  const handleReset = () => {
    searchForm.resetFields();
    setSearchParams({ userId: '', status: '', startDate: '', endDate: '' });
  };

  const channelMap: Record<string, { color: string; text: string }> = {
    wechat: { color: 'green', text: '微信支付' },
    alipay: { color: 'blue', text: '支付宝' },
  };

  const columns = [
    { title: '支付单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 160, ellipsis: true },
    {
      title: '用户',
      key: 'userInfo',
      render: (_: any, r: any) => (
        <div>
          <div><WechatOutlined /> {r.payerNickname || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>ID:{r.userId}</div>
        </div>
      ),
    },
    {
      title: '订单类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => {
        const m: Record<string, any> = { registration: { color: 'blue', text: '报名费' }, partner_fee: { color: 'green', text: '加盟费' }, station_fee: { color: 'cyan', text: '驿站费' }, activity: { color: 'purple', text: '活动费' }, single_registration: { color: 'blue', text: '报名费' } };
        const c = m[t] || { color: 'default', text: t };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '支付金额', dataIndex: 'totalFee', key: 'totalFee', render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>¥{v}</span> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const m: Record<string, any> = { paid: { color: 'success', text: '已支付' }, pending: { color: 'processing', text: '待支付' }, failed: { color: 'error', text: '支付失败' }, cancelled: { color: 'default', text: '已取消' } };
        const c = m[s] || { color: 'default', text: s };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '支付时间', dataIndex: 'payTime', key: 'payTime', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
  ];

  const stats = { total: pagination.total || 0, today: 0, wechat: 0, alipay: 0 };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>支付记录</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="支付总笔数" value={stats.total} prefix={<DollarOutlined style={{ color: '#f5222d' }} />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日支付" value={stats.today} prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="微信支付" value={stats.wechat} prefix={<WechatOutlined style={{ color: '#52c41a' }} />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="支付宝" value={stats.alipay} prefix={<AlipayCircleOutlined style={{ color: '#1890ff' }} />} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 24 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="userId" label="用户ID"><Input placeholder="用户ID" style={{ width: 120 }} /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部" style={{ width: 120 }} allowClear>
              <Option value="success">支付成功</Option><Option value="pending">支付中</Option><Option value="failed">支付失败</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="支付时间"><RangePicker /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" icon={<SearchOutlined />}>搜索</Button></Form.Item>
          <Form.Item><Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button></Form.Item>
        </Form>
      </Card>
      <Card>
        <Spin spinning={loading}>
          <Table
            scroll={{ y: 'calc(100vh - 300px)' }}
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条` }}
            onChange={(p) => loadList(p.current, p.pageSize)}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default Payments;
