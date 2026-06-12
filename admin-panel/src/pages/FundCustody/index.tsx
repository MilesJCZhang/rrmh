import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Space, Tag, Modal, Button, message, Statistic, Row, Col, Descriptions } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getFundCustodyList, settleFundCustody, FundCustody, FundCustodyListResult, FundCustodyStats } from '../../services/fund-custody.service';

const FundCustodyPage: React.FC = () => {
  const [list, setList] = useState<FundCustody[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<FundCustodyStats | null>(null);
  const [settleVisible, setSettleVisible] = useState(false);
  const [settleRecord, setSettleRecord] = useState<FundCustody | null>(null);
  const [settleType, setSettleType] = useState<'marriage' | 'refund'>('marriage');

  const fetchList = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: limit };
      if (statusFilter !== 'all') params.status = statusFilter;

      const result: FundCustodyListResult = await getFundCustodyList(params);
      setList(result.list || []);
      setTotal(result.total || 0);
      if (result.stats) setStats(result.stats);
    } catch (error) {
      message.error('获取托管列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter]);

  const handleSettle = (record: FundCustody) => {
    setSettleRecord(record);
    setSettleType('marriage');
    setSettleVisible(true);
  };

  const confirmSettle = async () => {
    if (!settleRecord) return;
    try {
      const result = await settleFundCustody(settleRecord.id, settleType);
      message.success(settleType === 'marriage' ? '结婚结算完成' : '到期退款完成');
      setSettleVisible(false);
      fetchList();
    } catch (error: any) {
      message.error(error.response?.data?.message || '结算失败');
    }
  };

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      active: { color: 'green', text: '托管中' },
      settled: { color: 'blue', text: '已结算' },
    };
    const config = map[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户', dataIndex: 'nickname', key: 'nickname', render: (v: string) => v || '-' },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '托管金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => <strong style={{ color: '#f5222d' }}>¥{v / 100}</strong>,
    },
    {
      title: '服务费',
      dataIndex: 'service_fee',
      key: 'service_fee',
      width: 100,
      render: (v: number) => v ? `¥${v / 100}` : '-',
    },
    {
      title: '退款金额',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      width: 100,
      render: (v: number) => v ? `¥${v / 100}` : '-',
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => statusTag(v) },
    {
      title: '结算类型',
      dataIndex: 'settle_type',
      key: 'settle_type',
      width: 100,
      render: (v: string) => (v === 'marriage' ? '结婚结算' : v === 'refund' ? '到期退款' : '-'),
    },
    { title: '托管时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    { title: '结算时间', dataIndex: 'settled_at', key: 'settled_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: FundCustody) => (
        record.status === 'active' ? (
          <Button type="link" onClick={() => handleSettle(record)}>结算</Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="基金托管" subtitle="管理用户基金托管记录，支持结婚结算和到期退款" />

      {/* 统计卡片 */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总笔数" value={stats.total_count} />
            </Col>
            <Col span={6}>
              <Statistic title="总托管金额" value={stats.total_amount / 100} prefix="¥" />
            </Col>
            <Col span={6}>
              <Statistic title="托管中金额" value={stats.active_amount / 100} prefix="¥" valueStyle={{ color: '#3f8600' }} />
            </Col>
            <Col span={6}>
              <Statistic title="已结算金额" value={stats.settled_amount / 100} prefix="¥" valueStyle={{ color: '#1890ff' }} />
            </Col>
          </Row>
        </Card>
      )}

      <Card>
        {/* 筛选控件 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>状态:</span>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="active">托管中</Select.Option>
              <Select.Option value="settled">已结算</Select.Option>
            </Select>
          </Space>
        </div>

        <Table
          dataSource={list}
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

      {/* 结算确认弹窗 */}
      <Modal
        title="确认结算"
        open={settleVisible}
        onOk={confirmSettle}
        onCancel={() => setSettleVisible(false)}
      >
        {settleRecord && (
          <div style={{ marginTop: 16 }}>
            <p>托管金额: <strong>¥{settleRecord.amount / 100}</strong></p>
            <Select
              value={settleType}
              onChange={(v) => setSettleType(v)}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Select.Option value="marriage">结婚结算（扣除服务费 ¥{settleRecord.service_fee / 100}）</Select.Option>
              <Select.Option value="refund">到期退款（全额退款 ¥{settleRecord.amount / 100}）</Select.Option>
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FundCustodyPage;
