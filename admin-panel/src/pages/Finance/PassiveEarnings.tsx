import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Form,
  Tag,
  message,
  DatePicker,
  Row,
  Col,
  Spin,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  GiftOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { financeService } from '../../services/finance.service';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const PassiveEarnings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState({ userId: '', startDate: '', endDate: '' });
  const [searchForm] = Form.useForm();

  const loadList = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const result = await financeService.getPassiveEarnings({
          page,
          pageSize,
          ...(searchParams.userId ? { userId: Number(searchParams.userId) } : {}),
          ...(searchParams.startDate ? { startDate: searchParams.startDate } : {}),
          ...(searchParams.endDate ? { endDate: searchParams.endDate } : {}),
        });
        setDataSource(result.list || []);
        setPagination({ current: result.page || page, pageSize: result.pageSize || pageSize, total: result.total || 0 });
      } catch (error: any) {
        console.error('加载被动收益失败:', error);
        message.error('加载数据失败');
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
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || '',
    });
  };

  const handleReset = () => {
    searchForm.resetFields();
    setSearchParams({ userId: '', startDate: '', endDate: '' });
  };

  const columns = [
    { title: '收益单号', dataIndex: 'id', key: 'id', width: 100 },
    {
      title: '用户',
      key: 'userInfo',
      render: (_: any, record: any) => (
        <div>
          <div><GiftOutlined /> {record.userNickname || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>ID:{record.userId}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="orange">{type === 'passive' ? '被动收益' : type}</Tag>,
    },
    { title: '被动收益', dataIndex: 'amount', key: 'amount', render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>¥{v}</span> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'confirmed' ? 'success' : s === 'pending' ? 'processing' : 'default'}>{s === 'confirmed' ? '已确认' : s === 'pending' ? '待确认' : s}</Tag>,
    },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>被动收益</h2>
      <Alert
        message="被动收益说明"
        description="被动收益是指推荐官通过加盟商、驿站等渠道获得的分成收益，系统按预设比例自动计算。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />
      <Card style={{ marginBottom: 24 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="userId" label="用户ID"><Input placeholder="用户ID" style={{ width: 120 }} /></Form.Item>
          <Form.Item name="dateRange" label="时间范围"><RangePicker /></Form.Item>
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

export default PassiveEarnings;
