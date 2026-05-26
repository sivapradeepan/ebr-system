import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Input,
  Switch, Select, Tabs, Badge, Tooltip, Popconfirm, message, Row, Col,
  Drawer, Descriptions, Empty, Statistic,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, PlayCircleOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined,
  ReloadOutlined, EyeOutlined, SendOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { idocApi, type IDocConnection, type IDocMessage } from '../../api/integration';

const { Title, Text } = Typography;

const CONN_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success', INACTIVE: 'default', ERROR: 'error',
};

const MSG_STATUS_COLOR: Record<string, string> = {
  QUEUED: 'processing', PROCESSING: 'warning', PROCESSED: 'success',
  ERROR: 'error', IGNORED: 'default',
};

const IDOC_TYPES = ['MATMAS', 'PRODORD', 'BATCHA', 'ZMBR_OUT', 'LOIPRO', 'MBGMCR', 'OTHER'];

export default function IDOCInterface() {
  const qc = useQueryClient();
  const [connModal, setConnModal] = useState(false);
  const [editConn, setEditConn] = useState<IDocConnection | null>(null);
  const [selectedConn, setSelectedConn] = useState<IDocConnection | null>(null);
  const [msgDrawer, setMsgDrawer] = useState(false);
  const [payloadDrawer, setPayloadDrawer] = useState<IDocMessage | null>(null);
  const [simType, setSimType] = useState('PRODORD');
  const [simCount, setSimCount] = useState(3);
  const [form] = Form.useForm();

  const { data: connData, isLoading: connLoading } = useQuery({
    queryKey: ['idoc-connections'],
    queryFn: () => idocApi.listConnections(),
    refetchInterval: 10000,
  });

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ['idoc-messages', selectedConn?.id],
    queryFn: () => idocApi.listMessages({ connection_id: selectedConn?.id, size: 100 }),
    enabled: !!selectedConn && msgDrawer,
    refetchInterval: 5000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => editConn ? idocApi.updateConnection(editConn.id, data) : idocApi.createConnection(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['idoc-connections'] }); setConnModal(false); message.success(editConn ? 'Connection updated' : 'Connection created'); form.resetFields(); setEditConn(null); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: idocApi.deleteConnection,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['idoc-connections'] }); message.success('Deleted'); },
  });

  const testMut = useMutation({
    mutationFn: idocApi.testConnection,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['idoc-connections'] }); message.success(r.message); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Test failed'),
  });

  const simulateMut = useMutation({
    mutationFn: ({ id, type, count }: any) => idocApi.simulateInbound(id, type, count),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['idoc-messages'] }); message.success(r.message); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const processMut = useMutation({
    mutationFn: idocApi.processQueue,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['idoc-messages', selectedConn?.id] }); message.success(`Processed: ${r.processed}, Errors: ${r.errors}`); },
  });

  const retryMut = useMutation({
    mutationFn: idocApi.retryMessage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['idoc-messages', selectedConn?.id] }); message.success('Queued for retry'); },
  });

  const deleteMsgMut = useMutation({
    mutationFn: idocApi.deleteMessage,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['idoc-messages', selectedConn?.id] }); },
  });

  const openCreate = () => { setEditConn(null); form.resetFields(); setConnModal(true); };
  const openEdit = (c: IDocConnection) => {
    setEditConn(c);
    form.setFieldsValue({ ...c });
    setConnModal(true);
  };

  const connections: IDocConnection[] = connData?.items || [];
  const messages: IDocMessage[] = msgData?.items || [];

  const stats = {
    queued: messages.filter(m => m.status === 'QUEUED').length,
    processed: messages.filter(m => m.status === 'PROCESSED').length,
    errors: messages.filter(m => m.status === 'ERROR').length,
  };

  const connCols = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string, r: IDocConnection) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
      </Space>
    )},
    { title: 'SAP Host', dataIndex: 'sap_host', key: 'host', render: (v: string, r: IDocConnection) => (
      <Space direction="vertical" size={0}>
        <Text code style={{ fontSize: 12 }}>{v}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>Client {r.sap_client} · SysNr {r.sap_system_number}</Text>
      </Space>
    )},
    { title: 'Mode', key: 'mode', render: (_: any, r: IDocConnection) => (
      <Space>
        {r.simulation_mode && <Tag color="purple" style={{ fontSize: 11 }}><ExperimentOutlined /> Simulation</Tag>}
        {r.inbound_enabled && <Tag color="blue" style={{ fontSize: 11 }}><InboxOutlined /> In</Tag>}
        {r.outbound_enabled && <Tag color="cyan" style={{ fontSize: 11 }}><SendOutlined /> Out</Tag>}
      </Space>
    )},
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => (
      <Badge status={CONN_STATUS_COLOR[v] as any} text={v} />
    )},
    { title: 'Messages', dataIndex: 'message_count', key: 'msgs', render: (v: number, r: IDocConnection) => (
      <Button type="link" size="small" onClick={() => { setSelectedConn(r); setMsgDrawer(true); }}>{v} messages</Button>
    )},
    { title: 'Last Connected', dataIndex: 'last_connected_at', key: 'conn', render: (v: string) =>
      v ? new Date(v).toLocaleString() : '—',
    },
    { title: 'Actions', key: 'actions', render: (_: any, r: IDocConnection) => (
      <Space>
        <Tooltip title="Test Connection">
          <Button icon={<PlayCircleOutlined />} size="small" loading={testMut.isPending} onClick={() => testMut.mutate(r.id)} />
        </Tooltip>
        <Tooltip title="Edit">
          <Button icon={<EyeOutlined />} size="small" onClick={() => openEdit(r)} />
        </Tooltip>
        <Popconfirm title="Delete this connection?" onConfirm={() => deleteMut.mutate(r.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      </Space>
    )},
  ];

  const msgCols = [
    { title: 'Type', key: 'type', render: (_: any, r: IDocMessage) => (
      <Space>
        <Tag color={r.direction === 'INBOUND' ? 'blue' : 'cyan'}>{r.direction}</Tag>
        <Tag>{r.idoc_type}</Tag>
      </Space>
    )},
    { title: 'IDoc Number', dataIndex: 'idoc_number', key: 'num', render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => (
      <Badge status={MSG_STATUS_COLOR[v] as any} text={v} />
    )},
    { title: 'Retries', dataIndex: 'retry_count', key: 'retry', render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : '—' },
    { title: 'Error', dataIndex: 'error_message', key: 'err', ellipsis: true, render: (v: string) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '—' },
    { title: 'Created', dataIndex: 'created_at', key: 'ts', render: (v: string) => new Date(v).toLocaleString() },
    { title: 'Actions', key: 'act', render: (_: any, r: IDocMessage) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => setPayloadDrawer(r)}>Payload</Button>
        {r.status === 'ERROR' && (
          <Tooltip title="Retry"><Button size="small" icon={<ReloadOutlined />} onClick={() => retryMut.mutate(r.id)} /></Tooltip>
        )}
        <Popconfirm title="Delete message?" onConfirm={() => deleteMsgMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>IDoc Interface</Title>
          <Text type="secondary">SAP ERP integration via IDoc messaging</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Connection</Button>
      </div>

      <Table
        dataSource={connections}
        columns={connCols}
        rowKey="id"
        loading={connLoading}
        pagination={false}
        locale={{ emptyText: <Empty description="No IDoc connections configured" /> }}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={connModal}
        title={editConn ? 'Edit IDoc Connection' : 'New IDoc Connection'}
        onCancel={() => { setConnModal(false); setEditConn(null); form.resetFields(); }}
        onOk={() => form.validateFields().then(v => createMut.mutate(v))}
        confirmLoading={createMut.isPending}
        width={680}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Connection Name" rules={[{ required: true }]}>
                <Input placeholder="SAP-Production" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Optional description" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sap_host" label="SAP Host / IP" rules={[{ required: true }]}>
                <Input placeholder="sap-host.company.com" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sap_system_number" label="System Number" rules={[{ required: true }]}>
                <Input placeholder="00" maxLength={2} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sap_client" label="Client" rules={[{ required: true }]}>
                <Input placeholder="100" maxLength={3} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sap_user" label="SAP User" rules={[{ required: true }]}>
                <Input placeholder="IDOC_USER" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sap_password" label="SAP Password" rules={[{ required: true }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rfc_destination" label="RFC Destination">
                <Input placeholder="EBR_RFC_DEST" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="partner_number" label="Partner Number (Logical System)">
                <Input placeholder="SAPCLNT100" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inbound_enabled" label="Inbound" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="outbound_enabled" label="Outbound" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="auto_process" label="Auto Process" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="simulation_mode" label="Simulation Mode" valuePropName="checked" initialValue={false}
            extra="Enable to test without a real SAP system. Generates mock IDocs and simulates processing.">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Message Log Drawer */}
      <Drawer
        title={`Messages — ${selectedConn?.name}`}
        width={900}
        open={msgDrawer}
        onClose={() => setMsgDrawer(false)}
        extra={
          <Space>
            {selectedConn?.simulation_mode && (
              <>
                <Select value={simType} onChange={setSimType} size="small" style={{ width: 120 }}
                  options={IDOC_TYPES.map(t => ({ value: t, label: t }))} />
                <Select value={simCount} onChange={setSimCount} size="small" style={{ width: 70 }}
                  options={[1,3,5,10].map(n => ({ value: n, label: n }))} />
                <Button size="small" icon={<ExperimentOutlined />} loading={simulateMut.isPending}
                  onClick={() => simulateMut.mutate({ id: selectedConn.id, type: simType, count: simCount })}>
                  Simulate
                </Button>
              </>
            )}
            <Button size="small" icon={<SyncOutlined />} loading={processMut.isPending}
              onClick={() => selectedConn && processMut.mutate(selectedConn.id)}>
              Process Queue
            </Button>
            <Button size="small" icon={<ReloadOutlined />}
              onClick={() => qc.invalidateQueries({ queryKey: ['idoc-messages', selectedConn?.id] })}>
              Refresh
            </Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}><Card size="small"><Statistic title="Queued" value={stats.queued} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="Processed" value={stats.processed} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="Errors" value={stats.errors} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>
        <Table
          dataSource={messages}
          columns={msgCols}
          rowKey="id"
          loading={msgLoading}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Drawer>

      {/* Payload Drawer */}
      <Drawer
        title="IDoc Payload"
        width={600}
        open={!!payloadDrawer}
        onClose={() => setPayloadDrawer(null)}
      >
        {payloadDrawer && (
          <>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Direction">{payloadDrawer.direction}</Descriptions.Item>
              <Descriptions.Item label="Type">{payloadDrawer.idoc_type}</Descriptions.Item>
              <Descriptions.Item label="IDoc Number">{payloadDrawer.idoc_number || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">{payloadDrawer.status}</Descriptions.Item>
              {payloadDrawer.error_message && (
                <Descriptions.Item label="Error"><Text type="danger">{payloadDrawer.error_message}</Text></Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ background: '#1e1e1e', borderRadius: 6, padding: 16 }}>
              <pre style={{ color: '#d4d4d4', fontSize: 12, margin: 0, overflow: 'auto', maxHeight: 400 }}>
                {JSON.stringify(payloadDrawer.payload, null, 2)}
              </pre>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
