import {
  Card, Table, Button, Space, Input, Select, Typography, Badge, Tooltip,
  Popconfirm, message, Tag, Row, Col, Drawer, Tabs, Form, DatePicker,
  InputNumber, Descriptions, Modal, Empty, Statistic,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ToolOutlined,
  WarningOutlined, CheckCircleOutlined, FileTextOutlined, BarChartOutlined,
  EyeOutlined, CalendarOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { equipmentApi } from '../../api/equipment';
import { useAuthStore } from '../../store/authStore';
import type { Equipment, EquipmentStatus } from '../../types/equipment';

const { Title, Text } = Typography;

const STATUS_CFG: Record<EquipmentStatus, { color: string; label: string }> = {
  ACTIVE:            { color: 'success',    label: 'Active' },
  INACTIVE:          { color: 'default',    label: 'Inactive' },
  UNDER_MAINTENANCE: { color: 'processing', label: 'Under Maintenance' },
  CALIBRATION_DUE:   { color: 'warning',    label: 'Calibration Due' },
  RETIRED:           { color: 'error',      label: 'Retired' },
};

const LOG_TYPE_COLOR: Record<string, string> = {
  MAINTENANCE:   '#1677ff',
  CALIBRATION:   '#52c41a',
  REPAIR:        '#ff4d4f',
  INSPECTION:    '#faad14',
  INCIDENT:      '#ff7875',
  CLEANING:      '#13c2c2',
  QUALIFICATION: '#722ed1',
  OTHER:         '#8c8c8c',
};

const OUTCOME_COLOR: Record<string, string> = {
  PASS: 'success', FAIL: 'error', CONDITIONAL: 'warning', PENDING: 'processing',
};

const LOG_TYPES = ['MAINTENANCE','CALIBRATION','REPAIR','INSPECTION','INCIDENT','CLEANING','QUALIFICATION','OTHER'];
const OUTCOMES  = ['PASS','FAIL','CONDITIONAL','PENDING'];

const CLEANING_STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  CLEAN:                 { color: '#52c41a', bg: '#f6ffed', label: 'Clean' },
  DIRTY:                 { color: '#ff4d4f', bg: '#fff2f0', label: 'Dirty' },
  SANITIZED:             { color: '#1677ff', bg: '#e6f4ff', label: 'Sanitized' },
  STERILIZED:            { color: '#722ed1', bg: '#f9f0ff', label: 'Sterilized' },
  IN_USE:                { color: '#faad14', bg: '#fffbe6', label: 'In Use' },
  QUARANTINE:            { color: '#fa541c', bg: '#fff2e8', label: 'Quarantine' },
  CLEANING_IN_PROGRESS:  { color: '#13c2c2', bg: '#e6fffb', label: 'Cleaning In Progress' },
  AWAITING_VERIFICATION: { color: '#eb2f96', bg: '#fff0f6', label: 'Awaiting Verification' },
};

const CLEANING_STATUSES = Object.keys(CLEANING_STATUS_CFG);
const CLEANING_METHODS = ['CIP', 'SIP', 'Manual', 'Rinse', 'Spray', 'Wipe Down', 'Ultrasonic', 'Other'];
const CLEANING_AGENTS  = ['IPA 70%', 'WFI', 'Purified Water', 'NaOH 0.5M', 'Phosphoric Acid', 'Detergent', 'Steam', 'Other'];

function CalibrationBadge({ date }: { date?: string }) {
  if (!date) return <span style={{ color: '#ccc' }}>—</span>;
  const due = new Date(date);
  const today = new Date();
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return <Tag color="error" icon={<WarningOutlined />}>Overdue</Tag>;
  if (daysLeft <= 30) return <Tag color="warning">{daysLeft}d left</Tag>;
  return <Tag color="success" icon={<CheckCircleOutlined />}>{due.toLocaleDateString()}</Tag>;
}

// ── Charts ────────────────────────────────────────────────────────────────────

