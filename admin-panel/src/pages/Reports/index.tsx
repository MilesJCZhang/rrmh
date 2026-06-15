import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  message,
} from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { financeService } from '../../services/finance.service';

interface Summary {
  totalEarnings: number;
  todayEarnings: number;
  pendingEarnings: number;
  totalPayments: number;
  todayPayments: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await financeService.getSummary();
      // TS 后端返回 { code: 200, data: { totalEarnings, todayEarnings, totalPayments, totalWithdrawals, pendingWithdrawals } }
      // axios interceptor 返回 response.data，即 { code, data }
      if (res.code === 200 && res.data) {
        const d = res.data;
        setSummary({
          totalEarnings: d.totalEarnings || 0,
          todayEarnings: d.todayEarnings || 0,
          pendingEarnings: d.pendingWithdrawals || 0,
          totalPayments: d.totalPayments || 0,
          todayPayments: 0,
          totalWithdrawals: d.totalWithdrawals || 0,
          pendingWithdrawals: d.pendingWithdrawals || 0,
        });
      } else {
        message.error(res.message || '加载失败');
      }
    } catch (err: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!summary) {
    return <div style={{ padding: 24, textAlign: 'center' }}>暂无数据</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据报表</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="累计收益" value={summary.totalEarnings} prefix={<DollarOutlined style={{ color: '#f5222d' }} />} precision={2} suffix="元" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="今日收益" value={summary.todayEarnings} prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />} precision={2} suffix="元" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="待结算收益" value={summary.pendingEarnings} prefix={<HeartOutlined style={{ color: '#faad14' }} />} precision={2} suffix="元" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="累计支付金额" value={summary.totalPayments} prefix={<DollarOutlined style={{ color: '#52c41a' }} />} precision={2} suffix="元" /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="今日支付" value={summary.todayPayments} prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />} precision={2} suffix="元" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="提现待处理" value={summary.pendingWithdrawals} prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="累计已打款金额" value={summary.totalWithdrawals} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} precision={2} suffix="元" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="累计提现申请金额" value={summary.pendingWithdrawals + summary.totalWithdrawals} prefix={<DollarOutlined style={{ color: '#ff6b9d' }} />} precision={2} suffix="元" /></Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;