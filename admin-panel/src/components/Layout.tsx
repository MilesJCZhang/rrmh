import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  CalendarOutlined,
  QrcodeOutlined,
  ShopOutlined,
  TeamOutlined,
  WalletOutlined,
  LogoutOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  FolderOutlined,
  FileTextOutlined,
  BankOutlined,
  SettingOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AuditOutlined,
  BarChartOutlined,
  EyeOutlined,
  MoneyCollectOutlined,
  ProfileOutlined,
  FileProtectOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { logout } from '../utils/auth.util';

const { Sider, Header, Content } = Layout;

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(
    // 初始化：根据当前路径自动展开对应父菜单
    (() => {
      const path = location.pathname;
      if (path.startsWith('/users') || path.startsWith('/verifications') || path.startsWith('/referral-codes') || path.startsWith('/referral-visitors')) return ['user-system'];
      if (path.startsWith('/activities') || path.startsWith('/salon-config')) return ['business'];
      if (path.startsWith('/archives') || path.startsWith('/premium-verify') || path.startsWith('/fund-custody')) return ['archive'];
      if (path.startsWith('/finance') || path === '/withdrawals' || path === '/commissions' || path === '/orders') return ['finance'];
      if (path.startsWith('/partners') || path.startsWith('/stations')) return ['partner'];
      if (path.startsWith('/system-settings') || path.startsWith('/score-rules') || path === '/score-rules') return ['config'];
      return [];
    })()
  );

  const menuItems = [
    // ========== 总览仪表盘 ==========
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '总览仪表盘',
    },

    // ========== 用户体系 ==========
    {
      key: 'user-system',
      icon: <UserOutlined />,
      label: '用户体系',
      children: [
        { key: '/users', label: '用户管理' },
        { key: '/verifications', label: '实名认证' },
        { key: '/referral-codes', label: '推荐码管理' },
        { key: '/referral-visitors', label: '访客管理', icon: <EyeOutlined /> },
      ],
    },

    // ========== 业务活动 ==========
    {
      key: 'business',
      icon: <CalendarOutlined />,
      label: '业务活动',
      children: [
        { key: '/activities', label: '活动管理' },
        { key: '/salon-config', label: '沙龙配置' },
      ],
    },

    // ========== 档案资质 ==========
    {
      key: 'archive',
      icon: <FolderOutlined />,
      label: '档案资质',
      children: [
        { key: '/archives', label: '档案管理' },
        { key: '/premium-verify', label: '验资托管' },
        { key: '/fund-custody', label: '基金托管' },
      ],
    },

    // ========== 交易财务 ==========
    {
      key: 'finance',
      icon: <MoneyCollectOutlined />,
      label: '交易财务',
      children: [
        { key: '/finance/earnings', label: '收益明细' },
        { key: '/finance/payments', label: '支付记录' },
        { key: '/finance/passive-earnings', label: '被动收益' },
        { key: '/withdrawals', label: '提现管理' },
        { key: '/commissions', label: '佣金管理' },
        { key: '/orders', label: '订单管理' },
      ],
    },

    // ========== 渠道合伙人 ==========
    {
      key: 'partner',
      icon: <TeamOutlined />,
      label: '渠道合伙人',
      children: [
        { key: '/partners', label: '合伙人管理' },
        { key: '/stations', label: '服务站管理' },
      ],
    },

    // ========== 系统配置 ==========
    {
      key: 'config',
      icon: <ToolOutlined />,
      label: '系统配置',
      children: [
        { key: '/system-settings', label: '系统设置' },
        { key: '/score-rules', label: '评分规则' },
      ],
    },

    // ========== 数据统计 ==========
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '数据统计',
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        breakpoint="lg"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={60}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '18px',
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          {collapsed ? '人' : '人人媒好'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
          }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: 'white',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出登录
          </Button>
        </Header>
        <Content style={{
          margin: '24px',
          padding: '24px',
          background: 'white',
          borderRadius: '8px',
          minHeight: 'calc(100vh - 112px)'
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
