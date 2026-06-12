import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Card,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getStations, createStation, updateStation, deleteStation, Station, StationParams } from '../../services/station.service';

const StationsPage: React.FC = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [form] = Form.useForm();

  const fetchStations = async () => {
    setLoading(true);
    try {
      const result = await getStations({ page, limit });
      setStations(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取服务站列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleCreateOrUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingStation) {
        await updateStation(editingStation.id, values);
        message.success('更新成功');
      } else {
        await createStation(values as StationParams);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingStation(null);
      fetchStations();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleEdit = (record: Station) => {
    setEditingStation(record);
    form.setFieldsValue({
      name: record.name,
      address: record.address,
      contactName: record.contactName,
      contactPhone: record.contactPhone,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStation(id);
      message.success('删除成功');
      fetchStations();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAdd = () => {
    setEditingStation(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      key: 'contactName',
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
    },
    {
      title: '合伙人数量',
      dataIndex: 'partnerCount',
      key: 'partnerCount',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Station) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个服务站吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
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
      <PageHeader title="服务站管理" subtitle="管理服务站信息" />

      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建服务站
          </Button>
        </div>

        <Table
          dataSource={stations}
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
        title={editingStation ? '编辑服务站' : '新建服务站'}
        open={modalVisible}
        onOk={handleCreateOrUpdate}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingStation(null);
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入服务站名称" />
          </Form.Item>
          <Form.Item
            name="address"
            label="地址"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入地址" />
          </Form.Item>
          <Form.Item
            name="contactName"
            label="联系人"
            rules={[{ required: true, message: '请输入联系人' }]}
          >
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StationsPage;
