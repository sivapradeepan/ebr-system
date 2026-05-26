import {
  Card, Button, Space, Typography, Tag, Badge, Tooltip,
  Modal, Form, Input, message, Popconfirm, Select, Row, Col, Tabs,
  Table, Descriptions,
} from 'antd';
import {
  PlusOutlined, LeftOutlined, RightOutlined, CalendarOutlined,
  UnorderedListOutlined, CheckOutlined, CloseOutlined,
  PlayCircleOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { scheduleApi, type CalendarEntry, type Schedule, type ScheduleStatus } from '../../api/schedule';
import { useAuthStore } from '../../store/authStore';

dayjs.extend(isBetween);

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ScheduleStatus, { color: string; bg: string; label: string }> = {
  PLANNED:     { color: '#1677ff', bg: '#dbeafe', label: 'Planned' },
  CONFIRMED:   { color: '#7c3aed', bg: '#ede9fe', label: 'Confirmed' },
  IN_PROGRESS: { color: '#059669', bg: '#d1fae5', label: 'In Progress' },
  COMPLETED:   { color: '#374151', bg: '#f3f4f6', label: 'Completed' },
  CANCELLED:   { color: '#9ca3af', bg: '#f9fafb', label: 'Cancelled' },
};

const PRIORITY_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' };

// ── Calendar helpers ──────────────────────────────────────────────────────────
function buildMonthDays(month: Dayjs): Dayjs[] {
  const start = month.startOf('month').startOf('week');
  const end   = month.endOf('month').endOf('week');
  const days: Dayjs[] = [];
  let cur = start;
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    days.push(cur);
    cur = cur.add(1, 'day');
  }
  return days;
}

function entrySpansDay(entry: CalendarEntry, day: Dayjs): boolean {
  const s = dayjs(entry.scheduled_start);
  const e = dayjs(entry.scheduled_end);
  return day.isBetween(s, e, 'day', '[]');
}

// ── Calendar Entry Chip ───────────────────────────────────────────────────────
function EntryChip({ entry, onClick }: { entry: CalendarEntry; onClick: () => void }) {
  const cfg = STATUS_CFG[entry.status];
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: 4, padding: '2px 6px', marginBottom: 2,
        fontSize: 11, cursor: 'pointer', lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
      title={`${entry.product_name} — ${entry.schedule_number}`}
    >
      <span style={{ fontWeight: 600 }}>{entry.product_name}</span>
      {entry.priority === 'HIGH' && <span style={{ color: '#ef4444', marginLeft: 2 }}>●</span>}
    </div>
  );
}

// ── Convert-to-EBR Modal ──────────────────────────────────────────────────────
function ConvertModal({ schedule, open, onClose }: {
  schedule: Schedule | null; open: boolean; onClose: () => void;
}) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const convertMutation = useMutation({
    mutationFn: (values: any) => scheduleApi.convert(schedule!.id, values),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      message.success(`EBR initiated from ${schedule!.schedule_number}`);
      onClose();
      if (data.ebr_id) navigate(`/ebr/${data.ebr_id}`);
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Conversion failed'),
  });

  return (
    <Modal
      title="Convert to Batch Execution Record"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {schedule && (
        <>
          <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Product">{schedule.product_name}</Descriptions.Item>
            <Descriptions.Item label="MBR">{schedule.mbr_number} v{schedule.mbr_version}</Descriptions.Item>
            <Descriptions.Item label="Schedule">{schedule.schedule_number}</Descriptions.Item>
          </Descriptions>
          <Form form={form} layout="vertical"
            onFinish={values => convertMutation.mutate(values)}>
            <Form.Item name="batch_number" label="Batch Number"
              rules={[{ required: true, message: 'Enter a unique batch number' }]}>
              <Input placeholder="e.g. BT-2026-001" />
            </Form.Item>
            <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
              <Form.Item name="planned_batch_size" label="Batch Size">
                <Input placeholder={schedule.planned_batch_size?.toString() ?? '—'} />
              </Form.Item>
              <Form.Item name="batch_unit" label="Unit">
                <Input placeholder={schedule.batch_unit ?? '—'} />
              </Form.Item>
            </Space>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space>
              <Button type="primary" icon={<PlayCircleOutlined />} htmlType="submit"
                loading={convertMutation.isPending}>
                Initiate Batch
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Form>
        </>
      )}
    </Modal>
  );
}

