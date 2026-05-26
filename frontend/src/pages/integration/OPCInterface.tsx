import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Input, InputNumber,
  Switch, Select, Badge, Tooltip, Popconfirm, message, Row, Col,
  Drawer, Descriptions, Empty, Statistic, Tabs, Progress,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ApiOutlined, DisconnectOutlined,
  ReloadOutlined, EyeOutlined, ExperimentOutlined, ThunderboltOutlined,
  LinkOutlined, HistoryOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { opcApi, type OPCServer, type OPCTag, type OPCEBRMapping, type OPCEquipmentMapping } from '../../api/integration';
import { equipmentApi } from '../../api/equipment';

const { Title, Text } = Typography;

const CONN_STATUS_COLOR: Record<string, string> = {
  CONNECTED: 'success', DISCONNECTED: 'default', ERROR: 'error', CONNECTING: 'processing',
};
const QUALITY_COLOR: Record<string, string> = {
  Good: '#52c41a', Bad: '#ff4d4f', Uncertain: '#faad14',
};

const SECURITY_MODES = [
  { value: 'NONE', label: 'None' },
  { value: 'SIGN', label: 'Sign' },
  { value: 'SIGN_AND_ENCRYPT', label: 'Sign & Encrypt' },
];
const DATA_TYPES = ['Boolean', 'Int16', 'Int32', 'Int64', 'Float', 'Double', 'String', 'DateTime'];

function TagValueBar({ tag }: { tag: OPCTag }) {
  if (!tag.current_value || tag.data_type === 'String' || tag.data_type === 'Boolean' || tag.data_type === 'DateTime') {
    return <Text code style={{ fontSize: 12 }}>{tag.current_value ?? '—'}</Text>;
  }
  const val = parseFloat(tag.current_value);
  if (isNaN(val) || tag.low_limit == null || tag.high_limit == null) {
    return <Text code style={{ fontSize: 12 }}>{tag.current_value}</Text>;
  }
  const pct = Math.max(0, Math.min(100, ((val - tag.low_limit) / (tag.high_limit - tag.low_limit)) * 100));
  const inRange = val >= tag.low_limit && val <= tag.high_limit;
  return (
    <Space direction="vertical" size={2} style={{ width: 160 }}>
      <Text code style={{ fontSize: 12 }}>{val.toFixed(3)} {tag.unit}</Text>
      <Progress percent={Math.round(pct)} size="small" status={inRange ? 'active' : 'exception'} showInfo={false} />
    </Space>
  );
}

