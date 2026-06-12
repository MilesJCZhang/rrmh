import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Select, Space, message } from 'antd';
import PageHeader from '../../components/PageHeader';
import commissionService from '../../services/commission.service';

const CommissionsPage: React.FC = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ payType?: string; status?: string }>({});
  const [referrerSummary, setReferrerSummary] = useState<any[]>([]);

  const fetchData = async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const res = await commissionService.getList({ ...f, page: p, pageSize: 20 });
      if (res.code === 0) {
        setCommissions(res.data.list);
        setTotal(res.data.total);
        setPage(p);
        if (res.data.referrerSummary) setReferrerSummary(res.data.referrerSummary);
      }
    } catch (error) {
      message.error('获取佣金列表失败');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const payTypeMap: Record<string, string> = {
    single_registration: '会员建档',
    partner_matchmaker: '联创入驻',
    professional_recommender: '专业入驻',
    city_franchisee: '城市入驻',
    online_unlock_gold: '线上解锁(优质)',
    online_unlock_silver: '线上解锁(良好)',
    salon_signup: '沙龙报名',
    salon_attend: '沙龙参会',
  };

  const statusMap: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: '待结算' },
    withdraw_requested: { color: 'blue', label: '提现中' },
    paid: { color: 'green', label: '已到账' },
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '收款人', dataIndex: 'recipient_nickname', key: 'recipient_nickname', width: 100 },
    { title: '收款角色', dataIndex: 'recipient_role', key: 'recipient_role', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '收款类型', dataIndex: 'recipient_type', key: 'recipient_type', width: 80, render: (v: string) => {
      const map: Record<string, string> = { referrer: '推荐人', organizer: '承办人', self: '自荐' };
      return map[v] || v;
    }},
    { title: '付款类型', dataIndex: 'pay_type', key: 'pay_type', width: 120, render: (v: string) => payTypeMap[v] || v },
    { title: '订单金额', dataIndex: 'total_amount', key: 'total_amount', width: 90, render: (v: number) => `¥${v}` },
    { title: '佣金金额', dataIndex: 'amount', key: 'amount', width: 90, render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>¥{v}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={statusMap[v]?.color || 'default'}>{statusMap[v]?.label || v}</Tag> },
    { title: '备注', dataIndex: 'note', key: 'note', width: 140, ellipsis: true },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  ];

  return (
    <div>
      <PageHeader title="佣金管理" subtitle="99元奖励明细 + 联创红娘统计" />

      {/* 推荐人佣金汇总 */}
      {referrerSummary.length > 0 && (
        <Card title="推荐人佣金TOP20" size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={referrerSummary}
            rowKey="recipient_id"
            size="small"
            pagination={false}
            columns={[
              { title: '推荐人', dataIndex: 'nickname', key: 'nickname', width: 100 },
              { title: '角色', dataIndex: 'role', key: 'role', width: 120, render: (v: string) => <Tag>{v}</Tag> },
              { title: '总笔数', dataIndex: 'total_count', key: 'total_count', width: 80 },
              { title: '总金额', dataIndex: 'total_amount', key: 'total_amount', width: 100, render: (v: number) => <span style={{ color: '#f5222d' }}>¥{v}</span> },
              { title: '待结算', dataIndex: 'pending_amount', key: 'pending_amount', width: 100, render: (v: number) => <span style={{ color: '#faad14' }}>¥{v}</span> },
              { title: '已到账', dataIndex: 'paid_amount', key: 'paid_amount', width: 100, render: (v: number) => <span style={{ color: '#52c41a' }}>¥{v}</span> },
            ]}
          />
        </Card>
      )}

      {/* 筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <span>付款类型:</span>
          <Select style={{ width: 160 }} allowClear placeholder="全部" onChange={(v) => { const f = { ...filters, payType: v }; setFilters(f); fetchData(1, f); }}>
            <Select.Option value="online_unlock_gold">线上解锁(优质)</Select.Option>
            <Select.Option value="online_unlock_silver">线上解锁(良好)</Select.Option>
            <Select.Option value="salon_signup">沙龙报名</Select.Option>
            <Select.Option value="single_registration">会员建档</Select.Option>
            <Select.Option value="partner_matchmaker">联创入驻</Select.Option>
          </Select>
          <span>状态:</span>
          <Select style={{ width: 120 }} allowClear placeholder="全部" onChange={(v) => { const f = { ...filters, status: v }; setFilters(f); fetchData(1, f); }}>
            <Select.Option value="pending">待结算</Select.Option>
            <Select.Option value="paid">已到账</Select.Option>
          </Select>
        </Space>
      </Card>

      <Table
        dataSource={commissions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => fetchData(p) }}
        size="small"
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default CommissionsPage;
