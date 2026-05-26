import {
  Card, Table, Button, Space, Typography, Tag, Badge, Input,
  Select, Tabs, Tooltip, Popconfirm, message, Alert, Row, Col,
  Progress, Statistic,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, TYPE_LABELS, type TrainingRecord, type TrainingStatus, type TrainingType } from '../../api/training';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<TrainingStatus, { color: string; icon: React.ReactNode; label: string }> = {
  CURRENT:  { color: 'success', icon: <CheckCircleOutlined />,      label: 'Current' },
  DUE_SOON: { color: 'warning', icon: <ClockCircleOutlined />,      label: 'Due Soon' },
  EXPIRED:  { color: 'error',   icon: <ExclamationCircleOutlined />, label: 'Expired' },
  PENDING:  { color: 'default', icon: <WarningOutlined />,          label: 'Pending' },
};

const MATRIX_COLORS: Record<TrainingStatus, { bg: string; text: string; border: string }> = {
  CURRENT:  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  DUE_SOON: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  EXPIRED:  { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  PENDING:  { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' },
};

// ── Matrix View ───────────────────────────────────────────────────────────────
function MatrixView() {
  const { data, isLoading } = useQuery({
    queryKey: ['training-matrix'],
    queryFn: trainingApi.matrix,
  });

  if (isLoading) return <Card loading />;
  if (!data || data.operators.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
        <Text type="secondary">No training records yet. Add records to see the qualification matrix.</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Per-operator summary strip */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {data.operators.map(op => {
          const s = data.summary[op.id];
          const pct = s.total > 0 ? Math.round((s.current / s.total) * 100) : 0;
          return (
            <Col key={op.id} xs={12} sm={8} md={6} lg={4}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Text strong style={{ fontSize: 12 }}>{op.full_name}</Text>
                <Progress
                  percent={pct}
                  size="small"
                  strokeColor={pct === 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'}
                  style={{ marginTop: 4, marginBottom: 4 }}
                />
                <Space size={4} wrap style={{ justifyContent: 'center' }}>
                  {s.expired > 0  && <Tag color="error"   style={{ fontSize: 10, margin: 0 }}>{s.expired} expired</Tag>}
                  {s.due_soon > 0 && <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>{s.due_soon} due</Tag>}
                  <Tag color="success" style={{ fontSize: 10, margin: 0 }}>{s.current} current</Tag>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Matrix grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 12px', textAlign: 'left', fontSize: 12,
                background: '#1e293b', color: '#fff', position: 'sticky', left: 0, zIndex: 2,
                minWidth: 140,
              }}>
                Training Type
              </th>
              {data.operators.map(op => (
                <th key={op.id} style={{
                  padding: '6px 10px', textAlign: 'center', fontSize: 11,
                  background: '#1e293b', color: '#fff', minWidth: 120,
                }}>
                  {op.full_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={row.training_type}
                style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{
                  padding: '8px 12px', fontWeight: 600, fontSize: 12,
                  borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 0,
                  background: ri % 2 === 0 ? '#fff' : '#f8fafc', zIndex: 1,
                }}>
                  {row.label}
                </td>
                {data.operators.map(op => {
                  const cell = row.operators[op.id];
                  const hasRecord = cell?.status != null;
                  const cfg = hasRecord ? MATRIX_COLORS[cell.status!] : null;

                  return (
                    <td key={op.id} style={{
                      padding: '6px 8px', textAlign: 'center',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      {hasRecord && cfg ? (
                        <Tooltip title={
                          <div>
                            <div><b>{cell.title}</b></div>
                            <div>Trained: {cell.training_date}</div>
                            {cell.expiry_date && <div>Expires: {cell.expiry_date}</div>}
                          </div>
                        }>
                          <div style={{
                            display: 'inline-block',
                            background: cfg.bg, color: cfg.text,
                            border: `1px solid ${cfg.border}`,
                            borderRadius: 4, padding: '2px 8px',
                            fontSize: 11, fontWeight: 600, cursor: 'default',
                          }}>
                            {STATUS_CFG[cell.status!].label}
                          </div>
                        </Tooltip>
                      ) : (
                        <div style={{
                          display: 'inline-block',
                          background: '#f1f5f9', color: '#cbd5e1',
                          borderRadius: 4, padding: '2px 8px', fontSize: 11,
                        }}>
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <Space style={{ marginTop: 12 }} wrap>
        {(Object.entries(MATRIX_COLORS) as [TrainingStatus, typeof MATRIX_COLORS[TrainingStatus]][]).map(([st, cfg]) => (
          <Space key={st} size={4}>
            <div style={{ width: 12, height: 12, borderRadius: 2,
              background: cfg.bg, border: `1px solid ${cfg.border}` }} />
            <Text style={{ fontSize: 11, color: '#64748b' }}>{STATUS_CFG[st].label}</Text>
          </Space>
        ))}
      </Space>
    </div>
  );
}

// ── Due Soon Alert Panel ──────────────────────────────────────────────────────
function DueSoonPanel() {
  const { data } = useQuery({
    queryKey: ['training-due-soon'],
    queryFn: () => trainingApi.dueSoon(30),
  });

  if (!data || (data.due_soon_count === 0 && data.expired_count === 0)) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {data.expired_count > 0 && (
        <Alert type="error" showIcon style={{ marginBottom: 8 }}
          message={`${data.expired_count} training record(s) have expired`}
          description="Operators with expired training must be re-trained before performing related activities." />
      )}
      {data.due_soon_count > 0 && (
        <Alert type="warning" showIcon
          message={`${data.due_soon_count} training record(s) expiring within 30 days`}
          description={
            <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
              {data.due_soon.slice(0, 5).map(r => (
                <li key={r.record_number} style={{ fontSize: 12 }}>
                  <b>{r.trainee}</b> — {r.title} expires in <b>{r.days_remaining}d</b> ({r.expiry_date})
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}

// ── Records List ──────────────────────────────────────────────────────────────
function RecordsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['training', page, search, typeFilter, statusFilter],
    queryFn: () => trainingApi.list({
      page, size: 20,
      search: search || undefined,
      training_type: typeFilter,
      status: statusFilter,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: trainingApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training'] });
      message.success('Record deleted');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Delete failed'),
  });

  const columns = [
    {
      title: 'Record #',
      dataIndex: 'record_number',
      key: 'num',
      render: (v: string) => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'Trainee',
      key: 'trainee',
      render: (_: any, r: TrainingRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.trainee.full_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.trainee.username}</Text>
        </Space>
      ),
    },
    {
      title: 'Training',
      key: 'training',
      render: (_: any, r: TrainingRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
          <Space size={4}>
            <Tag style={{ fontSize: 10, margin: 0 }}>{TYPE_LABELS[r.training_type]}</Tag>
            {r.reference_doc && (
              <Text type="secondary" style={{ fontSize: 11 }}>{r.reference_doc}</Text>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'training_date',
      key: 'date',
      render: (v: string) => v,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      key: 'expiry',
      render: (v: string | null) => v ?? <Text type="secondary">Never</Text>,
    },
    {
      title: 'Assessment',
      key: 'passed',
      render: (_: any, r: TrainingRecord) =>
        r.passed === null ? <Text type="secondary">—</Text> :
        r.passed
          ? <Tag color="success">Pass{r.score != null ? ` (${r.score}%)` : ''}</Tag>
          : <Tag color="error">Fail</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: TrainingStatus) => {
        const cfg = STATUS_CFG[v];
        return <Badge status={cfg.color as any} text={cfg.label} />;
      },
    },
    {
      title: 'Trainer',
      key: 'trainer',
      render: (_: any, r: TrainingRecord) =>
        r.trainer?.full_name ?? r.trainer_name ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: TrainingRecord) => (
        <Space>
          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} size="small"
              onClick={() => navigate(`/training/${r.id}/edit`)} />
          </Tooltip>
          <Popconfirm title="Delete this training record?"
            onConfirm={() => deleteMutation.mutate(r.id)}
            okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Input placeholder="Search title, reference, record #…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 280 }} allowClear />
        </Col>
        <Col>
          <Select placeholder="Filter by type" style={{ width: 160 }} allowClear
            onChange={v => { setTypeFilter(v); setPage(1); }}
            options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Col>
        <Col>
          <Select placeholder="Filter by status" style={{ width: 150 }} allowClear
            onChange={v => { setStatusFilter(v); setPage(1); }}
            options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))} />
        </Col>
      </Row>
      <Table
        dataSource={data?.items}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        rowClassName={(r: TrainingRecord) =>
          r.status === 'EXPIRED' ? 'ant-table-row-danger' : ''}
        pagination={{
          current: page, pageSize: 20, total: data?.total,
          onChange: setPage, showTotal: t => `${t} records`,
        }}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TrainingList() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Training Records</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Operator qualifications & GMP training — 21 CFR Part 211
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/training/new')}>
          Record Training
        </Button>
      </div>

      <DueSoonPanel />

      <Card>
        <Tabs
          defaultActiveKey="records"
          items={[
            {
              key: 'records',
              label: 'Training Records',
              children: <RecordsList />,
            },
            {
              key: 'matrix',
              label: 'Qualification Matrix',
              children: <MatrixView />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
