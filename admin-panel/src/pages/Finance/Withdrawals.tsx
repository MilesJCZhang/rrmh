import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Statistic,
  Row,
  Col,
  Space,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { financeService } from '../../services/finance.service';

const { Option } = Select;

const FinanceWithdrawals: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState({ status: '', keyword: '' });
  const [searchForm] = Form.useForm();
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | 'paid' | null>(null);
  const [reviewRemark, setReviewRemark] = useState('');

  const loadList = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const result = await financeService.getWithdrawals({
          page, pageSize,
          ...(searchParams.status ? { status: searchParams.status } : {}),
          ...(searchParams.keyword ? { keyword: searchParams.keyword } : {}),
        });
        setDataSource(result.list || []);
        setPagination({ current: result.page || page, pageSize: result.pageSize || pageSize, total: result.total || 0 });
      } catch (error: any) {
        message.error('加载提现记录失败');
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => { loadList(); }, [loadList]);

  const handleSearch = (values: any) => {
    setSearchParams({ status: values.status || '', keyword: values.keyword || '' });
  };

  const handleReset = () => {
    searchForm.resetFields();
    setSearchParams({ status: '', keyword: '' });
  };

  const handleOpenReview = (record: any, action: 'approved' | 'rejected' | 'paid') => {
    setReviewItem(record);
    setReviewAction(action);
    setReviewRemark('');
    setReviewVisible(true);
  };

  const handleReview = async () => {
    if (!reviewItem || !reviewAction) return;
    setReviewLoading(true);
    try {
      await financeService.processWithdrawal(reviewItem.id, { status: reviewAction, remark: reviewRemark });
      message.success(reviewAction === 'paid' ? '已标记打款' : reviewAction === 'approved' ? '已通过审核' : '已拒绝提现');
      setReviewVisible(false);
      loadList(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.message || '审核操作失败');
    } finally {
      setReviewLoading(false);
    }
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待处理' },
    approved: { color: 'blue', text: '已批准' },
    rejected: { color: 'red', text: '已拒绝' },
    paid: { color: 'green', text: '已打款' },
  };

  const columns = [
    { title: '提现单号', dataIndex: 'id', key: 'id', width: 100 },
    {
      title: '用户',
      key: 'userInfo',
      render: (_: any, r: any) => (
        <div>
          <div><DollarOutlined /> {r.userNickname || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>ID:{r.userId}</div>
        </div>
      ),
    },
    { title: '提现金额', dataIndex: 'amount', key: 'amount', render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 500 }}>¥{v}</span> },
    { title: '账户信息', dataIndex: 'account', key: 'account', ellipsis: true, render: (v: string, r: any) => v || r.bankName || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const c = statusMap[s] || { color: 'default', text: s };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: any) => (
        <Space>
          {r.status === 'pending' && (
            <>
              <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => handleOpenReview(r, 'approved')}>通过</Button>
              <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => handleOpenReview(r, 'rejected')}>拒绝</Button>
            </>
          )}
          {r.status === 'approved' && (
            <Button type="text" icon={<DollarOutlined />} style={{ color: '#1890ff' }} onClick={() => handleOpenReview(r, 'paid')}>标记打款</Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = { total: pagination.total || 0, pending: 0, approved: 0, success: 0, rejected: 0 };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>提现管理</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="总提现笔数" value={stats.total} prefix={<DollarOutlined style={{ color: '#f5222d' }} />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="待处理" value={stats.pending} prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="已到账" value={stats.success} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="已拒绝" value={stats.rejected} prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 24 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" label="关键词"><Input placeholder="昵称/手机号" prefix={<SearchOutlined />} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部" style={{ width: 120 }} allowClear>
              <Option value="pending">待处理</Option><Option value="processing">处理中</Option><Option value="success">已到账</Option><Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
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
      <Modal
        title={reviewAction === 'paid' ? '确认标记打款' : reviewAction === 'approved' ? '确认通过提现' : '确认拒绝提现'}
        open={reviewVisible}
        onCancel={() => setReviewVisible(false)}
        onOk={handleReview}
        okText="确认"
        cancelText="取消"
        confirmLoading={reviewLoading}
        okButtonProps={{ danger: reviewAction === 'rejected' }}
      >
        {reviewItem && (
          <div style={{ marginBottom: 16 }}>
            <p>用户: <strong>{reviewItem.userNickname}</strong></p>
            <p>提现金额: <strong>¥{reviewItem.amount}</strong></p>
            <p>账户: <strong>{reviewItem.account || '-'}</strong></p>
          </div>
        )}
        {reviewAction === 'rejected' && <div style={{ color: '#f5222d', fontSize: 12 }}><ExclamationCircleOutlined /> 请确认该提现申请存在问题，谨慎操作</div>}
      </Modal>
    </div>
  );
};

export default FinanceWithdrawals;
