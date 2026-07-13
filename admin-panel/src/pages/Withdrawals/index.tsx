import React, { useEffect, useState } from 'react';
import { Table, Tag, Modal, Button, message, Card, Descriptions, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DollarOutlined } from '@ant-design/icons';
import PageHeader from 'components/PageHeader';
import dayjs from 'dayjs';
import axios from '../../utils/axios.config';

interface WithdrawalRecord {
  id: number;
  userId: number;
  nickname: string;
  phone: string;
  amount: number;
  fee: number;
  actualAmount: number;
  account: string;
  accountName: string;
  bankName: string;
  method: string;
  status: string;
  created_at: string;
  remark?: string;
  processedAt?: string;
}

const statusNumMap: Record<string, number> = {
  pending: 0,
  processing: 1,
  success: 2,
  rejected: 3,
};

const numStatusMap: Record<number, { color: string; text: string }> = {
  0: { color: 'orange', text: '待处理' },
  1: { color: 'blue', text: '已打款' },
  2: { color: 'green', text: '已到账' },
  3: { color: 'red', text: '已拒绝' },
};

const stringStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待处理' },
  processing: { color: 'blue', text: '已打款' },
  success: { color: 'green', text: '已到账' },
  rejected: { color: 'red', text: '已拒绝' },
};

