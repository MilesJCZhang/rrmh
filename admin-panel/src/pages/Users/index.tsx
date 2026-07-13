import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, message, Card, Tooltip, Badge, Popconfirm } from 'antd';
import { SearchOutlined, EyeOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getUsers, getUserDetail, updateUserStatus, deleteUser, disableUser, User, UserListParams } from '../../services/user.service';

/** 将 ISO 时间字符串格式化为 YYYY-MM-DD HH:mm:ss */
const formatTime = (isoStr: string): string => {
  if (!isoStr || isoStr === '-') return '-';
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return isoStr;
  }
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: UserListParams = {
        page,
        limit,
        keyword: keyword || undefined,
      };
      const result = await getUsers(params);
      setUsers(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleViewDetail = async (id: number) => {
    try {
      const user = await getUserDetail(id);
      setCurrentUser(user);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取用户详情失败');
    }
  };

  const handleToggleStatus = (record: User) => {
    const newStatus = record.status === 1 ? 0 : 1;
    const action = newStatus === 1 ? '启用' : '禁用';

    Modal.confirm({
      title: `确认${action}`,
      content: `确定要${action}用户 "${record.nickname}" 吗？`,
      onOk: async () => {
        try {
          await updateUserStatus(record.id, newStatus);
          message.success(`${action}成功`);
          fetchUsers();
        } catch (error) {
          message.error(`${action}失败`);
        }
      },
    });
  };

  const handleDisable = async (record: User) => {
    Modal.confirm({
      title: `确认禁用用户`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要<strong style={{color: 'red'}}>禁用</strong>用户 "{record.nickname}"（ID: {record.id}）吗？</p>
          <p style={{color: '#999', fontSize: 12}}>禁用后该用户将无法登录小程序，数据仍保留。可在状态栏重新启用。</p>
        </div>
      ),
      okText: '确认禁用',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await disableUser(record.id);
          message.success('用户已禁用');
          fetchUsers();
        } catch (error: any) {
          message.error(error?.response?.data?.message || '禁用失败');
        }
      },
    });
  };

  const handleDelete = async (record: User) => {
    Modal.confirm({
      title: `确认永久删除用户`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要<strong style={{color: 'red'}}>永久删除</strong>用户 "{record.nickname}"（ID: {record.id}）吗？</p>
          <p style={{color: '#f5222d', fontSize: 12}}>此操作将同时删除该用户的所有关联数据（推荐码、订单、钱包、收益等），不可恢复！</p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(record.id);
          message.success('用户已永久删除');
          fetchUsers();
        } catch (error: any) {
          message.error(error?.response?.data?.message || '删除失败');
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
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: (gender: number) => (gender === 1 ? '男' : gender === 2 ? '女' : '未知'),
    },
    {
      title: '学历',
      dataIndex: 'education',
      key: 'education',
    },
    {
      title: '职业',
      dataIndex: 'occupation',
      key: 'occupation',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '推荐人',
      key: 'referrer',
      width: 140,
      render: (_: any, record: any) => {
        const referrer = record.referrer;
        if (!referrer) return <span style={{ color: '#999' }}>-</span>;
        return (
          <Tooltip title={`推荐码: ${referrer.recommendCode || '-'}`}>
            <span>{referrer.nickname}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '推荐码+类型',
      key: 'referralCodes',
      width: 200,
      render: (_: any, record: any) => {
        const codes = record.referralCodes;
        if (codes && codes.length > 0) {
          const tagColorMap: Record<string, string> = {
            'public_welfare': 'green', 'creator': 'blue',
            'professional': 'purple', 'community_station': 'orange', 'city_partner': 'volcano',
          };
          return (
            <Space wrap>
              {codes.map((rc: any, i: number) => (
                <Tooltip key={i} title={`类型: ${rc.typeName || rc.codeType}`}>
                  <Tag color={tagColorMap[rc.codeType] || 'default'} style={{ fontFamily: 'monospace' }}>
                    {rc.code}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          );
        }
        // 兜底：显示 users.recommendCode（即使用户无 referral_codes 表记录也有值）
        if (record.recommendCode) {
          return <Tag color="blue" style={{ fontFamily: 'monospace' }}>{record.recommendCode}</Tag>;
        }
        return <span style={{ color: '#999' }}>-</span>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (_: any, record: any) => {
        // 兼容驼峰和下划线两种格式，并格式化时间
        const time = record.createdAt || record.created_at || '-';
        return formatTime(time);
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            详情
          </Button>
          <Button
            type="link"
            danger={record.status === 1}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确认禁用"
            description={`确定要禁用用户 "${record.nickname}" 吗？`}
            onConfirm={() => handleDisable(record)}
            okText="确认禁用"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<ExclamationCircleOutlined />}>
              禁用
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认永久删除"
            description={`永久删除用户 "${record.nickname}" 及其所有数据？不可恢复！`}
            onConfirm={() => handleDelete(record)}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="用户管理" subtitle="查看和管理用户" />

      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Input
              placeholder="搜索用户昵称/ID"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        </div>

        <Table
          dataSource={users}
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
        title="用户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentUser && (
          <div>
            <p><strong>ID：</strong>{currentUser.id}</p>
            <p><strong>昵称：</strong>{currentUser.nickname}</p>
            <p><strong>性别：</strong>{currentUser.gender === 1 ? '男' : currentUser.gender === 2 ? '女' : '未知'}</p>
            <p><strong>生日：</strong>{currentUser.birthday || '-'}</p>
            <p><strong>身高：</strong>{currentUser.height ? currentUser.height + 'cm' : '-'}</p>
            <p><strong>学历：</strong>{currentUser.education || '-'}</p>
            <p><strong>职业：</strong>{currentUser.occupation || '-'}</p>
            <p><strong>收入：</strong>{currentUser.income || '-'}</p>
            <p><strong>位置：</strong>{currentUser.location || '-'}</p>
            <p>
              <strong>推荐码：</strong>
              <Tag color="blue">{currentUser.recommendCode || '-'}</Tag>
            </p>
            <p>
              <strong>推荐人：</strong>
              {currentUser.referrer ? (
                <Tooltip title={`推荐码: ${currentUser.referrer.recommendCode || '-'}`}>
                  <span>{currentUser.referrer.nickname} (ID: {currentUser.referrer.id})</span>
                </Tooltip>
              ) : (
                <span style={{ color: '#999' }}>无</span>
              )}
            </p>
            <p><strong>注册时间：</strong>{formatTime(currentUser.createdAt || (currentUser as any).created_at || '-')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
