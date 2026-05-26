import {
  Card, Table, Button, Space, Input, Select, Typography,
  Tag, Badge, Tabs, Row, Col, Statistic, Tooltip, message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, SafetyOutlined,
  WarningOutlined, FileSearchOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { deviationApi, capaApi } from '../../api/quality';
import { useAuthStore } from '../../store/authStore';
import type {
  DeviationSummary, DeviationType, DeviationSeverity, DeviationStatus,
  CAPAOut, CAPAType, CAPAStatus,
} from '../../types/quality';

const { Title } = Typography;

const SEVERITY_COLOR: Record<DeviationSeverity, string> = {
  CRITICAL: 'error',
  MAJOR: 'warning',
  MINOR: 'default',
};

const DEV_STATUS_CFG: Record<DeviationStatus, { badge: string; label: string }> = {
  OPEN:                 { badge: 'error',      label: 'Open' },
  UNDER_INVESTIGATION:  { badge: 'processing', label: 'Under Investigation' },
  PENDING_CAPA:         { badge: 'warning',    label: 'Pending CAPA' },
  RESOLVED:             { badge: 'success',    label: 'Resolved' },
  CLOSED:               { badge: 'default',    label: 'Closed' },
};

const CAPA_STATUS_CFG: Record<CAPAStatus, { badge: string; label: string }> = {
  OPEN:                 { badge: 'default',    label: 'Open' },
  IN_PROGRESS:          { badge: 'processing', label: 'In Progress' },
  PENDING_VERIFICATION: { badge: 'warning',    label: 'Pending Verification' },
  VERIFIED:             { badge: 'success',    label: 'Verified' },
  CLOSED:               { badge: 'default',    label: 'Closed' },
};

const TYPE_COLOR: Record<DeviationType, string> = {
  PROCESS: 'blue', EQUIPMENT: 'orange', MATERIAL: 'purple',
  ENVIRONMENTAL: 'cyan', DOCUMENTATION: 'gold', OTHER: 'default',
};

const CAPA_TYPE_COLOR: Record<CAPAType, string> = {
  CORRECTIVE: 'red', PREVENTIVE: 'green', BOTH: 'purple',
};

function DeviationsTab() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['deviations', page, search, severity, status],
    queryFn: () => deviationApi.list({ page, size: 20, search: search || undefined, severity, status }),
  });

  const columns = [
    {
      title: 'Deviation',
      key: 'dev',
      render: (_: any, r: DeviationSummary) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, fontWeight: 700, height: 'auto' }}
            onClick={() => navigate(`/quality/deviations/${r.id}`)}>
            {r.title}
          </Button>
          <Tag style={{ fontSize: 10 }}>{r.deviation_number}</Tag>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'deviation_type',
      key: 'type',
      render: (v: DeviationType) => <Tag color={TYPE_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: DeviationSeverity) => <Tag color={SEVERITY_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: DeviationStatus) => (
        <Badge status={DEV_STATUS_CFG[v].badge as any} text={DEV_STATUS_CFG[v].label} />
      ),
    },
    {
      title: 'Batch',
      key: 'batch',
      render: (_: any, r: DeviationSummary) => r.batch_number
        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.batch_number}</span>
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Detected By',
      key: 'by',
      render: (_: any, r: DeviationSummary) => r.detected_by.full_name,
    },
    {
      title: 'Date',
      dataIndex: 'detected_at',
      key: 'date',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, r: DeviationSummary) => (
        <Button size="small" onClick={() => navigate(`/quality/deviations/${r.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col>
            <Input placeholder="Search title, number, batch..."
              prefix={<SearchOutlined />} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 280 }} allowClear />
          </Col>
          <Col>
            <Select placeholder="Severity" style={{ width: 130 }} allowClear
              onChange={v => { setSeverity(v); setPage(1); }}
              options={[
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'MAJOR', label: 'Major' },
                { value: 'MINOR', label: 'Minor' },
              ]} />
          </Col>
          <Col>
            <Select placeholder="Status" style={{ width: 180 }} allowClear
              onChange={v => { setStatus(v); setPage(1); }}
              options={Object.entries(DEV_STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))} />
          </Col>
        </Row>
        {hasPermission('quality:manage') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quality/deviations/new')}>
            Raise Deviation
          </Button>
        )}
      </div>
      <Table dataSource={data?.items} columns={columns} rowKey="id" loading={isLoading}
        pagination={{ current: page, pageSize: 20, total: data?.total, onChange: setPage,
          showTotal: t => `${t} deviations` }} />
    </div>
  );
}

function CAPAsTab() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [capaType, setCapaType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['capas', page, search, capaType, status],
    queryFn: () => capaApi.list({ page, size: 20, search: search || undefined, capa_type: capaType, status }),
  });

  const columns = [
    {
      title: 'CAPA',
      key: 'capa',
      render: (_: any, r: CAPAOut) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, fontWeight: 700, height: 'auto' }}
            onClick={() => navigate(`/quality/capas/${r.id}`)}>
            {r.title}
          </Button>
          <Space size={4}>
            <Tag style={{ fontSize: 10 }}>{r.capa_number}</Tag>
            <Tag color={CAPA_TYPE_COLOR[r.capa_type]} style={{ fontSize: 10 }}>{r.capa_type}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Linked Deviation',
      key: 'dev',
      render: (_: any, r: CAPAOut) => (
        <Button type="link" style={{ padding: 0, fontSize: 12 }}
          onClick={() => navigate(`/quality/deviations/${r.deviation.id}`)}>
          {r.deviation.deviation_number}
        </Button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: CAPAStatus) => (
        <Badge status={CAPA_STATUS_CFG[v].badge as any} text={CAPA_STATUS_CFG[v].label} />
      ),
    },
    {
      title: 'Assigned To',
      key: 'assigned',
      render: (_: any, r: CAPAOut) => r.assigned_to?.full_name || <span style={{ color: '#ccc' }}>Unassigned</span>,
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due',
      render: (v: string) => {
        if (!v) return <span style={{ color: '#ccc' }}>—</span>;
        const due = new Date(v);
        const overdue = due < new Date() && v !== null;
        return <span style={{ color: overdue ? '#ff4d4f' : undefined }}>{due.toLocaleDateString()}</span>;
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, r: CAPAOut) => (
        <Button size="small" onClick={() => navigate(`/quality/capas/${r.id}`)}>View</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col>
            <Input placeholder="Search CAPA title or number..."
              prefix={<SearchOutlined />} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 280 }} allowClear />
          </Col>
          <Col>
            <Select placeholder="Type" style={{ width: 150 }} allowClear
              onChange={v => { setCapaType(v); setPage(1); }}
              options={[
                { value: 'CORRECTIVE', label: 'Corrective' },
                { value: 'PREVENTIVE', label: 'Preventive' },
                { value: 'BOTH', label: 'Both' },
              ]} />
          </Col>
          <Col>
            <Select placeholder="Status" style={{ width: 200 }} allowClear
              onChange={v => { setStatus(v); setPage(1); }}
              options={Object.entries(CAPA_STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))} />
          </Col>
        </Row>
        {hasPermission('quality:manage') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quality/capas/new')}>
            New CAPA
          </Button>
        )}
      </div>
      <Table dataSource={data?.items} columns={columns} rowKey="id" loading={isLoading}
        pagination={{ current: page, pageSize: 20, total: data?.total, onChange: setPage,
          showTotal: t => `${t} CAPAs` }} />
    </div>
  );
}

export default function QualityDashboard() {
  const { data: devData } = useQuery({
    queryKey: ['deviations', 'stats'],
    queryFn: () => deviationApi.list({ size: 100 }),
  });
  const { data: capaData } = useQuery({
    queryKey: ['capas', 'stats'],
    queryFn: () => capaApi.list({ size: 100 }),
  });

  const openDevs = devData?.items.filter(d => d.status === 'OPEN').length ?? 0;
  const criticalDevs = devData?.items.filter(d => d.severity === 'CRITICAL' && d.status !== 'CLOSED').length ?? 0;
  const openCapas = capaData?.items.filter(c => c.status !== 'CLOSED' && c.status !== 'VERIFIED').length ?? 0;
  const overdueCapas = capaData?.items.filter(c =>
    c.due_date && new Date(c.due_date) < new Date() && c.status !== 'CLOSED'
  ).length ?? 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SafetyOutlined style={{ marginRight: 8 }} />Quality Management
        </Title>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Deviation tracking, CAPA management, and quality oversight
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Open Deviations" value={openDevs}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Critical (Active)" value={criticalDevs}
              prefix={<WarningOutlined style={{ color: '#ff7a00' }} />}
              valueStyle={{ color: criticalDevs > 0 ? '#ff4d4f' : undefined }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Open CAPAs" value={openCapas}
              prefix={<FileSearchOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Overdue CAPAs" value={overdueCapas}
              prefix={<CheckCircleOutlined style={{ color: overdueCapas > 0 ? '#ff4d4f' : '#52c41a' }} />}
              valueStyle={{ color: overdueCapas > 0 ? '#ff4d4f' : '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="deviations"
          items={[
            { key: 'deviations', label: 'Deviations', children: <DeviationsTab /> },
            { key: 'capas',      label: 'CAPAs',      children: <CAPAsTab /> },
          ]}
        />
      </Card>
    </div>
  );
}
