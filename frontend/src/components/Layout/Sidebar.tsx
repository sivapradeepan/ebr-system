import { Menu } from 'antd';
import {
  DashboardOutlined, TeamOutlined, SafetyOutlined,
  FileTextOutlined, ExperimentOutlined, ToolOutlined,
  MedicineBoxOutlined, AuditOutlined, SettingOutlined,
  BarChartOutlined, CalendarOutlined, BookOutlined,
  ApiOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', permission: null },
  { key: '/mbr', icon: <FileTextOutlined />, label: 'Master Batch Records', permission: 'mbr:read' },
  { key: '/ebr', icon: <ExperimentOutlined />, label: 'Batch Execution', permission: 'ebr:read' },
  { key: '/schedule', icon: <CalendarOutlined />, label: 'Production Schedule', permission: 'ebr:read' },
  { key: '/equipment', icon: <ToolOutlined />, label: 'Equipment', permission: 'equipment:read' },
  { key: '/materials', icon: <MedicineBoxOutlined />, label: 'Materials', permission: 'materials:read' },
  { key: '/quality', icon: <SafetyOutlined />, label: 'Quality', permission: 'quality:read' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics', permission: null },
  { key: '/training',  icon: <BookOutlined />,     label: 'Training Records', permission: null },
  { key: '/integration/idoc', icon: <SwapOutlined />, label: 'IDoc Interface', permission: 'integration:read' },
  { key: '/integration/opc',  icon: <ApiOutlined />,  label: 'OPC Interface',  permission: 'integration:read' },
  { key: '/audit', icon: <AuditOutlined />, label: 'Audit Trail', permission: 'audit:read' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users', permission: 'users:read' },
  { key: '/roles', icon: <SettingOutlined />, label: 'Roles', permission: 'roles:read' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuthStore();

  const items = MENU_ITEMS
    .filter(item => !item.permission || hasPermission(item.permission))
    .map(item => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
      onClick: () => navigate(item.key),
    }));

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
}
