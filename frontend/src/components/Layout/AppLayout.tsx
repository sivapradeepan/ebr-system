import { Layout, Avatar, Dropdown, Typography, Space, Tag } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from '../NotificationBell';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const userMenuItems = [
    { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true, onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        theme="dark"
        style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 10, overflow: 'auto' }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Text strong style={{ color: '#fff', fontSize: 15 }}>EBR System</Text>
          <br />
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Electronic Batch Record</Text>
        </div>
        <Sidebar />
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 9,
        }}>
          <Text strong style={{ fontSize: 14, color: '#555' }}>
            21 CFR Part 11 Compliant Platform
          </Text>
          <Space>
            <NotificationBell />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} size="small" />
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name}</div>
                  <div style={{ fontSize: 11 }}>
                    {user?.roles.map(r => (
                      <Tag key={r.id} color="blue" style={{ fontSize: 10, marginRight: 2, padding: '0 4px' }}>{r.name}</Tag>
                    ))}
                  </div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
