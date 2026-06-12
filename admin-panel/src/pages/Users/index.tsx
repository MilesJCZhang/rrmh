import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, message, Card } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getUsers, getUserDetail, updateUserStatus, User, UserListParams } from '../../services/user.service';

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
      width: 200,
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
            <p><strong>生日：</strong>{currentUser.birthday}</p>
            <p><strong>身高：</strong>{currentUser.height}cm</p>
            <p><strong>学历：</strong>{currentUser.education}</p>
            <p><strong>职业：</strong>{currentUser.occupation}</p>
            <p><strong>收入：</strong>{currentUser.income}</p>
            <p><strong>位置：</strong>{currentUser.location}</p>
            <p><strong>注册时间：</strong>{formatTime(currentUser.createdAt || (currentUser as any).created_at || '-')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
