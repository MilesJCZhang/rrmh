import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, message, Card, Row, Col, Tabs, Popconfirm, Select, Statistic } from 'antd';
import { PlusOutlined, ExportOutlined, LinkOutlined, DisconnectOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { getReferralCodes, getReferralCodeStats, generateCodes, exportCodes, assignCode, unbindCode, deleteCode, getInsight, bindCodes, ReferralCode } from '../../services/referral-code.service';
import * as XLSX from 'xlsx';

const { TabPane } = Tabs;

const typeLabels: Record<string, string> = {
  public_welfare: '公益推荐官',
  creator: '联创推荐官',
  professional: '专业推荐官',
  community_station: '社区服务站',
  city_partner: '城市合伙人',
  partner: '合伙人',
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
  const [codeKeyword, setCodeKeyword] = useState<string>('');
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
  const [bindCodesVisible, setBindCodesVisible] = useState(false);
  const [bindCodesFormInstance] = Form.useForm();

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (codeKeyword.trim()) params.code = codeKeyword.trim();

      const result = await getReferralCodes(params);
      setCodes(result.list);
      setTotal(result.total);
    } catch (error) {
      message.error('获取推荐码列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取推荐码统计数据
  const fetchStats = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const statsData = await getReferralCodeStats(params);
      
      const stats = [
        { label: '联创推荐官', value: 'creator', count: statsData.creator || 0 },
        { label: '公益推荐官', value: 'public_welfare', count: statsData.public_welfare || 0 },
        { label: '专业推荐官', value: 'professional', count: statsData.professional || 0 },
        { label: '社区服务站', value: 'community_station', count: statsData.community_station || 0 },
        { label: '城市合伙人', value: 'city_partner', count: statsData.city_partner || 0 },
      ];
      
      setRoleStats(stats);
    } catch (error) {
      console.error('获取推荐码统计失败:', error);
    }
  };

  useEffect(() => {
    fetchCodes();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter, statusFilter, codeKeyword]);

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
      setLoading(true);
      message.loading({ content: '正在获取数据...', key: 'export' });

      // 获取所有数据（使用较大的 pageSize）
      const allData: ReferralCode[] = [];
      let page = 1;
      let pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const params: any = { page, pageSize };
        if (typeFilter !== 'all') params.type = typeFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (codeKeyword) params.keyword = codeKeyword;

        const res = await getReferralCodes(params);
        allData.push(...res.list);
        
        if (allData.length >= res.total || res.list.length === 0) {
          hasMore = false;
        } else {
          page++;
        }
      }

      if (allData.length === 0) {
        message.warning({ content: '没有数据可导出', key: 'export' });
        setLoading(false);
        return;
      }

      // 准备 Excel 数据
      const typeMap: Record<string, string> = {
        'public_welfare': '公益推荐官',
        'creator': '联创推荐官',
        'professional': '专业推荐官',
        'community_station': '社区服务站',
        'city_partner': '城市合伙人',
        'partner': '合伙人',
      };

      const statusMap: Record<string, string> = {
        'active': '可用',
        'depleted': '已用完',
        'deleted': '已删除',
        'inactive': '停用',
      };

      const excelData = allData.map((item, index) => ({
        '序号': index + 1,
        '邀请码': item.code || '',
        '类型': typeMap[item.code_type || ''] || item.code_type || '',
        '状态': statusMap[item.status || ''] || item.status || '',
        '使用次数': item.use_count ?? item.useCount ?? 0,
        '最大次数': item.max_uses ?? item.maxUses ?? 0,
        '推荐人': item.referrer_name || item.referrerName || '',
        '推荐人ID': item.referrer_id || item.referrerId || '',
        '上级推荐人': item.parent_referrer_name || '',
        '上级推荐码': item.parent_referrer_code || '',
        '创建时间': item.created_at || item.createdAt || '',
      }));

      // 生成 Excel 文件
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // 设置列宽
      ws['!cols'] = [
        { wch: 6 },   // 序号
        { wch: 12 },  // 邀请码
        { wch: 15 },  // 类型
        { wch: 10 },  // 状态
        { wch: 10 },  // 使用次数
        { wch: 10 },  // 最大次数
        { wch: 15 },  // 推荐人
        { wch: 12 },  // 推荐人ID
        { wch: 15 },  // 上级推荐人
        { wch: 15 },  // 上级推荐码
        { wch: 20 },  // 创建时间
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '推荐码列表');
      
      // 下载文件
      const fileName = `推荐码列表-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      message.success({ content: `导出成功，共 ${allData.length} 条数据`, key: 'export' });
    } catch (error) {
      console.error('导出失败:', error);
      message.error({ content: '导出失败，请重试', key: 'export' });
    } finally {
      setLoading(false);
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

  const handleMarkSystem = async (code: string) => {
    try {
      await bindCodes({ referrer_code: 'SYSTEM', referred_code: code, remark: '系统生成' });
      message.success(`推荐码 ${code} 已标记为系统生成`);
      setInsightVisible(false);
      setInsightData(null);
      fetchCodes();
    } catch (error: any) {
      if (error.response?.data?.message) message.error(error.response.data.message);
      else if (error.message) message.error(error.message);
      else message.error('标记失败');
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
      title: '推荐人',
      dataIndex: 'referrerName',
      key: 'referrerName',
      width: 120,
      render: (name: string) => name || <span style={{ color: '#999' }}>未绑定</span>,
    },
    {
      title: '上级推荐人',
      key: 'parentReferrer',
      width: 140,
      render: (_: any, r: any) => {
        if (r.parent_referrer_name) {
          return <Tag color="blue">{r.parent_referrer_name}</Tag>;
        }
        return <span style={{ color: '#999' }}>无</span>;
      },
    },
    {
      title: '上级推荐码',
      dataIndex: 'parent_referrer_code',
      key: 'parent_referrer_code',
      width: 120,
      render: (v: string) => v ? <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span> : <span style={{ color: '#999' }}>-</span>,
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
      render: (text: string) => {
        if (!text) return '-';
        try {
          const date = new Date(text);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (e) {
          return text;
        }
      },
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
              <Button icon={<LinkOutlined />} onClick={() => { if (bindCodesFormInstance) bindCodesFormInstance.resetFields(); setBindCodesVisible(true); }}>
                双码互绑
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

            <Input.Search
              placeholder="输入推荐码搜索"
              value={codeKeyword}
              onChange={(e) => setCodeKeyword(e.target.value)}
              onSearch={() => { setPage(1); fetchCodes(); }}
              style={{ width: 200 }}
              allowClear
            />
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
        title="双码互绑"
        open={bindCodesVisible}
        onOk={async () => {
          try {
            const v = await bindCodesFormInstance.validateFields();
            await bindCodes({ referrer_code: v.referrer_code, referred_code: v.referred_code, remark: v.remark });
            message.success('推荐关系绑定成功');
            setBindCodesVisible(false);
            bindCodesFormInstance.resetFields();
            fetchCodes();
          } catch (error: any) {
            if (error.response?.data?.message) message.error(error.response.data.message);
            else if (error.message) message.error(error.message);
            else message.error('绑定失败');
          }
        }}
        onCancel={() => { setBindCodesVisible(false); bindCodesFormInstance.resetFields(); }}
      >
        <Form form={bindCodesFormInstance} layout="vertical">
          <Form.Item name="referrer_code" label="推荐人推荐码" rules={[{ required: true, message: '请输入推荐人推荐码' }]}>
            <Input placeholder="输入推荐人推荐码，如 LCRGXXXX；首批推荐官请填 SYSTEM" />
          </Form.Item>
          <Form.Item name="referred_code" label="被推荐人推荐码" rules={[{ required: true, message: '请输入被推荐人推荐码' }]}>
            <Input placeholder="输入被推荐人推荐码，如 GYRGXXXX" />
          </Form.Item>
          <Form.Item name="remark" label="备注（可选）">
            <Input placeholder="绑定备注" />
          </Form.Item>
          <div style={{ background: '#fff7e6', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: '#d46b08' }}>
            <strong>提示：</strong>第一批无上级推荐人的推荐官，推荐人推荐码填 <code>SYSTEM</code> 即可标记为系统生成。
          </div>
        </Form>
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

            {/* 推荐官信息 - 上级推荐人 */}
            <Card
              title="上级推荐人"
              size="small"
              style={{ marginBottom: 16, borderLeft: `3px solid ${insightData.code_info?.parent_referrer ? (insightData.code_info.parent_referrer.role === 'system' ? '#52c41a' : '#1890ff') : '#ff4d4f'}` }}
            >
              {insightData.code_info?.parent_referrer ? (
                <>
                  <p><strong>昵称：</strong>{insightData.code_info.parent_referrer.nickname || '-'}</p>
                  <p><strong>微信号：</strong>{insightData.code_info.parent_referrer.wechatAccount || '-'}</p>
                  <p><strong>推荐码：</strong>
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{insightData.code_info.parent_referrer.recommendCode || '-'}</span>
                  </p>
                  <p><strong>角色：</strong>
                    {insightData.code_info.parent_referrer.role === 'system' 
                      ? <Tag color="green">系统（首批推荐官）</Tag> 
                      : typeLabels[insightData.code_info.parent_referrer.role] || insightData.code_info.parent_referrer.role || '-'}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: '#999' }}>该推荐码暂无上级推荐人</p>
                  <Button
                    type="primary"
                    size="small"
                    ghost
                    icon={<LinkOutlined />}
                    onClick={() => handleMarkSystem(currentCode)}
                    style={{ marginTop: 8 }}
                  >
                    标记为系统生成（首批推荐官）
                  </Button>
                </>
              )}
            </Card>

            <Card title="推荐关系" size="small" style={{ marginBottom: 16 }}>
              {insightData.referred_users?.length > 0 ? (
                <Table
                  dataSource={insightData.referred_users}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
                    { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
                    { title: '微信号', dataIndex: 'wechatAccount', key: 'wechatAccount' },
                    { title: '上级推荐人', key: 'referrer', render: (_: any, r: any) => (
                      r.referrer ? <Tag color="blue">{r.referrer.nickname || r.referrer.id}</Tag> : <Tag color="default">无</Tag>
                    )},
                    { title: '级别', dataIndex: 'level', key: 'level', width: 60 },
                    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s: string) => statusLabels[s] || s },
                    { title: '推荐时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => d ? new Date(d).toLocaleString() : '-' },
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
    </div>
  );
};

export default ReferralCodesPage;
