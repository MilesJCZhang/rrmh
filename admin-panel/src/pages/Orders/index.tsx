import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Space, Tag, DatePicker, Statistic, Row, Col, Modal, Descriptions, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getOrders, Order, OrderListResult, TypeStats } from '../../services/order.service';

const { RangePicker } = DatePicker;

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeStats, setTypeStats] = useState<TypeStats[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: limit };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const result: OrderListResult = await getOrders(params);
      setOrders(result.list || []);
      setTotal(result.total || 0);
      if (result.typeStats) setTypeStats(result.typeStats);
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter, statusFilter, startDate, endDate]);

  const handleViewDetail = (record: Order) => {
    setCurrentOrder(record);
    setDetailVisible(true);
  };

  const typeMap: Record<string, string> = {
    online_unlock_gold: '线上解锁(优质)',
    online_unlock_silver: '线上解锁(良好)',
    salon_signup: '沙龙报名',
    single_registration: '会员建档',
    partner_upgrade: '合伙人升级',
    partner_fee: '加盟费',
    station_fee: '驿站费',
    activity_fee: '活动费',
    registration: '报名费',
    recharge: '充值',
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待支付' },
    paid: { color: 'green', text: '已支付' },
    success: { color: 'green', text: '支付成功' },
    refunded: { color: 'red', text: '已退款' },
    cancelled: { color: 'default', text: '已取消' },
    failed: { color: 'red', text: '支付失败' },
    expired: { color: 'default', text: '已过期' },
    closed: { color: 'default', text: '已关闭' },
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '支付方式',
      dataIndex: 'payer_nickname',
      key: 'payer_nickname',
      render: (name: string) => name || '-',
    },
    {
      title: '订单类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => typeMap[type] || type,
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'total_fee',
      key: 'total_fee',
      width: 100,
      render: (fee: number) => <strong style={{ color: '#f5222d' }}>¥{Number(fee).toFixed(2)}</strong>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Order) => (
        <a onClick={() => handleViewDetail(record)}>详情</a>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="订单管理" subtitle="查看线上解锁、沙龙报名、建档等订单数据" />

      {/* 类型统计卡片 */}
      {typeStats.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {typeStats.map((stat) => (
              <Col span={6} key={stat.type}>
                <Statistic
                  title={typeMap[stat.type] || stat.type}
                  value={stat.count}
                  suffix={`笔 / ¥${Number(stat.total_amount).toFixed(2)}`}
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card>
        {/* 筛选控件 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>订单类型:</span>
            <Select
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
              style={{ width: 160 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="online_unlock_gold">线上解锁(优质)</Select.Option>
              <Select.Option value="online_unlock_silver">线上解锁(良好)</Select.Option>
              <Select.Option value="salon_signup">沙龙报名</Select.Option>
              <Select.Option value="single_registration">会员建档</Select.Option>
            </Select>

            <span style={{ marginLeft: 16 }}>状态:</span>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="pending">待支付</Select.Option>
              <Select.Option value="paid">已支付</Select.Option>
              <Select.Option value="refunded">已退款</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>

            <span style={{ marginLeft: 16 }}>日期范围:</span>
            <RangePicker
              onChange={(dates, dateStrings) => {
                setStartDate(dateStrings[0] || '');
                setEndDate(dateStrings[1] || '');
                setPage(1);
              }}
            />
          </Space>
        </div>

        <Table
          dataSource={orders}
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

      {/* 详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentOrder && (
          <Descriptions column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="订单ID">{currentOrder.id}</Descriptions.Item>
            <Descriptions.Item label="用户">{currentOrder.payer_nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单类型">
              {typeMap[currentOrder.type] || currentOrder.type}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[currentOrder.status]?.color || 'default'}>
                {statusMap[currentOrder.status]?.text || currentOrder.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <strong style={{ color: '#f5222d' }}>¥{Number(currentOrder.total_fee).toFixed(2)}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {currentOrder.created_at}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OrdersPage;
