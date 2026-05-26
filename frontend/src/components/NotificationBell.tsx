import { Badge, Button, Dropdown, Typography, Space, Empty, Divider, Spin } from 'antd';
import {
  BellOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, ExperimentOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type Notification } from '../api/notifications';

const { Text } = Typography;

const TYPE_CFG: Record<string, { icon: React.ReactNode; color: string }> = {
  EBR_SUBMITTED:    { icon: <ExperimentOutlined />, color: '#1677ff' },
  EBR_APPROVED:     { icon: <CheckCircleOutlined />, color: '#22c55e' },
  EBR_REJECTED:     { icon: <CloseCircleOutlined />, color: '#ef4444' },
  MBR_SUBMITTED:    { icon: <FileTextOutlined />,   color: '#1677ff' },
  MBR_APPROVED:     { icon: <CheckCircleOutlined />, color: '#22c55e' },
  MBR_REJECTED:     { icon: <CloseCircleOutlined />, color: '#ef4444' },
  DEVIATION_OPENED: { icon: <WarningOutlined />,     color: '#f97316' },
  DEVIATION_CLOSED: { icon: <CheckCircleOutlined />, color: '#22c55e' },
  CAPA_OPENED:      { icon: <WarningOutlined />,     color: '#a855f7' },
  CAPA_OVERDUE:     { icon: <WarningOutlined />,     color: '#ef4444' },
  SYSTEM:           { icon: <BellOutlined />,        color: '#64748b' },
};

const RESOURCE_PATHS: Record<string, string> = {
  ebr:       '/ebr',
  mbr:       '/mbr',
  deviation: '/quality',
  capa:      '/quality',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const navigate = useNavigate();
  const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.SYSTEM;

  const handleClick = () => {
    if (!n.is_read) onRead(n.id);
    if (n.resource_type && n.resource_id) {
      const base = RESOURCE_PATHS[n.resource_type];
      if (base) navigate(`${base}/${n.resource_id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', gap: 10, padding: '10px 16px', cursor: 'pointer',
        background: n.is_read ? 'transparent' : '#eff6ff',
        borderLeft: `3px solid ${n.is_read ? 'transparent' : cfg.color}`,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ color: cfg.color, fontSize: 16, marginTop: 2 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13, marginBottom: 2 }}>
          {n.title}
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n.message}
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
      </div>
      {!n.is_read && (
        <div style={{ width: 8, height: 8, borderRadius: '50%',
          background: cfg.color, flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(false, 20),
    refetchInterval: 30_000,
  });

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const unread = countData?.unread ?? 0;
  const items = data?.items ?? [];

  const panel = (
    <div style={{ width: 360, background: '#fff', borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #f0f0f0' }}>
        <Space>
          <BellOutlined style={{ color: '#1677ff' }} />
          <Text strong>Notifications</Text>
          {unread > 0 && (
            <Badge count={unread} style={{ backgroundColor: '#1677ff' }} />
          )}
        </Space>
        {unread > 0 && (
          <Button
            type="link" size="small" style={{ padding: 0, fontSize: 12 }}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description="No notifications"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '32px 0' }} />
        ) : (
          items.map((n, i) => (
            <div key={n.id}>
              <NotifItem n={n} onRead={(id) => markRead.mutate(id)} />
              {i < items.length - 1 && <Divider style={{ margin: 0 }} />}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => panel}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      trigger={['click']}
    >
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18, color: unread > 0 ? '#1677ff' : '#666' }} />}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Dropdown>
  );
}
