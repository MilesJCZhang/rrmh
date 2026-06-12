import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, message, Card, Space, Input, Modal, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getActivities, approveActivity, Activity } from '../../services/activity.service';

/** 活动类型选项 */
const typeFilters = [
  { text: '全部', value: undefined },
  { text: '常规沙龙', value: 'salon' },
  { text: '男推荐官沙龙', value: 'male_salon' },
  { text: '女推荐官沙龙', value: 'female_salon' },
];

const statusColorMap: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  published: 'blue',
  ongoing: 'cyan',
  completed: 'green',
  cancelled: 'default',
  rejected: 'red',
};

const statusLabelMap: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  published: '已发布',
  ongoing: '进行中',
  completed: '已结束',
  cancelled: '已取消',
  rejected: '已拒绝',
};

const typeColorMap: Record<string, string> = {
  salon: 'blue',
  male_salon: 'blue',
  female_salon: 'pink',
};

const typeLabelMap: Record<string, string> = {
  salon: '常规沙龙',
  male_salon: '男推荐官沙龙',
  female_salon: '女推荐官沙龙',
};

/** 将 ISO 时间字符串格式化为 YYYY-MM-DD HH:mm */
const formatTime = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoStr;
  }
};

const ActivitiesPage: React.FC = () => {
  const [list, setList] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getActivities({
        page,
        limit,
        status: statusFilter,
        type: typeFilter,
        keyword: keyword || undefined,
      });
      setList(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取活动列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter, keyword]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = () => {
    setKeyword(searchValue);
    setPage(1);
  };

  const handleViewDetail = (record: Activity) => {
    setCurrentActivity(record);
    setDetailVisible(true);
  };

  const handleApprove = (id: number) => {
    Modal.confirm({
      title: '审核通过',
      content: '确定要通过该沙龙活动吗？通过后活动将变为"已发布"状态并可报名。',
      okText: '通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          await approveActivity(id, 'approve');
          message.success('审核已通过');
          fetchList();
          setDetailVisible(false);
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleReject = (id: number) => {
    let rejectReason = '';
    Modal.confirm({
      title: '审核拒绝',
      content: (
        <div style={{ marginTop: 16 }}>
          <p>确定要拒绝该沙龙活动吗？请填写拒绝原因。</p>
          <Input.TextArea
            placeholder="请输入拒绝原因（必填）"
            rows={3}
            onChange={(e) => { rejectReason = e.target.value; }}
          />
        </div>
      ),
      okText: '拒绝',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!rejectReason || !rejectReason.trim()) {
          message.error('请填写拒绝原因');
          throw new Error('拒绝原因不能为空');
        }
        try {
          await approveActivity(id, 'reject', rejectReason);
          message.success('已拒绝');
          fetchList();
          setDetailVisible(false);
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const statusFilters = [
    { text: '全部', value: undefined },
    { text: '待审核', value: 'pending' },
    { text: '已发布', value: 'published' },
    { text: '进行中', value: 'ongoing' },
    { text: '已结束', value: 'completed' },
    { text: '已拒绝', value: 'rejected' },
  ];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '活动标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string, record: Activity) => {
        // 使用后端返回的 type 字段：salon / male_salon / female_salon
        const label = typeLabelMap[type] || type || '未知';
        const color = typeColorMap[type] || 'default';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '主办方',
      dataIndex: 'organizer',
      key: 'organizer',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      width: 160,
    },
    {
      title: '活动日期',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 150,
      render: (time: string) => time ? formatTime(time) : '-',
    },
    {
      title: '容量',
      key: 'capacity',
      width: 100,
      render: (_: any, record: Activity) => {
        // 男/女推荐官沙龙使用 total_cap，常规沙龙使用 maxParticipants
        if (record.type === 'male_salon' || record.type === 'female_salon') {
          return `${record.total_cap || record.maxParticipants || 27}人`;
        }
        const perGender = record.max_per_gender || (record.maxParticipants ? Math.floor(record.maxParticipants / 2) : 3);
        return `${perGender * 2}人`;
      },
    },
    {
      title: '已报名',
      key: 'registered',
      width: 80,
      render: (_: any, record: Activity) => {
        // 后端返回 registeredCount 字段，兼容旧数据
        const count = record.registeredCount || (record.male_count || 0) + (record.female_count || 0);
        return `${count}人`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {statusLabelMap[status] || status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Activity) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                style={{ color: 'green' }}
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                type="link"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record.id)}
              >
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
      <PageHeader title="活动管理" subtitle="审核和管理沙龙活动" />

      <Card>
        {/* 类型筛选 */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: 8, fontWeight: 500 }}>活动类型：</span>
          <Space wrap>
            {typeFilters.map((filter) => (
              <Button
                key={filter.text}
                type={typeFilter === filter.value ? 'primary' : 'default'}
                onClick={() => { setTypeFilter(filter.value); setPage(1); }}
                size="small"
              >
                {filter.text}
              </Button>
            ))}
          </Space>
        </div>

        {/* 状态筛选 + 搜索 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            {statusFilters.map((filter) => (
              <Button
                key={filter.text}
                type={statusFilter === filter.value ? 'primary' : 'default'}
                onClick={() => { setStatusFilter(filter.value); setPage(1); }}
                size="small"
              >
                {filter.text}
              </Button>
            ))}
          </Space>
          <Space>
            <Input
              placeholder="搜索标题/主办方"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Button type="primary" onClick={handleSearch} size="small">搜索</Button>
          </Space>
        </div>

        <Table
          dataSource={list}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
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
        title="活动详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentActivity && (
          <Descriptions column={2} style={{ marginTop: '16px' }}>
            <Descriptions.Item label="ID">{currentActivity.id}</Descriptions.Item>
            <Descriptions.Item label="标题" span={1}>{currentActivity.title}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={typeColorMap[currentActivity.type] || 'default'}>
                {typeLabelMap[currentActivity.type] || currentActivity.type || '未知'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="主办方">{currentActivity.organizer || currentActivity.organizer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="地点">{currentActivity.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="活动日期">{formatTime(currentActivity.startTime || currentActivity.event_date)}</Descriptions.Item>
            <Descriptions.Item label="活动时间">
              {formatTime(currentActivity.startTime || currentActivity.start_time || '')}{currentActivity.endTime || currentActivity.end_time ? ` - ${formatTime(currentActivity.endTime || currentActivity.end_time)}` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="费用">
              ¥{currentActivity.registrationFee || currentActivity.registration_fee || 0}
            </Descriptions.Item>
            <Descriptions.Item label="容量">
              {currentActivity.type === 'male_salon' || currentActivity.type === 'female_salon'
                ? `${currentActivity.total_cap || currentActivity.maxParticipants || 27}人封顶（含随行）`
                : `${currentActivity.maxParticipants || ((currentActivity.max_per_gender || 3) * 2) || 6}人`}
            </Descriptions.Item>
            <Descriptions.Item label="已报名">
              {(currentActivity.registeredCount || currentActivity.male_count || 0) + (currentActivity.female_count || 0)} 人
            </Descriptions.Item>
            {currentActivity.type === 'male_salon' || currentActivity.type === 'female_salon' ? (
              <Descriptions.Item label="活动类型详情">
                {currentActivity.type === 'male_salon' ? '男推荐官专属沙龙' : '女推荐官专属沙龙'}
              </Descriptions.Item>
            ) : (
              <Descriptions.Item label="活动类型详情">常规沙龙活动</Descriptions.Item>
            )}
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[currentActivity.status] || 'default'}>
                {statusLabelMap[currentActivity.status] || currentActivity.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(currentActivity.created_at || currentActivity.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(currentActivity.updated_at || currentActivity.updatedAt)}</Descriptions.Item>
            {currentActivity.coverImage && (
              <Descriptions.Item label="海报" span={2}>
                <a href={currentActivity.coverImage} target="_blank" rel="noreferrer">查看海报</a>
              </Descriptions.Item>
            )}
            {currentActivity.description && (
              <Descriptions.Item label="活动描述" span={2}>
                {currentActivity.description}
              </Descriptions.Item>
            )}
            {currentActivity.status === 'rejected' && currentActivity.reject_reason && (
              <Descriptions.Item label="拒绝原因" span={2}>
                <span style={{ color: '#ff4d4f' }}>{currentActivity.reject_reason}</span>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ActivitiesPage;
