import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, message, Card, Row, Col, Tabs, Popconfirm, Select, Statistic } from 'antd';
import { PlusOutlined, ExportOutlined, LinkOutlined, DisconnectOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getReferralCodes, generateCodes, exportCodes, assignCode, unbindCode, deleteCode, updateCode, getInsight, ReferralCode } from '../../services/referral-code.service';

const { TabPane } = Tabs;

const typeLabels: Record<string, string> = {
  public_welfare: '公益推荐官',
  creator: '联创推荐官',
  professional: '专业推荐官',
  community_station: '社区服务站',
  city_partner: '城市合伙人',
  station: '社区服务站',
  public: '公益推荐官',
  city: '城市合伙人',
};

// 格式化时间：2026-06-15T07:58:28.044Z → 2026-06-15 07:58:28
const formatDate = (v: string) => {
  if (!v) return '-';
  try { return v.replace('T', ' ').substring(0, 19); } catch { return v; }
};

const statusLabels: Record<string, string> = {
  active: '可用',
  depleted: '已用完',
  deleted: '已删除',
  inactive: '停用',
};

const sceneLabels: Record<string, string> = {
  register: '注册',
  recommend: '推荐建档',
  login: '登录',
  order: '下单',
  other: '其他',
};

const ReferralCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleStats, setRoleStats] = useState<any[]>([]);
  const [generateVisible, setGenerateVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [currentCode, setCurrentCode] = useState<string>('');
  const [bindMethod, setBindMethod] = useState<'user_id' | 'wechat'>('user_id');
  const [form] = Form.useForm();
  const [insightVisible, setInsightVisible] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightData, setInsightData] = useState<any>(null);
  const [fixVisible, setFixVisible] = useState(false);
  const [fixForm] = Form.useForm();

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const result = await getReferralCodes(params);
      setCodes(result.list);
      setTotal(result.total);
      calcRoleStats(result.list);
    } catch (error) {
      message.error('获取推荐码列表失败');
    } finally {
      setLoading(false);
    }
  };

  const calcRoleStats = (list: ReferralCode[]) => {
    const stats = [
      { label: '公益推荐官', value: 'public_welfare', count: 0 },
      { label: '联创推荐官', value: 'creator', count: 0 },
      { label: '专业推荐官', value: 'professional', count: 0 },
      { label: '社区服务站', value: 'community_station', count: 0 },
      { label: '城市合伙人', value: 'city_partner', count: 0 },
    ];
    list.forEach(item => {
      const stat = stats.find(s => s.value === item.code_type);
      if (stat) stat.count++;
    });
    setRoleStats(stats);
  };

  useEffect(() => {
    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter, statusFilter]);

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      await generateCodes(values);
      message.success('生成成功');
      setGenerateVisible(false);
      form.resetFields();
      fetchCodes();
    } catch (error) {
      message.error('生成失败');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportCodes();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-codes-${new Date().getTime()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleAssign = (code: string) => {
    setCurrentCode(code);
    setBindMethod('user_id');
    assignForm.resetFields();
    setAssignVisible(true);
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      const params: any = { code: currentCode };
      
      if (bindMethod === 'user_id') {
        params.user_id = values.user_id;
      } else {
        params.wechat_account = values.wechat_account;
      }
      
      await assignCode(params);
      message.success('分配成功');
      setAssignVisible(false);
      assignForm.resetFields();
      fetchCodes();
    } catch (error: any) {
      // 正确处理后端返回的错误
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error('分配失败');
      }
    }
  };

  const handleUnbind = async (code: string, referrerName: string) => {
    try {
      await unbindCode(code);
      message.success(`推荐码 ${code} 解绑成功，原绑定用户：${referrerName}`);
      fetchCodes();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error('解绑失败');
      }
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await deleteCode(code);
      message.success(`推荐码 ${code} 删除成功`);
      fetchCodes();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleFix = (code: string, codeType: string) => {
    setCurrentCode(code);
    fixForm.setFieldsValue({ oldCode: code, codeType: codeType || 'creator' });
    setFixVisible(true);
  };

  const handleFixSubmit = async () => {
    try {
      const values = await fixForm.validateFields();
      await updateCode(values.oldCode, values.newCode, values.codeType);
      message.success('推荐码修正成功');
      setFixVisible(false);
      fixForm.resetFields();
      fetchCodes();
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || '修正失败');
    }
  };

  const handleInsight = async (code: string) => {
    setCurrentCode(code);
    setInsightVisible(true);
    setInsightLoading(true);
    try {
      const data = await getInsight(code);
      setInsightData(data);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取洞察数据失败');
    } finally {
      setInsightLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '推荐码',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <strong style={{ fontSize: '16px' }}>{code}</strong>,
    },
    {
      title: '类型',
      dataIndex: 'code_type',
      key: 'code_type',
      width: 120,
      render: (type: string) => typeLabels[type] || type || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '推荐人',
      dataIndex: 'referrerName',
      key: 'referrerName',
      render: (name: string) => name || <span style={{ color: '#999' }}>未绑定</span>,
    },
    {
      title: '已使用/最大使用次数',
      key: 'usage',
      render: (_: any, record: ReferralCode) => `${record.usedCount}/${record.maxUsage > 0 ? record.maxUsage : '无限'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '可用' : status === 'deleted' ? '已删除' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: any, record: ReferralCode) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleInsight(record.code)}
          >
            洞察
          </Button>
          {record.status === 'active' && !record.referrerName ? (
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={() => handleAssign(record.code)}
            >
              分配
            </Button>
          ) : null}
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleFix(record.code, record.code_type)}
          >
            修正
          </Button>
          {record.status === 'active' && record.referrerName ? (
            <Popconfirm
              title="解绑推荐码"
              description={`确定要解绑推荐码 ${record.code} 吗？解绑后该推荐码可以重新分配。`}
              onConfirm={() => handleUnbind(record.code, record.referrerName || '')}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DisconnectOutlined />}
              >
                解绑
              </Button>
            </Popconfirm>
          ) : null}
          {record.status !== 'deleted' ? (
            <Popconfirm
              title="删除推荐码"
              description={`确定要删除推荐码 ${record.code} 吗？删除后不可恢复。`}
              onConfirm={() => handleDelete(record.code)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="推荐码管理" subtitle="生成和管理推荐码" />

      <Card>
        <Row justify="space-between" style={{ marginBottom: '16px' }}>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setGenerateVisible(true)}
              >
                生成推荐码
              </Button>
              <Button icon={<ExportOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 筛选控件 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <span>角色类型:</span>
            <Select
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
              style={{ width: 140 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="public_welfare">公益</Select.Option>
              <Select.Option value="creator">联创</Select.Option>
              <Select.Option value="professional">专业</Select.Option>
              <Select.Option value="community_station">社区</Select.Option>
              <Select.Option value="city_partner">城市</Select.Option>
            </Select>

            <span style={{ marginLeft: 16 }}>状态:</span>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="active">有效</Select.Option>
              <Select.Option value="depleted">已用完</Select.Option>
              <Select.Option value="deleted">已删除</Select.Option>
            </Select>
          </Space>
        </Card>

        {/* 角色统计卡片 */}
        {roleStats.length > 0 && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              {roleStats.map(stat => (
                <Col span={4} key={stat.value}>
                  <Statistic title={stat.label} value={stat.count} />
                </Col>
              ))}
            </Row>
          </Card>
        )}

        <Table
          dataSource={codes}
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
        title="生成推荐码"
        open={generateVisible}
        onOk={handleGenerate}
        onCancel={() => {
          setGenerateVisible(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="stationId"
            label="服务站ID"
            rules={[{ required: true, message: '请输入服务站ID' }]}
          >
            <Input type="number" placeholder="请输入服务站ID" />
          </Form.Item>
          <Form.Item
            name="codeType"
            label="推荐码类型"
            rules={[{ required: true, message: '请选择推荐码类型' }]}
            initialValue="creator"
          >
            <Select placeholder="请选择类型">
              <Select.Option value="creator">联创推荐官 (LCRG)</Select.Option>
              <Select.Option value="public_welfare">公益推荐官 (GYRG)</Select.Option>
              <Select.Option value="professional">专业推荐官 (ZYRG)</Select.Option>
              <Select.Option value="community_station">社区服务站 (SQZD)</Select.Option>
              <Select.Option value="city_partner">城市合伙人 (CSHH)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="count"
            label="生成数量"
            rules={[{ required: true, message: '请输入生成数量' }]}
            initialValue={1}
          >
            <Input type="number" placeholder="请输入生成数量" />
          </Form.Item>
          <Form.Item
            name="maxUsage"
            label="最大使用次数"
            rules={[{ required: true, message: '请输入最大使用次数' }]}
            initialValue={100}
          >
            <Input type="number" placeholder="请输入最大使用次数" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`分配推荐码：${currentCode}`}
        open={assignVisible}
        onOk={handleAssignSubmit}
        onCancel={() => {
          setAssignVisible(false);
          assignForm.resetFields();
        }}
      >
        <Tabs activeKey={bindMethod} onChange={(key) => setBindMethod(key as 'user_id' | 'wechat')}>
          <TabPane tab="按用户ID绑定" key="user_id">
            <Form form={assignForm} layout="vertical">
              <Form.Item
                name="user_id"
                label="用户ID"
                rules={[{ required: true, message: '请输入用户ID' }]}
              >
                <Input type="number" placeholder="请输入用户ID" />
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="按微信号绑定" key="wechat">
            <Form form={assignForm} layout="vertical">
              <Form.Item
                name="wechat_account"
                label="微信号"
                rules={[{ required: true, message: '请输入微信号/手机号/昵称' }]}
                help="支持：微信OpenID、手机号、用户昵称"
              >
                <Input placeholder="请输入微信号/手机号/昵称" />
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Modal>

      <Modal
        title={`数据洞察 - ${currentCode}`}
        open={insightVisible}
        onCancel={() => {
          setInsightVisible(false);
          setInsightData(null);
        }}
        footer={null}
        width={720}
      >
        {insightLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : insightData ? (
          <div>
            <Card title="推荐码信息" size="small" style={{ marginBottom: 16 }}>
              <p><strong>推荐码：</strong>{insightData.code_info?.code}</p>
              <p><strong>类型：</strong>{typeLabels[insightData.code_info?.codeType] || insightData.code_info?.type_name || '-'}</p>
              <p><strong>状态：</strong>{statusLabels[insightData.code_info?.status] || insightData.code_info?.status}</p>
              <p><strong>使用次数：</strong>{insightData.code_info?.useCount} / {insightData.code_info?.maxUses || '无限制'}</p>
              <p><strong>过期时间：</strong>{insightData.code_info?.expiresAt || '无'}</p>
            </Card>

            {insightData.code_info?.referrer_name && (
              <Card title="推荐官信息" size="small" style={{ marginBottom: 16 }}>
                <p><strong>昵称：</strong>{insightData.code_info?.referrer_name || '-'}</p>
                <p><strong>微信号：</strong>{insightData.code_info?.referrer_wechat || '-'}</p>
                <p><strong>手机号：</strong>{insightData.code_info?.referrer_phone || '-'}</p>
                <p><strong>角色：</strong>{typeLabels[insightData.code_info?.codeType] || insightData.code_info?.type_name || '-'}</p>
              </Card>
            )}

            <Card title="推荐关系" size="small" style={{ marginBottom: 16 }}>
              {insightData.referred_users?.length > 0 ? (
                <Table
                  dataSource={insightData.referred_users}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'ID', dataIndex: 'id', key: 'id' },
                    { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
                    { title: '微信号', dataIndex: 'wechatAccount', key: 'wechatAccount' },
                    { title: '级别', dataIndex: 'level', key: 'level' },
                    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => statusLabels[s] || s },
                  ]}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无推荐关系</div>
              )}
            </Card>

            <Card title="使用记录" size="small">
              {insightData.usage_logs?.length > 0 ? (
                <Table
                  dataSource={insightData.usage_logs}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '用户', dataIndex: 'user_nickname', key: 'user_nickname' },
                    { title: '场景', dataIndex: 'scene', key: 'scene', render: (s: string) => sceneLabels[s] || s },
                    { title: '时间', dataIndex: 'created_at', key: 'created_at' },
                  ]}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无使用记录</div>
              )}
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
        )}
      </Modal>

      {/* 修正推荐码弹窗 */}
      <Modal
        title={`修正推荐码：${currentCode}`}
        open={fixVisible}
        onOk={handleFixSubmit}
        onCancel={() => { setFixVisible(false); fixForm.resetFields(); }}
        okText="确认修正"
        cancelText="取消"
      >
        <Form form={fixForm} layout="vertical">
          <Form.Item name="oldCode" label="原推荐码" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="newCode"
            label="新推荐码"
            rules={[{ required: true, message: '请输入新推荐码（8位，如 GYRG7K2M）' }]}
            extra="前缀+4位随机，如 GYRG7K2M / LCRG001 / ZYRG1234"
          >
            <Input placeholder="如 GYRG7K2M" maxLength={8} />
          </Form.Item>
          <Form.Item name="codeType" label="类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="public_welfare">公益推荐官 (GYRG)</Select.Option>
              <Select.Option value="creator">联创推荐官 (LCRG)</Select.Option>
              <Select.Option value="professional">专业推荐官 (ZYRG)</Select.Option>
              <Select.Option value="community_station">社区服务站 (SQZD)</Select.Option>
              <Select.Option value="city_partner">城市合伙人 (CSHH)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReferralCodesPage;
