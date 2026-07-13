import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Tabs, InputNumber, Collapse, Space, Tag, Typography } from 'antd';
import { SettingOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { configService } from '../../services/config.service';
import ImageUpload from '../../components/ImageUpload';
import BannerUpload from '../../components/BannerUpload';

const { TextArea } = Input;
const { Panel } = Collapse;
const { Text } = Typography;

interface ConfigData {
  [key: string]: string;
}

const SystemSettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allConfig, setAllConfig] = useState<ConfigData>({});

  // 配置分组
  const [basicConfig, setBasicConfig] = useState<ConfigData>({});
  const [scoreConfig, setScoreConfig] = useState<ConfigData>({});
  const [withdrawConfig, setWithdrawConfig] = useState<ConfigData>({});
  const [referralConfig, setReferralConfig] = useState<ConfigData>({});
  const [salonConfig, setSalonConfig] = useState<ConfigData>({});
  const [archiveConfig, setArchiveConfig] = useState<ConfigData>({});
  const [otherConfig, setOtherConfig] = useState<ConfigData>({});

  // 获取配置
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await configService.getConfig();
      if (res.data) {
        const data = res.data;
        setAllConfig(data);

        // 基础配置
        setBasicConfig({
          site_name: data.site_name || '',
          site_logo: data.site_logo || '',
          home_banner: data.home_banner || data.hero_slides || '',
          customer_service_wechat: data.customer_service_wechat || '',
          customer_service_phone: data.customer_service_phone || '',
          hero_slides: data.hero_slides || data.home_banner || '',
          grid2_dating_bg: data.grid2_dating_bg || '',
          grid2_salon_bg: data.grid2_salon_bg || '',
          grid4_charity_bg: data.grid4_charity_bg || '',
          grid4_partner_bg: data.grid4_partner_bg || '',
          grid4_city_bg: data.grid4_city_bg || '',
          grid4_community_bg: data.grid4_community_bg || '',
          grid4_male_salon_bg: data.grid4_male_salon_bg || '',
          grid4_female_salon_bg: data.grid4_female_salon_bg || '',
        });

        // 评分配置
        setScoreConfig({
          score_min_register: data.score_min_register || '0',
          score_min_publish: data.score_min_publish || '60',
          score_high_threshold: data.score_high_threshold || '80',
        });

        // 提现配置
        setWithdrawConfig({
          withdraw_min_amount: data.withdraw_min_amount || '100',
          withdraw_max_amount: data.withdraw_max_amount || '5000',
          withdraw_fee_rate: data.withdraw_fee_rate || '0.006',
          city_franchisee_withdrawal_rate: data.city_franchisee_withdrawal_rate || '0.70',
          community_station_withdrawal_fee_rate: data.community_station_withdrawal_fee_rate || '0.13',
        });

        // 推荐奖励配置
        setReferralConfig({
          referral_register_reward: data.referral_register_reward || '10',
          referral_partner_reward: data.referral_partner_reward || '50',
          referral_professional_reward: data.referral_professional_reward || '100',
          registration_platform_rate: data.registration_platform_rate || '0.50',
          registration_referrer_rate: data.registration_referrer_rate || '0.50',
          registration_station_rate: data.registration_station_rate || '0.10',
          community_station_fund_rate: data.community_station_fund_rate || '0.10',
          community_station_referrer_fund_rate: data.community_station_referrer_fund_rate || '0.10',
        });

        // 沙龙配置
        setSalonConfig({
          salon_ticket_promo: data.salon_ticket_promo || '299',
          salon_ticket_regular: data.salon_ticket_regular || '399',
          salon_host_revenue_promo: data.salon_host_revenue_promo || '200',
          salon_host_revenue_regular: data.salon_host_revenue_regular || '200',
          salon_platform_fee_regular: data.salon_platform_fee_regular || '100',
        });

        // 建档费配置
        setArchiveConfig({
          archive_fee: data.archive_fee || '199',
          archive_fee_promo: data.archive_fee_promo || '0.19',
          archive_quota_total: data.archive_quota_total || '199',
          archive_quota_used: data.archive_quota_used || '0',
        });

        // 其他配置
        setOtherConfig({
          city_franchisee_join_fee: data.city_franchisee_join_fee || '10000',
          about_us: data.about_us || '',
          privacy_policy: data.privacy_policy || '',
          user_agreement: data.user_agreement || '',
        });
      }
    } catch (err: any) {
      message.error('获取配置失败：' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // 保存配置
  const handleSave = async (values: ConfigData, configType: string) => {
    setSaving(true);
    try {
      await configService.updateConfig(values);
      message.success(`${configType}保存成功`);
      fetchConfig();
    } catch (err: any) {
      message.error('保存失败：' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const tabItems = [
    {
      key: 'basic',
      label: '基础配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...basicConfig, ...values }, '基础配置')}
          initialValues={basicConfig}
        >
          <Collapse defaultActiveKey={['1', '2']}>
            <Panel header="站点信息" key="1">
              <Form.Item label="站点名称" name="site_name">
                <Input placeholder="请输入站点名称" />
              </Form.Item>
              <Form.Item label="站点Logo" tooltip="网站Logo图片">
                <Form.Item name="site_logo" noStyle>
                  <ImageUpload
                    maxSizeMB={1}
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    tip="支持 JPG、PNG、WebP、SVG 格式，大小不超过 1MB，建议尺寸 200×60px"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="客服微信" name="customer_service_wechat">
                <Input placeholder="请输入客服微信号" />
              </Form.Item>
              <Form.Item label="客服电话" name="customer_service_phone">
                <Input placeholder="请输入客服电话" />
              </Form.Item>
            </Panel>

            <Panel header="首页Banner轮播图" key="2">
              <Form.Item
                label="轮播图配置"
                tooltip="首页顶部轮播广告图，支持多张，每张可配置跳转页面"
              >
                <Form.Item name="hero_slides" noStyle>
                  <BannerUpload
                    maxSizeMB={2}
                    maxCount={5}
                    accept="image/jpeg,image/png,image/webp"
                  />
                </Form.Item>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                提示：上传后可选择跳转页面（首页、会员档案、沙龙列表等）或填写外部链接。拖动卡片可调整顺序。
              </Text>
            </Panel>

            <Panel header="宫格背景图配置" key="3">
              <Form.Item label="社交宫格背景图" tooltip="首页社交宫格的背景图片">
                <Form.Item name="grid2_dating_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="沙龙宫格背景图" tooltip="首页沙龙宫格的背景图片">
                <Form.Item name="grid2_salon_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="公益宫格背景图" tooltip="首页公益宫格的背景图片">
                <Form.Item name="grid4_charity_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="合伙人宫格背景图" tooltip="首页合伙人宫格的背景图片">
                <Form.Item name="grid4_partner_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="城市宫格背景图" tooltip="首页城市宫格的背景图片">
                <Form.Item name="grid4_city_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="社区宫格背景图" tooltip="首页社区宫格的背景图片">
                <Form.Item name="grid4_community_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="男性沙龙宫格背景图" tooltip="首页男性沙龙宫格的背景图片">
                <Form.Item name="grid4_male_salon_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
              <Form.Item label="女性沙龙宫格背景图" tooltip="首页女性沙龙宫格的背景图片">
                <Form.Item name="grid4_female_salon_bg" noStyle>
                  <ImageUpload
                    maxSizeMB={2}
                    accept="image/jpeg,image/png,image/webp"
                    tip="支持 JPG、PNG、WebP 格式，大小不超过 2MB，建议尺寸 400×400px（方形）"
                  />
                </Form.Item>
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存基础配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'score',
      label: '评分配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...scoreConfig, ...values }, '评分配置')}
          initialValues={scoreConfig}
        >
          <Form.Item label="注册最低评分" name="score_min_register" tooltip="用户注册时的最低评分要求（0-100）">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="发布最低评分" name="score_min_publish" tooltip="用户发布个人动态的最低评分要求（0-100）">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="高分阈值" name="score_high_threshold" tooltip="评分高于此值视为优质用户（0-100）">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存评分配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'withdraw',
      label: '提现配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...withdrawConfig, ...values }, '提现配置')}
          initialValues={withdrawConfig}
        >
          <Collapse defaultActiveKey={['1', '2']}>
            <Panel header="普通用户提现配置" key="1">
              <Form.Item label="最低提现金额（元）" name="withdraw_min_amount">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最高提现金额（元）" name="withdraw_max_amount">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="提现手续费比例" name="withdraw_fee_rate" tooltip="0.006表示0.6%（微信支付渠道费）">
                <InputNumber min={0} max={1} step={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>

            <Panel header="合伙人/驿站提现配置" key="2">
              <Form.Item
                label="城市合伙人提现费率"
                name="city_franchisee_withdrawal_rate"
                tooltip="城市合伙人提现时平台抽成比例（0.70表示合伙人得70%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="社区服务站提现手续费率"
                name="community_station_withdrawal_fee_rate"
                tooltip="社区服务站提现手续费率（0.13表示13%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存提现配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'referral',
      label: '推荐奖励配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...referralConfig, ...values }, '推荐奖励配置')}
          initialValues={referralConfig}
        >
          <Collapse defaultActiveKey={['1', '2', '3']}>
            <Panel header="推荐奖励金额" key="1">
              <Form.Item label="注册推荐奖励（元）" name="referral_register_reward" tooltip="推荐用户注册获得的奖励">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="合伙人推荐奖励（元）" name="referral_partner_reward" tooltip="推荐合伙人获得的奖励">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="专业人士推荐奖励（元）" name="referral_professional_reward" tooltip="推荐专业人士获得的奖励">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>

            <Panel header="注册分成比例" key="2">
              <Form.Item
                label="平台分成比例"
                name="registration_platform_rate"
                tooltip="用户注册付费时平台分成比例（0.50表示50%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="推荐人分成比例"
                name="registration_referrer_rate"
                tooltip="用户注册付费时推荐人分成比例（0.50表示50%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="驿站分成比例"
                name="registration_station_rate"
                tooltip="用户注册付费时驿站分成比例（0.10表示10%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>

            <Panel header="社区服务站沉淀资金配置" key="3">
              <Form.Item
                label="驿站沉淀资金比例"
                name="community_station_fund_rate"
                tooltip="社区服务站享受沉淀资金比例（0.10表示10%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="联创推荐官驿站推荐奖励比例"
                name="community_station_referrer_fund_rate"
                tooltip="联创推荐官推荐社区服务站后永久享受沉淀资金比例（0.10表示10%）"
              >
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存推荐奖励配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'salon',
      label: '沙龙配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...salonConfig, ...values }, '沙龙配置')}
          initialValues={salonConfig}
        >
          <Collapse defaultActiveKey={['1', '2']}>
            <Panel header="沙龙票价配置" key="1">
              <Form.Item label="沙龙票价-优惠期（元/人）" name="salon_ticket_promo" tooltip="优惠期沙龙票价">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="沙龙票价-正价期（元/人）" name="salon_ticket_regular" tooltip="正价期沙龙票价">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>

            <Panel header="沙龙收益配置" key="2">
              <Form.Item label="主办方收益-优惠期（元/人）" name="salon_host_revenue_promo">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="主办方收益-正价期（元/人）" name="salon_host_revenue_regular">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="平台服务费-正价期（元/人）" name="salon_platform_fee_regular">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存沙龙配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'archive',
      label: '建档费配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...archiveConfig, ...values }, '建档费配置')}
          initialValues={archiveConfig}
        >
          <Form.Item label="单身会员建档费（元）" name="archive_fee">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="会员建档费-活动价（元）" name="archive_fee_promo" tooltip="活动价，0.19表示0.19元">
            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="会员建档费活动价名额（个）" name="archive_quota_total">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="会员建档费活动价已用名额（个）" name="archive_quota_used">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存建档费配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'other',
      label: '其他配置',
      children: (
        <Form
          layout="vertical"
          onFinish={(values) => handleSave({ ...otherConfig, ...values }, '其他配置')}
          initialValues={otherConfig}
        >
          <Form.Item label="城市合伙人加盟费（元）" name="city_franchisee_join_fee">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="关于我们" name="about_us">
            <TextArea rows={6} placeholder="请输入关于我们的内容" />
          </Form.Item>
          <Form.Item label="隐私政策" name="privacy_policy">
            <TextArea rows={6} placeholder="请输入隐私政策" />
          </Form.Item>
          <Form.Item label="用户协议" name="user_agreement">
            <TextArea rows={6} placeholder="请输入用户协议" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存其他配置
            </Button>
            <Button style={{ marginLeft: 12 }} onClick={fetchConfig} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SettingOutlined style={{ fontSize: 24, marginRight: 12 }} />
          <h2 style={{ margin: 0 }}>系统设置</h2>
        </div>
        <Space>
          <Tag color="blue">配置项总数: {Object.keys(allConfig).length}</Tag>
          <Button onClick={fetchConfig} icon={<ReloadOutlined />} loading={loading}>
            刷新配置
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
