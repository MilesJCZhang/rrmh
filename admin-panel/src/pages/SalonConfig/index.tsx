import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  message,
  Card,
  Space,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Tabs,
  ColorPicker,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  SalonConfig,
  getSalonConfigs,
  saveSalonConfig,
  deleteSalonConfig,
  toggleSalonConfigStatus,
} from '../../services/salon-config.service';

const { TextArea } = Input;

const SalonConfigPage: React.FC = () => {
  const [list, setList] = useState<SalonConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<SalonConfig | null>(null);
  const [form] = Form.useForm();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalonConfigs();
      setList(result);
    } catch (error) {
      message.error('获取沙龙配置列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleEdit = (record: SalonConfig) => {
    setCurrentConfig(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  const handleCreate = () => {
    setCurrentConfig(null);
    form.resetFields();
    form.setFieldsValue({
      type: '',
      name: '',
      description: '',
      emoji: '🎉',
      theme: {
        color: '#C8102E',
        lightColor: '#FFF0F0',
        gradient: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
        bannerBg: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
        icon: '🎉',
      },
      page: {
        list: '/subpackages/activity/pages/salon-list/salon-list',
        detail: '/subpackages/activity/pages/salon-detail/salon-detail',
        create: '/subpackages/activity/pages/salon-create/salon-create',
      },
      features: {
        totalCap: 27,
        maxRecommenders: 9,
        maxPerGender: 3,
        showScoreFilter: true,
        allowCompanion: true,
        maxCompanions: 1,
        requireProfile: true,
        allowWalkIn: false,
        maxPerWeek: 1,
      },
      registration: {
        needPayment: true,
        defaultFee: 399,
        needProfile: true,
        allowCompanion: true,
        companionFields: ['name', 'gender', 'age', 'phone'],
      },
      permissions: {
        creatorRoles: ['admin', 'station_owner'],
        participantRoles: ['user', 'referrer', 'matchmaker'],
        genderLimit: 'none',
        minAge: 18,
        maxAge: 80,
        minScore: 0,
      },
      commission: {
        referrer: 50,
        platform: 30,
        matchmaker: 20,
      },
      api: {
        list: '/api/salons',
        detail: '/api/salons/:id',
        register: '/api/salons/:id/register',
        create: '/api/salons',
        update: '/api/salons/:id',
        cancel: '/api/salons/:id/cancel',
        approve: '/api/admin/salons/:id/approve',
      },
      status: 'active',
    });
    setEditVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await saveSalonConfig(values);
      message.success(currentConfig ? '配置已更新' : '配置已创建');
      setEditVisible(false);
      fetchList();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败，请检查表单');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (record: SalonConfig) => {
    Modal.confirm({
      title: '删除配置',
      content: `确定要删除沙龙配置"${record.name}"吗？此操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSalonConfig(record.type);
          message.success('配置已删除');
          fetchList();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleToggleStatus = async (record: SalonConfig) => {
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleSalonConfigStatus(record.type, newStatus);
      message.success(`配置已${newStatus === 'active' ? '启用' : '禁用'}`);
      fetchList();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const renderThemeTab = () => {
    return (
      <Form layout="vertical">
        <Form.Item label="主题色" name={['theme', 'color']}>
          <ColorPicker showText />
        </Form.Item>
        <Form.Item label="浅色背景" name={['theme', 'lightColor']}>
          <ColorPicker showText />
        </Form.Item>
        <Form.Item label="渐变色" name={['theme', 'gradient']}>
          <Input />
        </Form.Item>
        <Form.Item label="Banner背景" name={['theme', 'bannerBg']}>
          <Input />
        </Form.Item>
        <Form.Item label="图标" name={['theme', 'icon']}>
          <Input />
        </Form.Item>
      </Form>
    );
  };

  const renderFeaturesTab = () => {
    return (
      <Form layout="vertical">
        <Form.Item label="总容量" name={['features', 'totalCap']}>
          <InputNumber min={1} max={100} />
        </Form.Item>
        <Form.Item label="最大推荐官数" name={['features', 'maxRecommenders']}>
          <InputNumber min={1} max={50} />
        </Form.Item>
        <Form.Item label="每性别最大人数" name={['features', 'maxPerGender']}>
          <InputNumber min={1} max={20} />
        </Form.Item>
        <Form.Item label="显示评分筛选" name={['features', 'showScoreFilter']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="允许随行人员" name={['features', 'allowCompanion']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="最大随行人数" name={['features', 'maxCompanions']}>
          <InputNumber min={0} max={5} />
        </Form.Item>
        <Form.Item label="需要资料审核" name={['features', 'requireProfile']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="允许现场报名" name={['features', 'allowWalkIn']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="每周最大场次" name={['features', 'maxPerWeek']}>
          <InputNumber min={1} max={10} />
        </Form.Item>
      </Form>
    );
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '总容量',
      dataIndex: ['features', 'totalCap'],
      key: 'totalCap',
      width: 100,
    },
    {
      title: '报名费',
      dataIndex: ['registration', 'defaultFee'],
      key: 'defaultFee',
      width: 100,
      render: (fee: number) => `¥${fee}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: any, record: SalonConfig) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Switch
            checked={record.status === 'active'}
            checkedChildren="启用"
            unCheckedChildren="禁用"
            onChange={() => handleToggleStatus(record)}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Form layout="vertical">
          <Form.Item label="类型标识" name="type" rules={[{ required: true, message: '请输入类型标识' }]}>
            <Input disabled={!!currentConfig} />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Emoji" name="emoji">
            <Input style={{ width: 100 }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'theme',
      label: '主题配置',
      children: renderThemeTab(),
    },
    {
      key: 'features',
      label: '功能配置',
      children: renderFeaturesTab(),
    },
    {
      key: 'registration',
      label: '报名配置',
      children: (
        <Form layout="vertical">
          <Form.Item label="需要支付" name={['registration', 'needPayment']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="默认费用" name={['registration', 'defaultFee']}>
            <InputNumber min={0} max={10000} />
          </Form.Item>
          <Form.Item label="需要资料" name={['registration', 'needProfile']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="允许随行" name={['registration', 'allowCompanion']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'permissions',
      label: '权限配置',
      children: (
        <Form layout="vertical">
          <Form.Item label="性别限制" name={['permissions', 'genderLimit']}>
            <Input />
          </Form.Item>
          <Form.Item label="最小年龄" name={['permissions', 'minAge']}>
            <InputNumber min={18} max={100} />
          </Form.Item>
          <Form.Item label="最大年龄" name={['permissions', 'maxAge']}>
            <InputNumber min={18} max={100} />
          </Form.Item>
          <Form.Item label="最低评分" name={['permissions', 'minScore']}>
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'commission',
      label: '收益配置',
      children: (
        <Form layout="vertical">
          <Form.Item label="推荐官收益(%)" name={['commission', 'referrer']}>
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item label="平台收益(%)" name={['commission', 'platform']}>
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item label="红娘收益(%)" name={['commission', 'matchmaker']}>
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="沙龙配置管理"
        subtitle="管理不同类型沙龙的配置信息"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增配置
          </Button>
        }
      />
      
      <Card>
        <Table
          dataSource={list}
          columns={columns}
          rowKey="type"
          loading={loading}
          pagination={false}
        />
      </Card>
      
      <Modal
        title={currentConfig ? '编辑沙龙配置' : '新增沙龙配置'}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        width={800}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Tabs items={tabItems} />
        </Form>
      </Modal>
    </div>
  );
};

export default SalonConfigPage;