export default function OPCInterface() {
  const qc = useQueryClient();
  const [serverModal, setServerModal] = useState(false);
  const [editServer, setEditServer] = useState<OPCServer | null>(null);
  const [selectedServer, setSelectedServer] = useState<OPCServer | null>(null);
  const [tagDrawer, setTagDrawer] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [historyTag, setHistoryTag] = useState<OPCTag | null>(null);
  const [mappingTag, setMappingTag] = useState<OPCTag | null>(null);
  const [mappingModal, setMappingModal] = useState(false);
  const [eqMappingTag, setEqMappingTag] = useState<OPCTag | null>(null);
  const [eqMappingModal, setEqMappingModal] = useState(false);
  const [liveRefresh, setLiveRefresh] = useState(false);
  const liveTimer = useRef<any>(null);
  const [serverForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [mappingForm] = Form.useForm();
  const [eqMappingForm] = Form.useForm();

  const { data: serverData, isLoading: serverLoading } = useQuery({
    queryKey: ['opc-servers'],
    queryFn: () => opcApi.listServers(),
    refetchInterval: 10000,
  });

  const { data: tagData, isLoading: tagLoading } = useQuery({
    queryKey: ['opc-tags', selectedServer?.id],
    queryFn: () => opcApi.listTags({ server_id: selectedServer?.id, size: 200 }),
    enabled: !!selectedServer && tagDrawer,
    refetchInterval: liveRefresh ? 3000 : false,
  });

  const { data: historyData } = useQuery({
    queryKey: ['opc-tag-history', historyTag?.id],
    queryFn: () => opcApi.tagHistory(historyTag!.id, 30),
    enabled: !!historyTag,
  });

  const { data: mappingData } = useQuery({
    queryKey: ['opc-mappings', mappingTag?.id],
    queryFn: () => opcApi.listMappings({ tag_id: mappingTag?.id }),
    enabled: !!mappingTag && mappingModal,
  });

  const { data: eqMappingData } = useQuery({
    queryKey: ['opc-eq-mappings', eqMappingTag?.id],
    queryFn: () => opcApi.listEquipmentMappings({ tag_id: eqMappingTag?.id }),
    enabled: !!eqMappingTag && eqMappingModal,
  });

  const { data: equipmentData } = useQuery({
    queryKey: ['equipment-list-opc'],
    queryFn: () => equipmentApi.list({ size: 100 }),
  });

  // Live refresh ticker
  useEffect(() => {
    if (liveRefresh && selectedServer) {
      liveTimer.current = setInterval(() => {
        opcApi.refreshAll(selectedServer.id).then(() => {
          qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer.id] });
        });
      }, selectedServer.polling_interval_ms || 2000);
    } else {
      clearInterval(liveTimer.current);
    }
    return () => clearInterval(liveTimer.current);
  }, [liveRefresh, selectedServer]);

  const createServerMut = useMutation({
    mutationFn: (data: any) => editServer ? opcApi.updateServer(editServer.id, data) : opcApi.createServer(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-servers'] }); setServerModal(false); message.success(editServer ? 'Server updated' : 'Server created'); serverForm.resetFields(); setEditServer(null); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteServerMut = useMutation({
    mutationFn: opcApi.deleteServer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-servers'] }); message.success('Deleted'); },
  });

  const connectMut = useMutation({
    mutationFn: opcApi.connectServer,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['opc-servers'] }); message.success(r.message); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const disconnectMut = useMutation({
    mutationFn: opcApi.disconnectServer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-servers'] }); message.info('Disconnected'); },
  });

  const simTagsMut = useMutation({
    mutationFn: opcApi.simulateTags,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer?.id] }); message.success(r.message); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const refreshAllMut = useMutation({
    mutationFn: opcApi.refreshAll,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer?.id] }); message.success(`Refreshed ${r.updated} tags`); },
  });

  const createTagMut = useMutation({
    mutationFn: (data: any) => opcApi.createTag({ ...data, server_id: selectedServer!.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer?.id] }); setTagModal(false); tagForm.resetFields(); message.success('Tag added'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteTagMut = useMutation({
    mutationFn: opcApi.deleteTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer?.id] }),
  });

  const refreshTagMut = useMutation({
    mutationFn: opcApi.refreshTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opc-tags', selectedServer?.id] }),
  });

  const createMappingMut = useMutation({
    mutationFn: (data: any) => opcApi.createMapping({ ...data, tag_id: mappingTag!.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-mappings', mappingTag?.id] }); mappingForm.resetFields(); message.success('Mapping created'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMappingMut = useMutation({
    mutationFn: opcApi.deleteMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opc-mappings', mappingTag?.id] }),
  });

  const createEqMappingMut = useMutation({
    mutationFn: (data: any) => opcApi.createEquipmentMapping({ ...data, tag_id: eqMappingTag!.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opc-eq-mappings', eqMappingTag?.id] }); eqMappingForm.resetFields(); message.success('Equipment mapping created'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteEqMappingMut = useMutation({
    mutationFn: opcApi.deleteEquipmentMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opc-eq-mappings', eqMappingTag?.id] }),
  });

  const openEditServer = (s: OPCServer) => {
    setEditServer(s);
    serverForm.setFieldsValue({ ...s });
    setServerModal(true);
  };

  const servers: OPCServer[] = serverData?.items || [];
  const tags: OPCTag[] = tagData?.items || [];
  const history = historyData || [];
  const mappings: OPCEBRMapping[] = mappingData || [];
  const eqMappings: OPCEquipmentMapping[] = eqMappingData || [];
  const equipmentList = equipmentData?.items || [];

  const serverCols = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string, r: OPCServer) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>
      </Space>
    )},
    { title: 'Endpoint', dataIndex: 'endpoint_url', key: 'ep', render: (v: string) => (
      <Text code style={{ fontSize: 11 }}>{v}</Text>
    )},
    { title: 'Security', dataIndex: 'security_mode', key: 'sec', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Mode', key: 'sim', render: (_: any, r: OPCServer) => (
      <Space>
        {r.simulation_mode && <Tag color="purple"><ExperimentOutlined /> Sim</Tag>}
        <Text type="secondary" style={{ fontSize: 12 }}>{r.polling_interval_ms}ms</Text>
      </Space>
    )},
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => (
      <Badge status={CONN_STATUS_COLOR[v] as any} text={v} />
    )},
    { title: 'Tags', dataIndex: 'tag_count', key: 'tags', render: (v: number, r: OPCServer) => (
      <Button type="link" size="small" onClick={() => { setSelectedServer(r); setTagDrawer(true); }}>{v} tags</Button>
    )},
    { title: 'Actions', key: 'act', render: (_: any, r: OPCServer) => (
      <Space>
        {r.status !== 'CONNECTED' ? (
          <Tooltip title="Connect"><Button size="small" icon={<LinkOutlined />} loading={connectMut.isPending} onClick={() => connectMut.mutate(r.id)} /></Tooltip>
        ) : (
          <Tooltip title="Disconnect"><Button size="small" icon={<DisconnectOutlined />} onClick={() => disconnectMut.mutate(r.id)} /></Tooltip>
        )}
        <Tooltip title="Edit"><Button size="small" icon={<EyeOutlined />} onClick={() => openEditServer(r)} /></Tooltip>
        <Popconfirm title="Delete server?" onConfirm={() => deleteServerMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  const tagCols = [
    { title: 'Tag Name', key: 'name', render: (_: any, r: OPCTag) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ fontSize: 13 }}>{r.display_name}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{r.node_id}</Text>
      </Space>
    )},
    { title: 'Type', dataIndex: 'data_type', key: 'type', width: 90, render: (v: string) => <Tag style={{ fontSize: 11 }}>{v}</Tag> },
    { title: 'Live Value', key: 'value', width: 200, render: (_: any, r: OPCTag) => <TagValueBar tag={r} /> },
    { title: 'Quality', dataIndex: 'quality', key: 'quality', width: 90, render: (v: string) =>
      v ? <Text style={{ color: QUALITY_COLOR[v] || '#999', fontSize: 12 }}>{v}</Text> : '—',
    },
    { title: 'Last Update', dataIndex: 'last_updated', key: 'ts', width: 150, render: (v: string) =>
      v ? new Date(v).toLocaleTimeString() : '—',
    },
    { title: 'Actions', key: 'act', width: 140, render: (_: any, r: OPCTag) => (
      <Space>
        <Tooltip title="Refresh value">
          <Button size="small" icon={<ReloadOutlined />} onClick={() => refreshTagMut.mutate(r.id)} />
        </Tooltip>
        <Tooltip title="History">
          <Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryTag(r)} />
        </Tooltip>
        <Tooltip title="EBR Mapping">
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => { setMappingTag(r); setMappingModal(true); }} />
        </Tooltip>
        <Tooltip title="Equipment Mapping">
          <Button size="small" icon={<ToolOutlined />} onClick={() => { setEqMappingTag(r); setEqMappingModal(true); }} />
        </Tooltip>
        <Popconfirm title="Delete tag?" onConfirm={() => deleteTagMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>OPC Interface</Title>
          <Text type="secondary">OPC-UA server connections and real-time process data</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditServer(null); serverForm.resetFields(); setServerModal(true); }}>
          New Server
        </Button>
      </div>

      <Table
        dataSource={servers}
        columns={serverCols}
        rowKey="id"
        loading={serverLoading}
        pagination={false}
        locale={{ emptyText: <Empty description="No OPC servers configured" /> }}
      />

      {/* Server Create/Edit Modal */}
      <Modal
        open={serverModal}
        title={editServer ? 'Edit OPC Server' : 'New OPC Server'}
        onCancel={() => { setServerModal(false); setEditServer(null); serverForm.resetFields(); }}
        onOk={() => serverForm.validateFields().then(v => createServerMut.mutate(v))}
        confirmLoading={createServerMut.isPending}
        width={640}
      >
        <Form form={serverForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Server Name" rules={[{ required: true }]}>
                <Input placeholder="Production OPC Server" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="endpoint_url" label="OPC-UA Endpoint URL" rules={[{ required: true }]}>
            <Input placeholder="opc.tcp://192.168.1.100:4840/freeopcua/server/" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="security_mode" label="Security Mode" initialValue="NONE">
                <Select options={SECURITY_MODES} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="polling_interval_ms" label="Polling Interval (ms)" initialValue={1000}>
                <InputNumber min={100} max={60000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="connection_timeout_s" label="Timeout (s)" initialValue={10}>
                <InputNumber min={1} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="Username">
                <Input placeholder="opc_user" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="Password">
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="simulation_mode" label="Simulation Mode" valuePropName="checked" initialValue={false}
            extra="Enable to generate simulated tag values without a real OPC server. Useful for testing and demos.">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tags Drawer */}
      <Drawer
        title={
          <Space>
            <ApiOutlined />
            <span>Tags — {selectedServer?.name}</span>
            <Badge status={CONN_STATUS_COLOR[selectedServer?.status || 'DISCONNECTED'] as any} text={selectedServer?.status} />
          </Space>
        }
        width={1000}
        open={tagDrawer}
        onClose={() => { setTagDrawer(false); setLiveRefresh(false); }}
        extra={
          <Space>
            {selectedServer?.simulation_mode && (
              <Button size="small" icon={<ExperimentOutlined />} loading={simTagsMut.isPending}
                onClick={() => selectedServer && simTagsMut.mutate(selectedServer.id)}>
                Add Default Tags
              </Button>
            )}
            <Button size="small" icon={<ReloadOutlined />} loading={refreshAllMut.isPending}
              onClick={() => selectedServer && refreshAllMut.mutate(selectedServer.id)}>
              Refresh All
            </Button>
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Live</Text>
              <Switch size="small" checked={liveRefresh} onChange={setLiveRefresh} />
            </Space>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setTagModal(true)}>
              Add Tag
            </Button>
          </Space>
        }
      >
        {selectedServer && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="Total Tags" value={tags.length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Good Quality" value={tags.filter(t => t.quality === 'Good').length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="With Values" value={tags.filter(t => t.current_value).length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Polling (ms)" value={selectedServer.polling_interval_ms} /></Card></Col>
          </Row>
        )}
        <Table
          dataSource={tags}
          columns={tagCols}
          rowKey="id"
          loading={tagLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description={selectedServer?.simulation_mode ? 'Click "Add Default Tags" to seed pharma process tags' : 'No tags configured'} /> }}
        />
      </Drawer>

      {/* Add Tag Modal */}
      <Modal
        open={tagModal}
        title="Add OPC Tag"
        onCancel={() => { setTagModal(false); tagForm.resetFields(); }}
        onOk={() => tagForm.validateFields().then(v => createTagMut.mutate(v))}
        confirmLoading={createTagMut.isPending}
      >
        <Form form={tagForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="node_id" label="Node ID" rules={[{ required: true }]}>
            <Input placeholder="ns=2;s=Device1.Temperature" />
          </Form.Item>
          <Form.Item name="display_name" label="Display Name" rules={[{ required: true }]}>
            <Input placeholder="Reactor Temperature" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="data_type" label="Data Type" initialValue="Float">
                <Select options={DATA_TYPES.map(t => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Engineering Unit">
                <Input placeholder="°C, bar, rpm, %" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="low_limit" label="Low Limit">
                <InputNumber style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="high_limit" label="High Limit">
                <InputNumber style={{ width: '100%' }} placeholder="100" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Tag History Drawer */}
      <Drawer
        title={`History — ${historyTag?.display_name}`}
        width={520}
        open={!!historyTag}
        onClose={() => setHistoryTag(null)}
      >
        {historyTag && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Node ID" span={2}><Text code style={{ fontSize: 11 }}>{historyTag.node_id}</Text></Descriptions.Item>
              <Descriptions.Item label="Type">{historyTag.data_type}</Descriptions.Item>
              <Descriptions.Item label="Unit">{historyTag.unit || '—'}</Descriptions.Item>
              <Descriptions.Item label="Current">{historyTag.current_value ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Quality" ><Text style={{ color: QUALITY_COLOR[historyTag.quality || ''] || '#999' }}>{historyTag.quality || '—'}</Text></Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={history}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 15 }}
              columns={[
                { title: 'Value', dataIndex: 'value', key: 'v', render: (v: string) => <Text code style={{ fontSize: 12 }}>{v} {historyTag.unit}</Text> },
                { title: 'Quality', dataIndex: 'quality', key: 'q', render: (v: string) => <Text style={{ color: QUALITY_COLOR[v] || '#999', fontSize: 12 }}>{v || '—'}</Text> },
                { title: 'Timestamp', dataIndex: 'timestamp', key: 'ts', render: (v: string) => new Date(v).toLocaleString() },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* Equipment Mapping Modal */}
      <Modal
        open={eqMappingModal}
        title={<Space><ToolOutlined /><span>Equipment Mappings — {eqMappingTag?.display_name}</span></Space>}
        onCancel={() => { setEqMappingModal(false); setEqMappingTag(null); eqMappingForm.resetFields(); }}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Form form={eqMappingForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    placeholder="Select equipment"
                    optionFilterProp="label"
                    options={equipmentList.map((e: any) => ({ value: e.id, label: `${e.equipment_id} — ${e.name}` }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="log_field" label="Log Field" rules={[{ required: true }]}
                  extra="Field in the equipment log to auto-fill (e.g. temperature, notes)">
                  <Input placeholder="e.g. temperature, pressure, notes" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="log_type" label="Log Type (optional)"
                  extra="Only apply for this log type">
                  <Select allowClear placeholder="All types" options={[
                    { value: 'MAINTENANCE', label: 'Maintenance' },
                    { value: 'CALIBRATION', label: 'Calibration' },
                    { value: 'REPAIR', label: 'Repair' },
                    { value: 'INSPECTION', label: 'Inspection' },
                    { value: 'QUALIFICATION', label: 'Qualification' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="transform_formula" label="Transform Formula (optional)">
                  <Input placeholder="value * 1.8 + 32" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="auto_fill" label="Auto-Fill" valuePropName="checked" initialValue={false}>
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                <Button type="primary" loading={createEqMappingMut.isPending}
                  onClick={() => eqMappingForm.validateFields().then(v => createEqMappingMut.mutate(v))}>
                  Add
                </Button>
              </Col>
            </Row>
          </Form>
        </div>
        <Table
          dataSource={eqMappings}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="No equipment mappings yet" /> }}
          columns={[
            { title: 'Equipment', dataIndex: 'equipment_id', key: 'eq', render: (v: string) => {
              const eq = equipmentList.find((e: any) => e.id === v);
              return eq ? <Text>{eq.equipment_id} — {eq.name}</Text> : <Text type="secondary">{v.slice(0, 8)}…</Text>;
            }},
            { title: 'Log Field', dataIndex: 'log_field', key: 'lf', render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: 'Log Type', dataIndex: 'log_type', key: 'lt', render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">All</Text> },
            { title: 'Auto Fill', dataIndex: 'auto_fill', key: 'af', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
            { title: 'Formula', dataIndex: 'transform_formula', key: 'f', render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
            { title: '', key: 'del', render: (_: any, r: OPCEquipmentMapping) => (
              <Popconfirm title="Delete mapping?" onConfirm={() => deleteEqMappingMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )},
          ]}
        />
      </Modal>

      {/* EBR Mapping Modal */}
      <Modal
        open={mappingModal}
        title={`EBR Mappings — ${mappingTag?.display_name}`}
        onCancel={() => { setMappingModal(false); setMappingTag(null); mappingForm.resetFields(); }}
        footer={null}
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <Form form={mappingForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="parameter_name" label="EBR Parameter Name" rules={[{ required: true }]}>
                  <Input placeholder="e.g. Inlet Temperature" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="step_title" label="Step Title (optional)">
                  <Input placeholder="e.g. Wet Granulation" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="transform_formula" label="Transform Formula (optional)">
                  <Input placeholder="value * 1.8 + 32" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="auto_fill" label="Auto-Fill EBR" valuePropName="checked" initialValue={false}>
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                <Button type="primary" loading={createMappingMut.isPending}
                  onClick={() => mappingForm.validateFields().then(v => createMappingMut.mutate(v))}>
                  Add Mapping
                </Button>
              </Col>
            </Row>
          </Form>
        </div>
        <Table
          dataSource={mappings}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: 'Parameter', dataIndex: 'parameter_name', key: 'p' },
            { title: 'Step', dataIndex: 'step_title', key: 's', render: (v: string) => v || '—' },
            { title: 'Auto Fill', dataIndex: 'auto_fill', key: 'af', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
            { title: 'Formula', dataIndex: 'transform_formula', key: 'f', render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
            { title: '', key: 'del', render: (_: any, r: OPCEBRMapping) => (
              <Popconfirm title="Delete mapping?" onConfirm={() => deleteMappingMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )},
          ]}
        />
      </Modal>
    </div>
  );
}
