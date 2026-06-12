import React, { useEffect, useState } from 'react';
import { Table, Tag, Modal, Button, message, Card, Descriptions, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getWithdrawals, approveWithdrawal, markWithdrawalPaid, Withdrawal } from '../../services/withdrawal.service';

const WithdrawalsPage: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentWithdrawal, setCurrentWithdrawal] = useState<Withdrawal | null>(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const result = await getWithdrawals({
        page,
        limit,
        status: statusFilter,
      });
      setWithdrawals(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取提现申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter]);

  const handleViewDetail = (record: Withdrawal) => {
    setCurrentWithdrawal(record);
    setDetailVisible(true);
  };

  const handleApprove = (id: number, approved: boolean) => {
    Modal.confirm({
      title: approved ? '审核通过' : '审核拒绝',
      content: `确定要${approved ? '通过' : '拒绝'}这个提现申请吗？`,
      onOk: async () => {
        try {
          await approveWithdrawal(id, approved);
          message.success('操作成功');
          fetchWithdrawals();
          setDetailVisible(false);
        } catch (error) {
          message.error('操作失败');
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
          await markWithdrawalPaid(id);
          message.success('标记成功');
          fetchWithdrawals();
          setDetailVisible(false);
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 100,
    },
    {
      title: '用户名',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: '手机号',
      dataIndex: 'userPhone',
      key: 'userPhone',
    },
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number) => <strong style={{ color: '#f5222d' }}>¥{amount}</strong>,
    },
    {
      title: '账户信息',
      dataIndex: 'accountInfo',
      key: 'accountInfo',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: number) => {
        const statusMap: { [key: number]: { color: string; text: string } } = {
          0: { color: 'orange', text: '待审核' },
          1: { color: 'blue', text: '已通过' },
          2: { color: 'green', text: '已打款' },
          3: { color: 'red', text: '已拒绝' },
        };
        const config = statusMap[status] || { color: 'default', text: '未知' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_: any, record: Withdrawal) => (
        <Space>
          <Button type="link" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 0 && (
            <>
              <Button
                type="link"
                style={{ color: 'green' }}
                onClick={() => handleApprove(record.id, true)}
              >
                通过
              </Button>
              <Button
                type="link"
                danger
                onClick={() => handleApprove(record.id, false)}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 1 && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkPaid(record.id)}
            >
              标记已打款
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const statusFilters = [
    { text: '全部', value: undefined },
    { text: '待审核', value: 0 },
    { text: '已通过', value: 1 },
    { text: '已打款', value: 2 },
    { text: '已拒绝', value: 3 },
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
            showTotal: (total) => `共 ${total} 条`,
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
            <Descriptions.Item label="用户名">{currentWithdrawal.userName}</Descriptions.Item>
            <Descriptions.Item label="手机号">{currentWithdrawal.userPhone}</Descriptions.Item>
            <Descriptions.Item label="提现金额">
              <strong style={{ color: '#f5222d', fontSize: '16px' }}>
                ¥{currentWithdrawal.amount}
              </strong>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={
                currentWithdrawal.status === 0 ? 'orange' :
                  currentWithdrawal.status === 1 ? 'blue' :
                    currentWithdrawal.status === 2 ? 'green' : 'red'
              }>
                {currentWithdrawal.status === 0 ? '待审核' :
                  currentWithdrawal.status === 1 ? '已通过' :
                    currentWithdrawal.status === 2 ? '已打款' : '已拒绝'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="账户信息" span={2}>
              {currentWithdrawal.accountInfo}
            </Descriptions.Item>
            {currentWithdrawal.remark && (
              <Descriptions.Item label="备注" span={2}>
                {currentWithdrawal.remark}
              </Descriptions.Item>
            )}
            {currentWithdrawal.processedAt && (
              <Descriptions.Item label="处理时间" span={2}>
                {currentWithdrawal.processedAt}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="申请时间" span={2}>
              {currentWithdrawal.createdAt}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default WithdrawalsPage;