const WithdrawalsPage: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentWithdrawal, setCurrentWithdrawal] = useState<WithdrawalRecord | null>(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: limit };
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get('/api/admin/withdrawals', { params });
      const payload = res?.data || res || {};
      setWithdrawals(payload.list || []);
      setTotal(payload.pagination?.total || payload.total || 0);
    } catch (error) {
      message.error('获取提现申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [page, limit, statusFilter]);

  const handleViewDetail = (record: WithdrawalRecord) => {
    setCurrentWithdrawal(record);
    setDetailVisible(true);
  };

  const handleApprove = async (id: number, approved: boolean) => {
    const action = approved ? '通过' : '拒绝';
    Modal.confirm({
      title: `审核${action}`,
      content: `确定要${action}这个提现申请吗？`,
      onOk: async () => {
        try {
          await axios.put(`/api/admin/withdrawals/${id}/process`, {
            status: approved ? 'approved' : 'rejected',
          });
          message.success('操作成功');
          fetchWithdrawals();
          setDetailVisible(false);
        } catch (error: any) {
          message.error(error.response?.data?.message || error.message || '操作失败');
        }
      },
    });
  };

  const handleMarkPaid = (id: number) => {
    Modal.confirm({
      title: '标记已打款',
      content: '确定要标记这笔提现为已打款吗？',
      onOk: async () => {
        try {
          await axios.put(`/api/admin/withdrawals/${id}/process`, { status: 'approved' });
          message.success('已通过审核，可打款');
          fetchWithdrawals();
          setDetailVisible(false);
        } catch (error: any) {
          message.error(error.response?.data?.message || error.message || '操作失败');
        }
      },
    });
  };

  const getStatusConfig = (s: string | number) => {
    if (typeof s === 'number') return numStatusMap[s];
    return stringStatusMap[s] || { color: 'default', text: '未知' };
  };

  const getStatusNum = (s: string | number): number => {
    if (typeof s === 'number') return s;
    return statusNumMap[s] ?? -1;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户',
      key: 'userInfo',
      width: 160,
      render: (_: any, r: WithdrawalRecord) => (
        <div>
          <div>{r.nickname || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{r.phone ? `ID:${r.userId} | ${r.phone}` : `ID:${r.userId}`}</div>
        </div>
      ),
    },
    {
      title: '提现金额',
      key: 'amount',
      width: 120,
      render: (_: any, r: WithdrawalRecord) => (
        <strong style={{ color: '#f5222d' }}>¥{r.amount}</strong>
      ),
    },
    {
      title: '实际转账',
      key: 'actualAmount',
      width: 120,
      render: (_: any, r: WithdrawalRecord) => (
        <div>
          <strong style={{ color: '#52c41a' }}>¥{r.actualAmount || r.amount}</strong>
          {r.fee > 0 && <div style={{ fontSize: 12, color: '#999' }}>含手续费 ¥{r.fee}</div>}
        </div>
      ),
    },
    {
      title: '账户信息',
      key: 'accountInfo',
      width: 200,
      ellipsis: true,
      render: (_: any, r: WithdrawalRecord) => {
        const parts = [r.accountName, r.bankName, r.account].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : '-';
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, r: WithdrawalRecord) => {
        const config = getStatusConfig(r.status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '申请时间',
      key: 'createdAt',
      width: 170,
      render: (_: any, r: WithdrawalRecord) => {
        return r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: WithdrawalRecord) => {
        const sn = getStatusNum(record.status);
        return (
          <Space>
            <Button type="link" onClick={() => handleViewDetail(record)}>详情</Button>
            {sn === 0 && (
              <>
                <Button type="link" style={{ color: 'green' }} icon={<CheckCircleOutlined />} onClick={() => handleApprove(record.id, true)}>通过</Button>
                <Button type="link" danger icon={<CloseCircleOutlined />} onClick={() => handleApprove(record.id, false)}>拒绝</Button>
              </>
            )}
            {sn === 2 && (
              <Button type="link" icon={<DollarOutlined />} style={{ color: '#1890ff' }} onClick={() => handleMarkPaid(record.id)}>标记已打款</Button>
            )}
          </Space>
        );
      },
    },
  ];

  const statusFilters = [
    { text: '全部', value: undefined },
    { text: '待处理', value: 'pending' },
    { text: '已打款', value: 'processing' },
    { text: '已到账', value: 'success' },
    { text: '已拒绝', value: 'rejected' },
  ];

  return (
    <div>
      <PageHeader title="提现管理" subtitle="审核和管理提现申请" />

      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Space>
            {statusFilters.map((filter) => (
              <Button
                key={filter.text}
                type={statusFilter === filter.value ? 'primary' : 'default'}
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
              >
                {filter.text}
              </Button>
            ))}
          </Space>
        </div>

        <Table
          dataSource={withdrawals}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (newPage, newLimit) => {
              setPage(newPage);
              setLimit(newLimit);
            },
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title="提现申请详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentWithdrawal && (
          <Descriptions column={2} style={{ marginTop: '16px' }}>
            <Descriptions.Item label="ID">{currentWithdrawal.id}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{currentWithdrawal.userId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{currentWithdrawal.nickname}</Descriptions.Item>
            <Descriptions.Item label="手机号">{currentWithdrawal.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="提现金额">
              <strong style={{ color: '#f5222d', fontSize: '16px' }}>¥{currentWithdrawal.amount}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getStatusConfig(currentWithdrawal.status).color}>
                {getStatusConfig(currentWithdrawal.status).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="实际到账">
              ¥{currentWithdrawal.actualAmount || currentWithdrawal.amount}
            </Descriptions.Item>
            <Descriptions.Item label="手续费">
              ¥{currentWithdrawal.fee || 0}
            </Descriptions.Item>
            <Descriptions.Item label="账户信息" span={2}>
              {[currentWithdrawal.accountName, currentWithdrawal.bankName, currentWithdrawal.account].filter(Boolean).join(' / ') || '-'}
            </Descriptions.Item>
            {currentWithdrawal.remark && (
              <Descriptions.Item label="备注" span={2}>{currentWithdrawal.remark}</Descriptions.Item>
            )}
            {currentWithdrawal.processedAt && (
              <Descriptions.Item label="处理时间" span={2}>{currentWithdrawal.processedAt}</Descriptions.Item>
            )}
            <Descriptions.Item label="申请时间" span={2}>
              {currentWithdrawal.created_at ? dayjs(currentWithdrawal.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default WithdrawalsPage;
