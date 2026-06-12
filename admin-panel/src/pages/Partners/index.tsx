import React, { useEffect, useState } from 'react';
import { Table, Tag, Modal, Button, message, Card, Descriptions, Tabs, Space } from 'antd';
import PageHeader from '../../components/PageHeader';
import { getPartners, getPartnerDetail, approvePartner, getPartnerEarnings, Partner, PartnerEarning } from '../../services/partner.service';

const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(null);
  const [earnings, setEarnings] = useState<PartnerEarning[]>([]);
  const [earningsTotal, setEarningsTotal] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const result = await getPartners({
        page,
        limit,
        status: statusFilter,
      });
      setPartners(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取合伙人列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter]);

  const handleViewDetail = async (record: Partner) => {
    try {
      const detail = await getPartnerDetail(record.id);
      setCurrentPartner(detail);

      // 获取收益记录
      const earningsResult = await getPartnerEarnings(record.id);
      setEarnings(earningsResult.list);
      setEarningsTotal(earningsResult.total);

      setDetailVisible(true);
    } catch (error) {
      message.error('获取合伙人详情失败');
    }
  };

  const handleApprove = (id: number, approved: boolean) => {
    Modal.confirm({
      title: approved ? '审核通过' : '审核拒绝',
      content: `确定要${approved ? '通过' : '拒绝'}这个合伙人的申请吗？`,
      onOk: async () => {
        try {
          await approvePartner(id, approved);
          message.success('操作成功');
          fetchPartners();
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
      title: '服务站',
      dataIndex: 'stationName',
      key: 'stationName',
    },
    {
      title: '总收益',
      dataIndex: 'totalEarnings',
      key: 'totalEarnings',
      width: 120,
      render: (amount: number) => `¥${amount}`,
    },
    {
      title: '待结算',
      dataIndex: 'pendingEarnings',
      key: 'pendingEarnings',
      width: 120,
      render: (amount: number) => `¥${amount}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => {
        const statusMap: { [key: number]: { color: string; text: string } } = {
          0: { color: 'orange', text: '待审核' },
          1: { color: 'green', text: '已通过' },
          2: { color: 'red', text: '已拒绝' },
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
      width: 250,
      render: (_: any, record: Partner) => (
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
        </Space>
      ),
    },
  ];

  const statusFilters = [
    { text: '全部', value: undefined },
    { text: '待审核', value: 0 },
    { text: '已通过', value: 1 },
    { text: '已拒绝', value: 2 },
  ];

  return (
    <div>
      <PageHeader title="合伙人管理" subtitle="审核和管理合伙人" />

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
          dataSource={partners}
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
        title="合伙人详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {currentPartner && (
          <Tabs defaultActiveKey="info">
            <Tabs.TabPane tab="基本信息" key="info">
              <Descriptions column={2} style={{ marginTop: '16px' }}>
                <Descriptions.Item label="ID">{currentPartner.id}</Descriptions.Item>
                <Descriptions.Item label="用户ID">{currentPartner.userId}</Descriptions.Item>
                <Descriptions.Item label="用户名">{currentPartner.userName}</Descriptions.Item>
                <Descriptions.Item label="手机号">{currentPartner.userPhone}</Descriptions.Item>
                <Descriptions.Item label="服务站">{currentPartner.stationName}</Descriptions.Item>
                <Descriptions.Item label="总收益">¥{currentPartner.totalEarnings}</Descriptions.Item>
                <Descriptions.Item label="待结算">¥{currentPartner.pendingEarnings}</Descriptions.Item>
                <Descriptions.Item label="申请时间">{currentPartner.createdAt}</Descriptions.Item>
              </Descriptions>
            </Tabs.TabPane>
            <Tabs.TabPane tab="收益记录" key="earnings">
              <Table
                dataSource={earnings}
                rowKey="id"
                pagination={false}
                style={{ marginTop: '16px' }}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (amount: number) => `¥${amount}`,
                  },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (type: number) => (type === 1 ? '推荐奖励' : '其他'),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status: number) => (
                      <Tag color={status === 1 ? 'green' : 'orange'}>
                        {status === 1 ? '已结算' : '待结算'}
                      </Tag>
                    ),
                  },
                  { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
                ]}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
};

export default PartnersPage;