function LogsChart({ logs }: { logs: any[] }) {
  // Logs per month (last 12)
  const months: Record<string, Record<string, number>> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    months[key] = {};
  }
  logs.forEach(l => {
    const d = new Date(l.performed_date);
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    if (months[key] !== undefined) {
      months[key][l.log_type] = (months[key][l.log_type] || 0) + 1;
    }
  });

  const chartData = Object.entries(months).map(([month, counts]) => ({ month, ...counts }));
  const types = [...new Set(logs.map(l => l.log_type))];

  if (logs.length === 0) return <Empty description="No logs to display" style={{ padding: 40 }} />;

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Log Activity (Last 12 Months)</Text>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <RTooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {types.map(t => (
            <Bar key={t} dataKey={t} stackId="a" fill={LOG_TYPE_COLOR[t] || '#8c8c8c'} radius={t === types[types.length - 1] ? [3,3,0,0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OutcomePieChart({ logs }: { logs: any[] }) {
  const counts: Record<string, number> = {};
  logs.forEach(l => { counts[l.outcome] = (counts[l.outcome] || 0) + 1; });
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const COLORS: Record<string, string> = { PASS: '#52c41a', FAIL: '#ff4d4f', CONDITIONAL: '#faad14', PENDING: '#1677ff' };
  if (data.length === 0) return null;
  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Outcome Distribution</Text>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] || '#8c8c8c'} />)}
          </Pie>
          <RTooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DowntimeChart({ logs }: { logs: any[] }) {
  const withDowntime = logs.filter(l => l.downtime_hours > 0).slice(0, 10).reverse();
  if (withDowntime.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Downtime Hours per Event</Text>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={withDowntime} margin={{ top: 4, right: 16, left: -20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="title" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <RTooltip />
          <Bar dataKey="downtime_hours" fill="#ff7875" name="Downtime (hrs)" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Cleaning Status Tab ───────────────────────────────────────────────────────

function CleaningStatusBadge({ status }: { status: string }) {
  const cfg = CLEANING_STATUS_CFG[status] || { color: '#8c8c8c', bg: '#fafafa', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 12px', borderRadius: 12,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}`,
      fontWeight: 600, fontSize: 13,
    }}>
      {cfg.label}
    </span>
  );
}

function CleaningTimeline({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <Empty description="No cleaning records yet" style={{ padding: 32 }} />;

  // Encode status as number for area chart
  const statusOrder = CLEANING_STATUSES;
  const data = [...logs].reverse().map(l => ({
    time: new Date(l.performed_at).toLocaleDateString(),
    status: l.status_to,
    statusNum: statusOrder.indexOf(l.status_to),
    method: l.cleaning_method || '',
    agent: l.cleaning_agent || '',
    by: l.performed_by || '',
  }));

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const cfg = CLEANING_STATUS_CFG[payload.status] || { color: '#8c8c8c' };
    return <circle cx={cx} cy={cy} r={6} fill={cfg.color} stroke="#fff" strokeWidth={2} />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cfg = CLEANING_STATUS_CFG[d.status] || { color: '#8c8c8c', label: d.status };
    return (
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: cfg.color, marginBottom: 4 }}>{cfg.label}</div>
        <div><b>Date:</b> {d.time}</div>
        {d.method && <div><b>Method:</b> {d.method}</div>}
        {d.agent && <div><b>Agent:</b> {d.agent}</div>}
        {d.by && <div><b>By:</b> {d.by}</div>}
      </div>
    );
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Cleaning Status History</Text>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="cleanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1677ff" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => CLEANING_STATUS_CFG[CLEANING_STATUSES[v]]?.label?.split(' ')[0] || ''}
            domain={[0, CLEANING_STATUSES.length - 1]}
            ticks={CLEANING_STATUSES.map((_, i) => i)}
          />
          <RTooltip content={<CustomTooltip />} />
          <Area type="stepAfter" dataKey="statusNum" stroke="#1677ff" fill="url(#cleanGrad)"
            strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 8 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CleaningDistribution({ logs }: { logs: any[] }) {
  const counts: Record<string, number> = {};
  logs.forEach(l => { counts[l.status_to] = (counts[l.status_to] || 0) + 1; });
  const data = Object.entries(counts).map(([name, value]) => ({
    name: CLEANING_STATUS_CFG[name]?.label || name, value,
    fill: CLEANING_STATUS_CFG[name]?.color || '#8c8c8c',
  }));
  if (data.length === 0) return null;
  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Status Distribution</Text>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <RTooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CleaningTab({ equipment, canManage }: { equipment: any; canManage: boolean }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['equipment-cleaning', equipment.id],
    queryFn: () => equipmentApi.getCleaningLogs(equipment.id),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => equipmentApi.addCleaningLog(equipment.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-cleaning', equipment.id] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      message.success('Cleaning record added');
      setModal(false);
      form.resetFields();
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (logId: string) => equipmentApi.deleteCleaningLog(equipment.id, logId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-cleaning', equipment.id] }),
  });

  const logs = data?.items || [];
  const cfg = CLEANING_STATUS_CFG[equipment.cleaning_status] || { color: '#8c8c8c', bg: '#fafafa', label: equipment.cleaning_status };

  const logCols = [
    { title: 'Date/Time', dataIndex: 'performed_at', key: 'ts', width: 140,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleString()}</Text> },
    { title: 'From → To', key: 'transition', width: 220, render: (_: any, r: any) => (
      <Space>
        {r.status_from ? <CleaningStatusBadge status={r.status_from} /> : <Text type="secondary">—</Text>}
        <span style={{ color: '#999' }}>→</span>
        <CleaningStatusBadge status={r.status_to} />
      </Space>
    )},
    { title: 'Method', dataIndex: 'cleaning_method', key: 'method', render: (v: string) => v || '—' },
    { title: 'Agent', dataIndex: 'cleaning_agent', key: 'agent', render: (v: string) => v || '—' },
    { title: 'Performed By', dataIndex: 'performed_by', key: 'by', render: (v: string) => v || '—' },
    { title: 'Verified By', dataIndex: 'verified_by', key: 'ver', render: (v: string) => v || '—' },
    ...(canManage ? [{
      title: '', key: 'del', width: 50,
      render: (_: any, r: any) => (
        <Popconfirm title="Delete record?" onConfirm={() => deleteMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ];

  return (
    <div>
      {/* Current status card */}
      <Card style={{ marginBottom: 20, background: cfg.bg, border: `1px solid ${cfg.color}` }} size="small">
        <Row align="middle" justify="space-between">
          <Col>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Current Cleaning Status</Text>
            <div style={{ marginTop: 4 }}>
              <CleaningStatusBadge status={equipment.cleaning_status} />
            </div>
            {equipment.cleaning_status_updated_at && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Updated: {new Date(equipment.cleaning_status_updated_at).toLocaleString()}
              </Text>
            )}
          </Col>
          {canManage && (
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>
                Update Status
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Charts */}
      <Row gutter={24} style={{ marginBottom: 20 }}>
        <Col span={16}><CleaningTimeline logs={logs} /></Col>
        <Col span={8}><CleaningDistribution logs={logs} /></Col>
      </Row>

      {/* Log table */}
      <Table
        dataSource={logs}
        columns={logCols}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, size: 'small' }}
        locale={{ emptyText: <Empty description="No cleaning records — update status to start tracking" /> }}
      />

      {/* Modal */}
      <Modal
        open={modal}
        title="Update Cleaning Status"
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.validateFields().then(v => addMut.mutate(v))}
        confirmLoading={addMut.isPending}
        width={540}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="status_to" label="New Status" rules={[{ required: true }]}>
            <Select
              options={CLEANING_STATUSES.map(s => ({
                value: s,
                label: (
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: CLEANING_STATUS_CFG[s].color, display: 'inline-block' }} />
                    {CLEANING_STATUS_CFG[s].label}
                  </Space>
                ),
              }))}
              placeholder="Select new status"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cleaning_method" label="Cleaning Method">
                <Select options={CLEANING_METHODS.map(m => ({ value: m, label: m }))} placeholder="Select method" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cleaning_agent" label="Cleaning Agent">
                <Select options={CLEANING_AGENTS.map(a => ({ value: a, label: a }))} placeholder="Select agent" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="performed_by" label="Performed By">
                <Input placeholder="Operator name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="verified_by" label="Verified By">
                <Input placeholder="Supervisor name" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="batch_number" label="Previous Batch No. (if Dirty after use)">
            <Input placeholder="BT-2024-001" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Any observations or deviations..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Equipment Detail Drawer ───────────────────────────────────────────────────

function EquipmentDetailDrawer({
  equipment, open, onClose, canManage,
}: {
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [logModal, setLogModal] = useState(false);
  const [editLog, setEditLog] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const { data: logData, isLoading: logsLoading } = useQuery({
    queryKey: ['equipment-logs', equipment?.id, typeFilter],
    queryFn: () => equipmentApi.getLogs(equipment!.id, { log_type: typeFilter, size: 100 }),
    enabled: !!equipment && open,
  });

  const createLogMut = useMutation({
    mutationFn: (data: any) =>
      editLog
        ? equipmentApi.updateLog(equipment!.id, editLog.id, data)
        : equipmentApi.createLog(equipment!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-logs', equipment?.id] });
      message.success(editLog ? 'Log updated' : 'Log added');
      setLogModal(false);
      setEditLog(null);
      form.resetFields();
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteLogMut = useMutation({
    mutationFn: (logId: string) => equipmentApi.deleteLog(equipment!.id, logId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment-logs', equipment?.id] }); },
  });

  const openAddLog = () => { setEditLog(null); form.resetFields(); setLogModal(true); };
  const openEditLog = (log: any) => {
    setEditLog(log);
    form.setFieldsValue({
      ...log,
      performed_date: dayjs(log.performed_date),
      next_due_date: log.next_due_date ? dayjs(log.next_due_date) : undefined,
    });
    setLogModal(true);
  };

  const logs = logData?.items || [];

  const logCols = [
    { title: 'Date', dataIndex: 'performed_date', key: 'date', width: 100,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString()}</Text> },
    { title: 'Type', dataIndex: 'log_type', key: 'type', width: 110,
      render: (v: string) => <Tag color={LOG_TYPE_COLOR[v]} style={{ fontSize: 11 }}>{v}</Tag> },
    { title: 'Title', dataIndex: 'title', key: 'title',
      render: (v: string, r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {r.performed_by && <Text type="secondary" style={{ fontSize: 11 }}>By: {r.performed_by}</Text>}
        </Space>
      )},
    { title: 'Outcome', dataIndex: 'outcome', key: 'outcome', width: 110,
      render: (v: string) => <Badge status={OUTCOME_COLOR[v] as any} text={v} /> },
    { title: 'Next Due', dataIndex: 'next_due_date', key: 'next', width: 100,
      render: (v: string) => v ? <CalibrationBadge date={v} /> : '—' },
    { title: 'Downtime', dataIndex: 'downtime_hours', key: 'dt', width: 85,
      render: (v: number) => v ? <Tag color="red">{v}h</Tag> : '—' },
    ...(canManage ? [{
      title: '', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditLog(r)} />
          <Popconfirm title="Delete log?" onConfirm={() => deleteLogMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  if (!equipment) return null;

  const tabItems = [
    {
      key: 'info',
      label: <Space><EyeOutlined />Details</Space>,
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Equipment ID">{equipment.equipment_id}</Descriptions.Item>
          <Descriptions.Item label="Category">{equipment.category}</Descriptions.Item>
          <Descriptions.Item label="Manufacturer">{equipment.manufacturer || '—'}</Descriptions.Item>
          <Descriptions.Item label="Model">{equipment.model_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Serial Number">{equipment.serial_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Location">{equipment.location || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status"><Badge status={STATUS_CFG[equipment.status].color as any} text={STATUS_CFG[equipment.status].label} /></Descriptions.Item>
          <Descriptions.Item label="Calibration Certificate">{equipment.calibration_certificate || '—'}</Descriptions.Item>
          <Descriptions.Item label="Last Calibration">{equipment.last_calibration_date ? new Date(equipment.last_calibration_date).toLocaleDateString() : '—'}</Descriptions.Item>
          <Descriptions.Item label="Calibration Due"><CalibrationBadge date={equipment.calibration_due_date} /></Descriptions.Item>
          <Descriptions.Item label="Last Maintenance">{equipment.last_maintenance_date ? new Date(equipment.last_maintenance_date).toLocaleDateString() : '—'}</Descriptions.Item>
          <Descriptions.Item label="Next Maintenance"><CalibrationBadge date={equipment.next_maintenance_date} /></Descriptions.Item>
          <Descriptions.Item label="Maintenance Interval">{equipment.maintenance_interval_days ? `${equipment.maintenance_interval_days} days` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Created">{new Date(equipment.created_at).toLocaleString()}</Descriptions.Item>
          {equipment.notes && <Descriptions.Item label="Notes" span={2}>{equipment.notes}</Descriptions.Item>}
        </Descriptions>
      ),
    },
    {
      key: 'logs',
      label: <Space><FileTextOutlined />Logs ({logs.length})</Space>,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Select
              placeholder="Filter by type"
              allowClear
              style={{ width: 160 }}
              options={LOG_TYPES.map(t => ({ value: t, label: t }))}
              onChange={setTypeFilter}
            />
            {canManage && (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddLog}>
                Add Log
              </Button>
            )}
          </div>
          <Table
            dataSource={logs}
            columns={logCols}
            rowKey="id"
            loading={logsLoading}
            size="small"
            pagination={{ pageSize: 10, size: 'small' }}
            locale={{ emptyText: <Empty description="No logs yet — add the first entry" /> }}
          />
        </div>
      ),
    },
    {
      key: 'charts',
      label: <Space><BarChartOutlined />Charts</Space>,
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="Total Logs" value={logs.length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Pass Rate" value={logs.length ? Math.round((logs.filter((l: any) => l.outcome === 'PASS').length / logs.length) * 100) : 0} suffix="%" valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Total Downtime" value={logs.reduce((s: number, l: any) => s + (l.downtime_hours || 0), 0)} suffix="hrs" valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Incidents" value={logs.filter((l: any) => l.log_type === 'INCIDENT').length} valueStyle={{ color: '#ff7875' }} /></Card></Col>
          </Row>
          <Row gutter={24}>
            <Col span={16}><LogsChart logs={logs} /></Col>
            <Col span={8}><OutcomePieChart logs={logs} /></Col>
          </Row>
          <DowntimeChart logs={logs} />
        </div>
      ),
    },
    {
      key: 'cleaning',
      label: <Space><ExperimentOutlined />Cleaning</Space>,
      children: <CleaningTab equipment={equipment} canManage={canManage} />,
    },
  ];

  return (
    <>
      <Drawer
        title={
          <Space>
            <ToolOutlined />
            <span>{equipment.name}</span>
            <Tag style={{ fontSize: 11 }}>{equipment.equipment_id}</Tag>
            <Badge status={STATUS_CFG[equipment.status].color as any} text={STATUS_CFG[equipment.status].label} />
          </Space>
        }
        width={860}
        open={open}
        onClose={onClose}
      >
        <Tabs items={tabItems} />
      </Drawer>

      <Modal
        open={logModal}
        title={editLog ? 'Edit Log Entry' : 'Add Log Entry'}
        onCancel={() => { setLogModal(false); setEditLog(null); form.resetFields(); }}
        onOk={() => form.validateFields().then(v => createLogMut.mutate({
          ...v,
          performed_date: v.performed_date?.format('YYYY-MM-DD'),
          next_due_date: v.next_due_date?.format('YYYY-MM-DD') || null,
        }))}
        confirmLoading={createLogMut.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="log_type" label="Log Type" rules={[{ required: true }]}>
                <Select options={LOG_TYPES.map(t => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="outcome" label="Outcome" initialValue="PASS">
                <Select options={OUTCOMES.map(o => ({ value: o, label: o }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Annual Calibration" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Details of work performed..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="performed_by" label="Performed By">
                <Input placeholder="Technician / vendor name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="certificate_number" label="Certificate / Reference No.">
                <Input placeholder="CAL-2024-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="performed_date" label="Performed Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_due_date" label="Next Due Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="downtime_hours" label="Downtime (hours)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost" label="Cost">
                <Input placeholder="e.g. $500" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Main List ─────────────────────────────────────────────────────────────────

export default function EquipmentList() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [detailEquip, setDetailEquip] = useState<Equipment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['equipment', page, search, statusFilter],
    queryFn: () => equipmentApi.list({ page, size: 20, search: search || undefined, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: equipmentApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipment'] }); message.success('Equipment deleted'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Cannot delete'),
  });

  const columns = [
    { title: 'Equipment', key: 'equipment', render: (_: any, r: Equipment) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ fontSize: 14, cursor: 'pointer', color: '#1677ff' }}
          onClick={() => setDetailEquip(r)}>{r.name}</Text>
        <Tag style={{ fontSize: 10 }}>{r.equipment_id}</Tag>
      </Space>
    )},
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Manufacturer / Model', key: 'mfr', render: (_: any, r: Equipment) => (
      <Space direction="vertical" size={0}>
        <span>{r.manufacturer || '—'}</span>
        {r.model_number && <span style={{ fontSize: 12, color: '#888' }}>{r.model_number}</span>}
      </Space>
    )},
    { title: 'Location', dataIndex: 'location', key: 'location', render: (v: string) => v || '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: EquipmentStatus) => (
      <Badge status={STATUS_CFG[v].color as any} text={STATUS_CFG[v].label} />
    )},
    { title: 'Calibration Due', key: 'calibration', render: (_: any, r: Equipment) => (
      <CalibrationBadge date={r.calibration_due_date} />
    )},
    { title: 'Next Maintenance', key: 'maintenance', render: (_: any, r: Equipment) => (
      r.next_maintenance_date ? new Date(r.next_maintenance_date).toLocaleDateString() : <span style={{ color: '#ccc' }}>—</span>
    )},
    { title: 'Actions', key: 'actions', render: (_: any, r: Equipment) => (
      <Space>
        <Tooltip title="View details & logs">
          <Button icon={<EyeOutlined />} size="small" onClick={() => setDetailEquip(r)} />
        </Tooltip>
        {hasPermission('equipment:manage') && (
          <>
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" onClick={() => navigate(`/equipment/${r.id}/edit`)} />
            </Tooltip>
            <Popconfirm title="Delete this equipment?" onConfirm={() => deleteMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}><ToolOutlined style={{ marginRight: 8 }} />Equipment Registry</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Calibration, maintenance tracking and activity logs</Text>
        </div>
        {hasPermission('equipment:manage') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/equipment/new')}>
            Add Equipment
          </Button>
        )}
      </div>

      <Card>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col>
            <Input
              placeholder="Search name, ID, manufacturer..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 300 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Filter by status"
              style={{ width: 180 }}
              allowClear
              onChange={v => { setStatusFilter(v); setPage(1); }}
              options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </Col>
        </Row>
        <Table
          dataSource={data?.items}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page, pageSize: 20, total: data?.total, onChange: setPage,
            showTotal: t => `${t} equipment`,
          }}
        />
      </Card>

      <EquipmentDetailDrawer
        equipment={detailEquip}
        open={!!detailEquip}
        onClose={() => setDetailEquip(null)}
        canManage={hasPermission('equipment:manage')}
      />
    </div>
  );
}
