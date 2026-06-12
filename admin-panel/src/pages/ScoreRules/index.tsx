import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Modal, InputNumber, Input, Form, message, Space, Popconfirm } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import scoreService from '../../services/score.service';

interface ScoreRule {
  id: number;
  field_key: string;
  field_group: string;
  field_label: string;
  max_score: number;
  is_required: number;
  sort_order: number;
  status: string;
}

const groupLabelMap: Record<string, string> = {
  basic: '基础信息', career: '职业收入', hobby: '兴趣爱好',
  preference: '择偶需求', verification: '认证', asset: '资产',
};

const ScoreRulesPage: React.FC = () => {
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoreRule | null>(null);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await scoreService.getRules();
      if (res.code === 0) {
        setRules(res.data);
      }
    } catch (error) {
      message.error('获取评分规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleEdit = (rule: ScoreRule) => {
    setEditingRule(rule);
    form.setFieldsValue({ max_score: rule.max_score, field_label: rule.field_label });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    try {
      const values = await form.validateFields();
      const res = await scoreService.updateRule(editingRule.id, values);
      if (res.code === 0) {
        message.success('更新成功');
        setEditModalVisible(false);
        fetchRules();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await scoreService.toggleRule(id);
      if (res.code === 0) {
        message.success(res.message);
        fetchRules();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 按分组组织规则
  const groupedRules: Record<string, ScoreRule[]> = {};
  rules.forEach((r) => {
    const group = r.field_group || 'other';
    if (!groupedRules[group]) groupedRules[group] = [];
    groupedRules[group].push(r);
  });

  const columns = [
    { title: '字段', dataIndex: 'field_label', key: 'field_label', width: 120 },
    { title: '字段Key', dataIndex: 'field_key', key: 'field_key', width: 140, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '分值', dataIndex: 'max_score', key: 'max_score', width: 80, render: (v: number) => <Tag color="blue">{v}分</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'active' ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: ScoreRule) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title={record.status === 'active' ? '确认禁用？' : '确认启用？'} onConfirm={() => handleToggle(record.id)}>
            <Button size="small" type={record.status === 'active' ? 'default' : 'primary'}>
              {record.status === 'active' ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="评分规则管理" subtitle="6维度100分评分体系" />

      {Object.entries(groupedRules).map(([group, groupRules]) => (
        <Card
          key={group}
          title={`${groupLabelMap[group] || group}（${groupRules.reduce((s, r) => s + r.max_score, 0)}分）`}
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Table
            dataSource={groupRules}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
          />
        </Card>
      ))}

      <Modal
        title="编辑评分规则"
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="字段名称" name="field_label">
            <Input />
          </Form.Item>
          <Form.Item label="分值" name="max_score" rules={[{ required: true, message: '请输入分值' }]}>
            <InputNumber min={0} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScoreRulesPage;
