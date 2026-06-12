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
} from '@ant-design/icons';
import { logout } from '../utils/auth.util';

const { Sider, Header, Content } = Layout;

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
    {
      key: '/activities',
      icon: <CalendarOutlined />,
      label: '活动管理',
    },
    {
      key: '/salon-config',
      icon: <AppstoreOutlined />,
      label: '沙龙配置',
    },
    {
      key: '/score-rules',
      icon: <StarOutlined />,
      label: '评分规则',
    },
    {
      key: '/archives',
      icon: <FolderOutlined />,
      label: '档案管理',
    },
    {
      key: '/premium-verify',
      icon: <SafetyCertificateOutlined />,
      label: '验资 & 托管',
    },
    {
      key: '/commissions',
      icon: <DollarOutlined />,
      label: '佣金管理',
    },
    {
      key: '/orders',
      icon: <FileTextOutlined />,
      label: '订单管理',
    },
    {
      key: '/referral-codes',
      icon: <QrcodeOutlined />,
      label: '推荐码管理',
    },
    {
      key: '/stations',
      icon: <ShopOutlined />,
      label: '服务站管理',
    },
    {
      key: '/partners',
      icon: <TeamOutlined />,
      label: '合伙人管理',
    },
    {
      key: '/withdrawals',
      icon: <WalletOutlined />,
      label: '提现管理',
    },
    {
      key: '/fund-custody',
      icon: <BankOutlined />,
      label: '基金托管',
    },
    {
      key: '/system-settings',
      icon: <SettingOutlined />,
      label: '系统设置',
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
