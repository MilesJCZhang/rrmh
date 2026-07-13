import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Modal, Input, Select, Space, message, Image, Row, Col, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import verificationService, { Verification, VerificationStats } from '../../services/verification.service';

const { TextArea } = Input;

const VerificationsPage: React.FC = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<VerificationStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<Verification | null>(null);

  // 审核弹窗
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewRemark, setReviewRemark] = useState('');

  const fetchList = async (p = 1, s = '') => {
    setLoading(true);
    try {
      const res = await verificationService.getVerifications({ page: p, pageSize: 20, status: s || undefined });
      setVerifications(res.list);
      setTotal(res.total);
      setPage(p);
      setStatus(s);
    } catch (error) {
      message.error('获取认证列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const s = await verificationService.getVerificationStats();
      setStats(s);
    } catch (error) {
      console.error('获取统计失败', error);
    }
  };

  useEffect(() => {
    fetchList();
    fetchStats();
  }, []);

  const handleViewDetail = (item: Verification) => {
    setCurrentItem(item);
    setDetailVisible(true);
  };

  const handleOpenReview = (item: Verification, action: 'approved' | 'rejected') => {
    setReviewingId(item.user_id);
    setReviewStatus(action);
    setReviewRemark('');
    setReviewModalVisible(true);
  };

  const handleReview = async () => {
    if (!reviewingId) return;
    try {
      await verificationService.reviewVerification(reviewingId, reviewStatus, reviewRemark || undefined);
      message.success(reviewStatus === 'approved' ? '已通过' : '已拒绝');
      setReviewModalVisible(false);
      fetchList(page, status);
      fetchStats();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80,
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_: any, record: Verification) => (
        <Space direction="vertical" size={0}>
          <span>{record.user_nickname || '-'}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.user_phone || '-'}</span>
        </Space>
      ),
    },
    {
      title: '真实姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 80,
      render: (v: string) => v || '-',
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      width: 180,
      render: (v: string) => v || '-',
    },
    {
      title: '认证类型',
      dataIndex: 'verify_type',
      key: 'verify_type',
      width: 100,
      render: (v: string) => v === 'online' ? '在线认证' : '线下认证',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const map: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待审核' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' },
          none: { color: 'default', text: '未认证' },
        };
        const m = map[s] || map.none;
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Verification) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleOpenReview(record, 'approved')}>
                通过
              </Button>
              <Button type="link" danger icon={<CloseCircleOutlined />} onClick={() => handleOpenReview(record, 'rejected')}>
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="实名认证审核" subtitle="审核用户提交的实名认证材料" />

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总申请数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Select
              style={{ width: 120 }}
              allowClear
              placeholder="全部状态"
              value={status || undefined}
              onChange={(v) => fetchList(1, v || '')}
            >
              <Select.Option value="pending">待审核</Select.Option>
              <Select.Option value="approved">已通过</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
              <Select.Option value="none">未认证</Select.Option>
            </Select>
          </Space>
        </div>

        <Table
          dataSource={verifications}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => fetchList(p, status),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="认证详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentItem && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>用户ID：</strong>{currentItem.user_id}</p>
                <p><strong>昵称：</strong>{currentItem.user_nickname || '-'}</p>
                <p><strong>手机：</strong>{currentItem.user_phone || '-'}</p>
                <p><strong>真实姓名：</strong>{currentItem.real_name || '-'}</p>
                <p><strong>身份证号：</strong>{currentItem.id_card || '-'}</p>
                <p><strong>认证类型：</strong>{currentItem.verify_type === 'online' ? '在线认证' : '线下认证'}</p>
                <p><strong>状态：</strong>
                  {currentItem.status === 'pending' ? '待审核' :
                   currentItem.status === 'approved' ? '已通过' :
                   currentItem.status === 'rejected' ? '已拒绝' : '未认证'}
                </p>
                <p><strong>提交时间：</strong>{currentItem.created_at}</p>
                {currentItem.reject_reason && (
                  <p><strong>拒绝原因：</strong>{currentItem.reject_reason}</p>
                )}
              </Col>
              <Col span={12}>
                {currentItem.id_card_front && (
                  <div style={{ marginBottom: 8 }}>
                    <p><strong>身份证正面：</strong></p>
                    <Image src={currentItem.id_card_front} width={200} />
                  </div>
                )}
                {currentItem.id_card_back && (
                  <div style={{ marginBottom: 8 }}>
                    <p><strong>身份证背面：</strong></p>
                    <Image src={currentItem.id_card_back} width={200} />
                  </div>
                )}
                {currentItem.face_image && (
                  <div>
                    <p><strong>人脸照片：</strong></p>
                    <Image src={currentItem.face_image} width={200} />
                  </div>
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 审核弹窗 */}
      <Modal
        title={reviewStatus === 'approved' ? '确认通过' : '确认拒绝'}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleReview}
        okText="确认"
        cancelText="取消"
      >
        {reviewStatus === 'rejected' && (
          <div style={{ marginBottom: 16 }}>
            <p>请输入拒绝原因：</p>
            <TextArea
              rows={3}
              value={reviewRemark}
              onChange={(e) => setReviewRemark(e.target.value)}
              placeholder="选填"
            />
          </div>
        )}
        {reviewStatus === 'approved' && <p>确认通过该用户的实名认证申请？</p>}
      </Modal>
    </div>
  );
};

export default VerificationsPage;
