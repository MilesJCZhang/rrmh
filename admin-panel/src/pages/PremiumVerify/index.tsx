import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Modal, Input, Select, Space, message, Statistic, Row, Col, Tabs, Popconfirm } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import premiumService from '../../services/premium.service';

const { TabPane } = Tabs;
const { TextArea } = Input;

const PremiumVerifyPage: React.FC = () => {
  // === 高端验资 ===
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verifyTotal, setVerifyTotal] = useState(0);
  const [verifyPage, setVerifyPage] = useState(1);
  const [verifyStatus, setVerifyStatus] = useState<string>('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // === 基金托管 ===
  const [custodyList, setCustodyList] = useState<any[]>([]);
  const [custodyTotal, setCustodyTotal] = useState(0);
  const [custodyPage, setCustodyPage] = useState(1);
  const [custodyStatus, setCustodyStatus] = useState<string>('');
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [custodyStats, setCustodyStats] = useState<any>({});
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleType, setSettleType] = useState<'marriage' | 'refund'>('refund');

  const fetchVerifications = async (page = 1, status = '') => {
    setVerifyLoading(true);
    try {
      const res = await premiumService.getVerifications({ status: status || undefined, page, pageSize: 20 });
      if (res.code === 200 || res.code === 0) {
        setVerifications(res.data.list);
        setVerifyTotal(res.data.total);
        setVerifyPage(page);
      }
    } catch (error) {
      message.error('获取验资列表失败');
    } finally {
      setVerifyLoading(false);
    }
  };

  const fetchCustody = async (page = 1, status = '') => {
    setCustodyLoading(true);
    try {
      const res = await premiumService.getCustodyList({ status: status || undefined, page, pageSize: 20 });
      if (res.code === 200 || res.code === 0) {
        setCustodyList(res.data.list);
        setCustodyTotal(res.data.total);
        setCustodyPage(page);
        if (res.data.stats) setCustodyStats(res.data.stats);
      }
    } catch (error) {
      message.error('获取托管列表失败');
    } finally {
      setCustodyLoading(false);
    }
  };

  useEffect(() => { fetchVerifications(); fetchCustody(); }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await premiumService.reviewVerification(id, 'approve');
      if (res.code === 200 || res.code === 0) {
        message.success('审核通过');
        fetchVerifications(verifyPage, verifyStatus);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleReject = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    try {
      const res = await premiumService.reviewVerification(rejectingId, 'reject', rejectReason);
      if (res.code === 200 || res.code === 0) {
        message.success('已拒绝');
        setRejectModalVisible(false);
        fetchVerifications(verifyPage, verifyStatus);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSettle = (id: number) => {
    setSettlingId(id);
    setSettleType('refund');
    setSettleModalVisible(true);
  };

  const confirmSettle = async () => {
    if (!settlingId) return;
    try {
      const res = await premiumService.settleCustody(settlingId, settleType);
      if (res.code === 200 || res.code === 0) {
        message.success(res.message);
        setSettleModalVisible(false);
        fetchCustody(custodyPage, custodyStatus);
      }
    } catch (error) {
      message.error('结算失败');
    }
  };

  const statusMap: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: '待审核' },
    approved: { color: 'green', label: '已通过' },
    rejected: { color: 'red', label: '已拒绝' },
  };

  const custodyStatusMap: Record<string, { color: string; label: string }> = {
    active: { color: 'blue', label: '托管中' },
    settled: { color: 'green', label: '已结算' },
    refunded: { color: 'default', label: '已退款' },
  };

  const verifyColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户', dataIndex: 'nickname', key: 'nickname', width: 100 },
    { title: '验证类型', dataIndex: 'verify_type', key: 'verify_type', width: 80, render: (v: string) => v === 'online' ? '在线验证' : '线下验证' },
    { title: '资产类型', dataIndex: 'asset_type', key: 'asset_type', width: 100 },
    { title: '资产金额(元)', dataIndex: 'asset_amount', key: 'asset_amount', width: 100, render: (v: number) => v ? (v / 100).toLocaleString() : '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={statusMap[v]?.color || 'default'}>{statusMap[v]?.label || v}</Tag>,
    },
    { title: '申请时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: any) => record.status === 'pending' ? (
        <Space>
          <Popconfirm title="确认通过审核？" onConfirm={() => handleApprove(record.id)}>
            <Button size="small" type="primary" icon={<CheckCircleOutlined />}>通过</Button>
          </Popconfirm>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleReject(record.id)}>拒绝</Button>
        </Space>
      ) : <Tag>已处理</Tag>,
    },
  ];

  const custodyColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户', dataIndex: 'nickname', key: 'nickname', width: 100 },
    { title: '托管金额(元)', dataIndex: 'amount', key: 'amount', width: 110, render: (v: number) => (v / 100).toLocaleString() },
    { title: '服务费(元)', dataIndex: 'service_fee', key: 'service_fee', width: 100, render: (v: number) => (v / 100).toLocaleString() },
    { title: '托管年限', dataIndex: 'custody_years', key: 'custody_years', width: 80, render: (v: number) => `${v}年` },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={custodyStatusMap[v]?.color || 'default'}>{custodyStatusMap[v]?.label || v}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: unknown, record: any) => record.status === 'active' ? (
        <Button size="small" type="primary" onClick={() => handleSettle(record.id)}>结算</Button>
      ) : <Tag>已结算</Tag>,
    },
  ];

  return (
    <div>
      <PageHeader title="高端验资 & 基金托管" subtitle="验资审核 + 托管管理" />

      <Tabs defaultActiveKey="verify" onChange={(key) => { if (key === 'verify') fetchVerifications(); else fetchCustody(); }}>
        <TabPane tab="高端验资审核" key="verify">
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <span>状态筛选:</span>
              <Select style={{ width: 120 }} allowClear placeholder="全部" value={verifyStatus || undefined} onChange={(v) => { setVerifyStatus(v || ''); fetchVerifications(1, v || ''); }}>
                <Select.Option value="pending">待审核</Select.Option>
                <Select.Option value="approved">已通过</Select.Option>
                <Select.Option value="rejected">已拒绝</Select.Option>
              </Select>
            </Space>
          </Card>
          <Table
            dataSource={verifications}
            columns={verifyColumns}
            rowKey="id"
            loading={verifyLoading}
            pagination={{ current: verifyPage, total: verifyTotal, pageSize: 20, onChange: (p) => fetchVerifications(p, verifyStatus) }}
            size="small"
          />
        </TabPane>

        <TabPane tab="基金托管管理" key="custody">
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title="托管总笔数" value={custodyStats.total_count || 0} suffix="笔" /></Col>
              <Col span={6}><Statistic title="托管总金额" value={custodyStats.total_amount ? (custodyStats.total_amount / 100).toLocaleString() : 0} prefix="¥" /></Col>
              <Col span={6}><Statistic title="托管中金额" value={custodyStats.active_amount ? (custodyStats.active_amount / 100).toLocaleString() : 0} prefix="¥" /></Col>
              <Col span={6}><Statistic title="已结算金额" value={custodyStats.settled_amount ? (custodyStats.settled_amount / 100).toLocaleString() : 0} prefix="¥" /></Col>
            </Row>
          </Card>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <span>状态筛选:</span>
              <Select style={{ width: 120 }} allowClear placeholder="全部" value={custodyStatus || undefined} onChange={(v) => { setCustodyStatus(v || ''); fetchCustody(1, v || ''); }}>
                <Select.Option value="active">托管中</Select.Option>
                <Select.Option value="settled">已结算</Select.Option>
              </Select>
            </Space>
          </Card>
          <Table
            dataSource={custodyList}
            columns={custodyColumns}
            rowKey="id"
            loading={custodyLoading}
            pagination={{ current: custodyPage, total: custodyTotal, pageSize: 20, onChange: (p) => fetchCustody(p, custodyStatus) }}
            size="small"
          />
        </TabPane>
      </Tabs>

      {/* 拒绝弹窗 */}
      <Modal title="拒绝验资" open={rejectModalVisible} onOk={confirmReject} onCancel={() => setRejectModalVisible(false)} okText="确认拒绝">
        <div style={{ marginBottom: 8 }}>请输入拒绝原因：</div>
        <TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="请输入拒绝原因" />
      </Modal>

      {/* 结算弹窗 */}
      <Modal title="结算基金托管" open={settleModalVisible} onOk={confirmSettle} onCancel={() => setSettleModalVisible(false)} okText="确认结算">
        <div style={{ marginBottom: 16 }}>
          <p>结算类型：</p>
          <Space>
            <Button type={settleType === 'marriage' ? 'primary' : 'default'} onClick={() => setSettleType('marriage')}>
              结婚结算（扣1.5万服务费）
            </Button>
            <Button type={settleType === 'refund' ? 'primary' : 'default'} onClick={() => setSettleType('refund')}>
              到期退款（全额返还）
            </Button>
          </Space>
        </div>
        {settleType === 'marriage' ? (
          <p style={{ color: '#f5222d' }}>结婚结算：双方各扣15000元服务费，剩余本金原路返还</p>
        ) : (
          <p style={{ color: '#52c41a' }}>到期退款：10万元全额返还，不收费用</p>
        )}
      </Modal>
    </div>
  );
};

export default PremiumVerifyPage;
