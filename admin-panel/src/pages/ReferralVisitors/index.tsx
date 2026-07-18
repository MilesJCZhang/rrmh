import React, { useEffect, useState } from 'react';
import { Table, Input, Space, Tag, Card, Select, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getVisitorLogs, VisitorLog } from '../../services/referral-visitor.service';

const regStatusLabels: Record<string, string> = {
  pending: '未注册',
  registered: '已注册',
};

const regStatusColor: Record<string, string> = {
  pending: 'orange',
  registered: 'green',
};

const ReferralVisitorsPage: React.FC = () => {
  const [list, setList] = useState<VisitorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [regStatus, setRegStatus] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (regStatus !== 'all') params.reg_status = regStatus;
      if (keyword.trim()) params.keyword = keyword.trim();
      const result = await getVisitorLogs(params);
      setList(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取访客日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, regStatus, keyword]);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '推荐官',
      key: 'referrer',
      render: (r: VisitorLog) => (
        <div>
          <div>{r.referrerName || '—'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.referrerCode}</div>
        </div>
      ),
    },
    {
      title: '访客',
      key: 'visitor',
      render: (r: VisitorLog) => (
        <Space>
          {r.visitorAvatar ? (
            <img src={r.visitorAvatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          ) : null}
          <span>{r.visitorNickname || '—'}</span>
        </Space>
      ),
    },
    { title: '访客OpenID', dataIndex: 'visitorOpenid', key: 'visitorOpenid', ellipsis: true },
    {
      title: '注册状态',
      dataIndex: 'regStatus',
      key: 'regStatus',
      render: (s: string) => <Tag color={regStatusColor[s] || 'default'}>{regStatusLabels[s] || s}</Tag>,
    },
    { title: '到访时间', dataIndex: 'visitTime', key: 'visitTime' },
  ];

  return (
    <div>
      <PageHeader title="访客管理" subtitle="推荐官发展的访客明细（含未注册），用于与小程序工作台对账" />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={regStatus}
            style={{ width: 140 }}
            onChange={(v) => { setRegStatus(v); setPage(1); }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '未注册' },
              { value: 'registered', label: '已注册' },
            ]}
          />
          <Input
            allowClear
            placeholder="推荐官昵称 / 访客昵称 / OpenID"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => setPage(1)}
          />
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
};

export default ReferralVisitorsPage;
