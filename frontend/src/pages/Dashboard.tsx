import { Card, Row, Col, Statistic, Typography, Tag, Space, Badge, Skeleton } from 'antd';
import {
  ExperimentOutlined, ClockCircleOutlined, CheckCircleOutlined,
  WarningOutlined, FileTextOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { reportsApi } from '../api/reports';

const { Title, Text } = Typography;

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  INITIATED:    { color: 'default',    label: 'Initiated' },
  IN_PROGRESS:  { color: 'processing', label: 'In Progress' },
  COMPLETED:    { color: 'warning',    label: 'Completed' },
  UNDER_REVIEW: { color: 'warning',    label: 'Under Review' },
  APPROVED:     { color: 'success',    label: 'Released' },
  REJECTED:     { color: 'error',      label: 'Rejected' },
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: reportsApi.dashboardStats,
    refetchInterval: 60_000,
  });

  const STATS = [
    {
      title: 'Active Batch Records',
      value: stats?.active_batches ?? 0,
      icon: <ExperimentOutlined />,
      color: '#1677ff',
    },
    {
      title: 'Pending QA Review',
      value: stats?.pending_review ?? 0,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
    },
    {
      title: 'Released This Month',
      value: stats?.released_this_month ?? 0,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: 'Open Deviations',
      value: stats?.open_deviations ?? 0,
      icon: <WarningOutlined />,
      color: '#ff4d4f',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Welcome, {user?.full_name}</Title>
        <Text type="secondary">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {STATS.map(stat => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <Card>
              {isLoading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  prefix={<span style={{ color: stat.color }}>{stat.icon}</span>}
                  valueStyle={{ color: stat.color }}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><ExperimentOutlined /> Recent Batch Activity</Space>}
            extra={<a onClick={() => navigate('/ebr')}>View All</a>}
          >
            {isLoading ? (
              <Skeleton active />
            ) : stats?.recent_batches?.length ? (
              <div>
                {stats.recent_batches.map(batch => {
                  const cfg = STATUS_CFG[batch.status] ?? { color: 'default', label: batch.status };
                  return (
                    <div
                      key={batch.id}
                      onClick={() => navigate(`/ebr/${batch.id}`)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                      }}
                    >
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 13 }}>{batch.batch_number}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{batch.product_name}</Text>
                      </Space>
                      <Space>
                        <Badge status={cfg.color as any} text={cfg.label} />
                        <Tag style={{ fontSize: 10, margin: 0 }}>{batch.ebr_number}</Tag>
                      </Space>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#ccc' }}>
                <ExperimentOutlined style={{ fontSize: 40, marginBottom: 8, display: 'block' }} />
                <Text type="secondary">No batch records yet</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<Space><TeamOutlined /> My Access Profile</Space>}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>ASSIGNED ROLES</Text>
              <div style={{ marginTop: 6 }}>
                <Space wrap>
                  {user?.roles.map(r => <Tag key={r.id} color="blue">{r.name}</Tag>)}
                  {user?.roles.length === 0 && <Text type="secondary">No roles assigned</Text>}
                </Space>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>PERMISSIONS</Text>
              <div style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13 }}>{user?.permissions.length ?? 0} permissions granted</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<Space><FileTextOutlined /> Phase Roadmap</Space>}>
            <Row gutter={[16, 8]}>
              {[
                { phase: 'Phase 1', name: 'Auth + RBAC + Audit Trail',           status: 'complete' },
                { phase: 'Phase 2', name: 'Master Batch Record (MBR) Builder',   status: 'complete' },
                { phase: 'Phase 3', name: 'Batch Execution Engine (EBR)',         status: 'complete' },
                { phase: 'Phase 4', name: 'Equipment + Materials Management',     status: 'complete' },
                { phase: 'Phase 5', name: 'Quality, Deviations & CAPA',           status: 'complete' },
                { phase: 'Phase 6', name: 'E-Signatures + Workflow Approvals',    status: 'complete' },
                { phase: 'Phase 7', name: 'Reports + Batch Release',              status: 'complete' },
                { phase: 'Phase 8', name: 'Analytics & Trends',                  status: 'complete' },
                { phase: 'Phase 9', name: 'Notifications & Alerts',              status: 'complete' },
                { phase: 'Phase 10', name: 'Batch Scheduling & Production Calendar', status: 'complete' },
                { phase: 'Phase 11', name: 'Training Records & Operator Qualifications', status: 'complete' },
              ].map(item => (
                <Col xs={24} sm={12} lg={8} key={item.phase}>
                  <div style={{
                    padding: '10px 16px', background: '#fafafa', borderRadius: 6,
                    borderLeft: `3px solid #52c41a`,
                  }}>
                    <Text strong style={{ fontSize: 12, color: '#52c41a' }}>{item.phase}</Text>
                    <br />
                    <Text style={{ fontSize: 13 }}>{item.name}</Text>
                    <br />
                    <Tag color="success" style={{ marginTop: 4, fontSize: 11 }}>Complete</Tag>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