// ── Detail Drawer/Modal ───────────────────────────────────────────────────────
function DetailModal({ schedule, open, onClose, onConvert, onConfirm, onCancel, onEdit, onDelete }: {
  schedule: Schedule | null;
  open: boolean;
  onClose: () => void;
  onConvert: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('ebr:create');
  if (!schedule) return null;
  const cfg = STATUS_CFG[schedule.status];

  return (
    <Modal title={schedule.schedule_number} open={open} onCancel={onClose} footer={null} width={520}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <Badge color={cfg.color} text={<span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>} />
          <Tag color={PRIORITY_COLOR[schedule.priority]} style={{ marginLeft: 8, fontSize: 11 }}>
            {schedule.priority}
          </Tag>
        </div>

        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Product">{schedule.product_name} ({schedule.product_code})</Descriptions.Item>
          <Descriptions.Item label="MBR">{schedule.mbr_number} v{schedule.mbr_version}</Descriptions.Item>
          <Descriptions.Item label="Start">{dayjs(schedule.scheduled_start).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="End">{dayjs(schedule.scheduled_end).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          {schedule.planned_batch_size && (
            <Descriptions.Item label="Batch Size">{schedule.planned_batch_size} {schedule.batch_unit}</Descriptions.Item>
          )}
          {schedule.equipment_line && (
            <Descriptions.Item label="Equipment">{schedule.equipment_line}</Descriptions.Item>
          )}
          {schedule.assigned_operator && (
            <Descriptions.Item label="Operator">{schedule.assigned_operator.full_name}</Descriptions.Item>
          )}
          {schedule.notes && (
            <Descriptions.Item label="Notes">{schedule.notes}</Descriptions.Item>
          )}
          {schedule.ebr_id && (
            <Descriptions.Item label="EBR">Converted ✓</Descriptions.Item>
          )}
        </Descriptions>

        {canEdit && (
          <Space wrap>
            {schedule.status === 'PLANNED' && (
              <Button icon={<CheckOutlined />} type="primary" size="small" onClick={onConfirm}>
                Confirm
              </Button>
            )}
            {(schedule.status === 'PLANNED' || schedule.status === 'CONFIRMED') && !schedule.ebr_id && (
              <Button icon={<PlayCircleOutlined />} type="primary" ghost size="small" onClick={onConvert}>
                Convert to EBR
              </Button>
            )}
            {(schedule.status === 'PLANNED' || schedule.status === 'CONFIRMED') && (
              <Button icon={<EditOutlined />} size="small" onClick={onEdit}>Edit</Button>
            )}
            {schedule.status !== 'COMPLETED' && schedule.status !== 'CANCELLED' && (
              <Button icon={<CloseOutlined />} danger size="small" onClick={onCancel}>Cancel</Button>
            )}
            {(schedule.status === 'PLANNED' || schedule.status === 'CANCELLED') && (
              <Popconfirm title="Delete this entry?" onConfirm={onDelete} okButtonProps={{ danger: true }}>
                <Button icon={<DeleteOutlined />} danger size="small">Delete</Button>
              </Popconfirm>
            )}
          </Space>
        )}
      </Space>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  // Calendar range: full month window
  const calStart = month.startOf('month').startOf('week').toISOString();
  const calEnd   = month.endOf('month').endOf('week').toISOString();

  const { data: calEntries = [], isLoading: calLoading } = useQuery({
    queryKey: ['schedule-calendar', calStart, calEnd],
    queryFn: () => scheduleApi.calendar(calStart, calEnd),
    enabled: view === 'calendar',
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['schedule-list'],
    queryFn: () => scheduleApi.list({ size: 100 }),
    enabled: view === 'list',
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.confirm(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); message.success('Confirmed'); setDetailOpen(false); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); message.success('Cancelled'); setDetailOpen(false); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule'] }); message.success('Deleted'); setDetailOpen(false); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const days = useMemo(() => buildMonthDays(month), [month]);
  const today = dayjs();

  const openDetail = async (id: string) => {
    const s = await scheduleApi.get(id);
    setSelected(s);
    setDetailOpen(true);
  };

  // ── Calendar View ─────────────────────────────────────────────────────────
  const CalendarView = () => (
    <div>
      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} size="small" onClick={() => setMonth(m => m.subtract(1, 'month'))} />
        <Title level={5} style={{ margin: 0, minWidth: 160, textAlign: 'center' }}>
          {month.format('MMMM YYYY')}
        </Title>
        <Button icon={<RightOutlined />} size="small" onClick={() => setMonth(m => m.add(1, 'month'))} />
        <Button size="small" onClick={() => setMonth(dayjs().startOf('month'))}>Today</Button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ padding: '6px 8px', background: '#f8fafc', textAlign: 'center',
            fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {days.map(day => {
          const isCurrentMonth = day.month() === month.month();
          const isToday = day.isSame(today, 'day');
          const dayEntries = calEntries.filter(e => entrySpansDay(e, day));

          return (
            <div
              key={day.format('YYYY-MM-DD')}
              style={{
                minHeight: 90,
                background: isToday ? '#eff6ff' : isCurrentMonth ? '#fff' : '#fafafa',
                border: isToday ? '1.5px solid #1677ff' : '1px solid #f0f0f0',
                padding: '4px 6px',
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#1677ff' : isCurrentMonth ? '#374151' : '#cbd5e1',
                marginBottom: 4,
              }}>
                {isToday ? (
                  <span style={{ background: '#1677ff', color: '#fff', borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20 }}>
                    {day.date()}
                  </span>
                ) : day.date()}
              </div>
              {dayEntries.slice(0, 3).map(e => (
                <EntryChip key={e.id} entry={e} onClick={() => openDetail(e.id)} />
              ))}
              {dayEntries.length > 3 && (
                <div style={{ fontSize: 10, color: '#94a3b8', paddingLeft: 4 }}>
                  +{dayEntries.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <Space key={k} size={4}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: v.bg,
              border: `1px solid ${v.color}` }} />
            <Text style={{ fontSize: 11, color: '#64748b' }}>{v.label}</Text>
          </Space>
        ))}
        <Space size={4}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>●</span>
          <Text style={{ fontSize: 11, color: '#64748b' }}>High priority</Text>
        </Space>
      </div>
    </div>
  );

  // ── List View ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Schedule #',
      dataIndex: 'schedule_number',
      key: 'num',
      render: (v: string, r: Schedule) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r.id)}>{v}</Button>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: Schedule) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.product_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.product_code}</Text>
        </Space>
      ),
    },
    { title: 'MBR', key: 'mbr', render: (_: any, r: Schedule) => `${r.mbr_number} v${r.mbr_version}` },
    {
      title: 'Scheduled Start',
      dataIndex: 'scheduled_start',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'End',
      dataIndex: 'scheduled_end',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (v: string) => <Tag color={PRIORITY_COLOR[v as keyof typeof PRIORITY_COLOR]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: ScheduleStatus) => {
        const cfg = STATUS_CFG[v];
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    { title: 'Operator', key: 'op', render: (_: any, r: Schedule) => r.assigned_operator?.full_name ?? '—' },
    {
      title: 'EBR',
      key: 'ebr',
      render: (_: any, r: Schedule) => r.ebr_id
        ? <Tag color="success">Converted</Tag>
        : <Tag>Pending</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Production Schedule</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Plan, confirm and convert batch schedules to live EBRs</Text>
        </div>
        <Space>
          <Button.Group>
            <Button icon={<CalendarOutlined />} type={view === 'calendar' ? 'primary' : 'default'}
              onClick={() => setView('calendar')}>Calendar</Button>
            <Button icon={<UnorderedListOutlined />} type={view === 'list' ? 'primary' : 'default'}
              onClick={() => setView('list')}>List</Button>
          </Button.Group>
          {hasPermission('ebr:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/schedule/new')}>
              Plan Batch
            </Button>
          )}
        </Space>
      </div>

      <Card loading={view === 'calendar' ? calLoading : listLoading}>
        {view === 'calendar' ? (
          <CalendarView />
        ) : (
          <Table
            dataSource={listData?.items}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20, showTotal: t => `${t} entries` }}
          />
        )}
      </Card>

      <DetailModal
        schedule={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onConvert={() => { setDetailOpen(false); setConvertOpen(true); }}
        onConfirm={() => selected && confirmMutation.mutate(selected.id)}
        onCancel={() => selected && cancelMutation.mutate(selected.id)}
        onEdit={() => { setDetailOpen(false); navigate(`/schedule/${selected!.id}/edit`); }}
        onDelete={() => selected && deleteMutation.mutate(selected.id)}
      />

      <ConvertModal
        schedule={selected}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
      />
    </div>
  );
}
