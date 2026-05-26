import {
  Card, Button, Space, Tag, Typography, Descriptions, Timeline,
  Badge, Modal, Form, Input, Select, Alert, Divider, Table, Row, Col, DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, PlusOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviationApi, capaApi } from '../../api/quality';
import ESignatureModal from '../../components/ESignatureModal';
import SignatureList from '../../components/SignatureList';
import { useAuthStore } from '../../store/authStore';
import type { CAPASummary, CAPAStatus } from '../../types/quality';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'error', MAJOR: 'warning', MINOR: 'default',
};
const DEV_STATUS_BADGE: Record<string, string> = {
  OPEN: 'error', UNDER_INVESTIGATION: 'processing',
  PENDING_CAPA: 'warning', RESOLVED: 'success', CLOSED: 'default',
};
const CAPA_STATUS_CFG: Record<CAPAStatus, { badge: string; label: string }> = {
  OPEN:                 { badge: 'default',    label: 'Open' },
  IN_PROGRESS:          { badge: 'processing', label: 'In Progress' },
  PENDING_VERIFICATION: { badge: 'warning',    label: 'Pending Verification' },
  VERIFIED:             { badge: 'success',    label: 'Verified' },
  CLOSED:               { badge: 'default',    label: 'Closed' },
};
const CAPA_TYPE_COLOR: Record<string, string> = {
  CORRECTIVE: 'red', PREVENTIVE: 'green', BOTH: 'purple',
};

export default function DeviationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('quality:manage');

  const [investigateOpen, setInvestigateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [capaOpen, setCapaOpen] = useState(false);
  const [closeSignOpen, setCloseSignOpen] = useState(false);
  const [investigateForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [capaForm] = Form.useForm();

  const { data: dev, isLoading } = useQuery({
    queryKey: ['deviation', id],
    queryFn: () => deviationApi.get(id!),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deviation', id] });

  const investigateMutation = useMutation({
    mutationFn: (v: any) => deviationApi.investigate(id!, v),
    onSuccess: () => { invalidate(); setInvestigateOpen(false); investigateForm.resetFields(); },
  });
  const pendingCapaMutation = useMutation({
    mutationFn: () => deviationApi.pendingCapa(id!),
    onSuccess: invalidate,
  });
  const resolveMutation = useMutation({
    mutationFn: (v: any) => deviationApi.resolve(id!, v),
    onSuccess: () => { invalidate(); setResolveOpen(false); resolveForm.resetFields(); },
  });
  const handleCloseSignSuccess = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['esignatures', 'deviation', id] });
    setCloseSignOpen(false);
  };
  const capaCreateMutation = useMutation({
    mutationFn: (v: any) => capaApi.create({ ...v, deviation_id: id }),
    onSuccess: () => { invalidate(); setCapaOpen(false); capaForm.resetFields(); },
  });

  if (isLoading || !dev) return null;

  const capaColumns = [
    {
      title: 'CAPA',
      key: 'capa',
      render: (_: any, r: CAPASummary) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, fontWeight: 600, height: 'auto' }}
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: CAPAStatus) => <Badge status={CAPA_STATUS_CFG[v].badge as any} text={CAPA_STATUS_CFG[v].label} />,
    },
    { title: 'Due Date', dataIndex: 'due_date', key: 'due',
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
    {
      title: 'Assigned To',
      key: 'assigned',
      render: (_: any, r: CAPASummary) => r.assigned_to?.full_name || '—',
    },
    {
      title: '',
      key: 'act',
      render: (_: any, r: CAPASummary) => (
        <Button size="small" onClick={() => navigate(`/quality/capas/${r.id}`)}>Open</Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/quality')}>Back</Button>
        {canManage && (
          <Space>
            {dev.status === 'OPEN' && (
              <Button type="primary" onClick={() => setInvestigateOpen(true)}>
                Start Investigation
              </Button>
            )}
            {dev.status === 'UNDER_INVESTIGATION' && (
              <>
                <Button onClick={() => setInvestigateOpen(true)}>Update Investigation</Button>
                <Button type="primary" onClick={() => pendingCapaMutation.mutate()}>
                  Mark Pending CAPA
                </Button>
              </>
            )}
            {(dev.status === 'UNDER_INVESTIGATION' || dev.status === 'PENDING_CAPA') && (
              <Button onClick={() => setResolveOpen(true)}>Resolve</Button>
            )}
            {dev.status === 'RESOLVED' && (
              <Button type="primary" icon={<CheckCircleOutlined />}
                onClick={() => setCloseSignOpen(true)}>
                Close Deviation
              </Button>
            )}
          </Space>
        )}
      </div>

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Space>
            <WarningOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <Title level={4} style={{ margin: 0 }}>{dev.title}</Title>
          </Space>
          <Space wrap>
            <Tag style={{ fontSize: 11 }}>{dev.deviation_number}</Tag>
            <Tag color={SEVERITY_COLOR[dev.severity]}>{dev.severity}</Tag>
            <Tag color="blue">{dev.deviation_type}</Tag>
            <Badge status={DEV_STATUS_BADGE[dev.status] as any}
              text={dev.status.replace(/_/g, ' ')} />
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Left column */}
        <Col xs={24} lg={14}>
          <Card title="Details" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Detected By">{dev.detected_by.full_name}</Descriptions.Item>
              <Descriptions.Item label="Detected On">
                {new Date(dev.detected_at).toLocaleString()}
              </Descriptions.Item>
              {dev.batch_number && (
                <Descriptions.Item label="Batch Number">
                  <span style={{ fontFamily: 'monospace' }}>{dev.batch_number}</span>
                </Descriptions.Item>
              )}
              {dev.product_name && (
                <Descriptions.Item label="Product">{dev.product_name}</Descriptions.Item>
              )}
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>DESCRIPTION</Text>
            <p style={{ marginTop: 6, marginBottom: 0 }}>{dev.description}</p>
            {dev.immediate_action && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>IMMEDIATE ACTION TAKEN</Text>
                <p style={{ marginTop: 6, marginBottom: 0 }}>{dev.immediate_action}</p>
              </>
            )}
          </Card>

          {(dev.root_cause || dev.investigation_summary) && (
            <Card title="Investigation Findings" style={{ marginBottom: 16 }}>
              {dev.investigated_by && (
                <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Investigated By">{dev.investigated_by.full_name}</Descriptions.Item>
                  <Descriptions.Item label="Investigation Date">
                    {dev.investigated_at ? new Date(dev.investigated_at).toLocaleDateString() : '—'}
                  </Descriptions.Item>
                </Descriptions>
              )}
              {dev.root_cause && (
                <>
                  <Text type="secondary" style={{ fontSize: 12 }}>ROOT CAUSE</Text>
                  <p style={{ marginTop: 6, marginBottom: 12 }}>{dev.root_cause}</p>
                </>
              )}
              {dev.investigation_summary && (
                <>
                  <Text type="secondary" style={{ fontSize: 12 }}>INVESTIGATION SUMMARY</Text>
                  <p style={{ marginTop: 6, marginBottom: 0 }}>{dev.investigation_summary}</p>
                </>
              )}
            </Card>
          )}

          {dev.closure_comments && (
            <Card title="Closure" style={{ marginBottom: 16 }}>
              {dev.closed_by && (
                <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Closed By">{dev.closed_by.full_name}</Descriptions.Item>
                  <Descriptions.Item label="Closed On">
                    {dev.closed_at ? new Date(dev.closed_at).toLocaleDateString() : '—'}
                  </Descriptions.Item>
                </Descriptions>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>CLOSURE COMMENTS</Text>
              <p style={{ marginTop: 6, marginBottom: 0 }}>{dev.closure_comments}</p>
            </Card>
          )}
        </Col>

        {/* Right column — Status timeline */}
        <Col xs={24} lg={10}>
          <Card title="Status Timeline" style={{ marginBottom: 16 }}>
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <>
                      <Text strong>Deviation Raised</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(dev.detected_at).toLocaleString()} by {dev.detected_by.full_name}
                      </Text>
                    </>
                  ),
                },
                ...(dev.investigated_at ? [{
                  color: 'blue',
                  children: (
                    <>
                      <Text strong>Investigation Recorded</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(dev.investigated_at).toLocaleString()} by {dev.investigated_by?.full_name}
                      </Text>
                    </>
                  ),
                }] : []),
                ...(dev.capas.length > 0 ? [{
                  color: 'orange',
                  children: (
                    <>
                      <Text strong>{dev.capas.length} CAPA(s) Created</Text>
                    </>
                  ),
                }] : []),
                ...(dev.closed_at ? [{
                  color: 'gray',
                  children: (
                    <>
                      <Text strong>Deviation Closed</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(dev.closed_at).toLocaleString()} by {dev.closed_by?.full_name}
                      </Text>
                    </>
                  ),
                }] : []),
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* CAPAs section */}
      <Card
        title="Linked CAPAs"
        extra={canManage && dev.status !== 'CLOSED' && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setCapaOpen(true)}>
            Add CAPA
          </Button>
        )}
      >
        {dev.capas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#ccc' }}>
            No CAPAs linked to this deviation
          </div>
        ) : (
          <Table dataSource={dev.capas} columns={capaColumns} rowKey="id" pagination={false} size="small" />
        )}
      </Card>

      {/* Investigate Modal */}
      <Modal
        title="Record Investigation"
        open={investigateOpen}
        onCancel={() => setInvestigateOpen(false)}
        onOk={() => investigateForm.submit()}
        confirmLoading={investigateMutation.isPending}
        okText="Save Investigation"
        width={600}
      >
        {investigateMutation.isError && (
          <Alert type="error" message={(investigateMutation.error as any)?.response?.data?.detail}
            style={{ marginBottom: 12 }} />
        )}
        <Form form={investigateForm} layout="vertical"
          onFinish={v => investigateMutation.mutate(v)}
          initialValues={{ root_cause: dev.root_cause, investigation_summary: dev.investigation_summary }}>
          <Form.Item name="root_cause" label="Root Cause"
            rules={[{ required: true, message: 'Root cause is required' }]}>
            <Input.TextArea rows={3} placeholder="Identify the root cause of this deviation..." />
          </Form.Item>
          <Form.Item name="investigation_summary" label="Investigation Summary"
            rules={[{ required: true, message: 'Summary is required' }]}>
            <Input.TextArea rows={4} placeholder="Describe the investigation steps and findings..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="Resolve Deviation"
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        onOk={() => resolveForm.submit()}
        confirmLoading={resolveMutation.isPending}
        okText="Mark as Resolved"
      >
        <Form form={resolveForm} layout="vertical" onFinish={v => resolveMutation.mutate(v)}>
          <Form.Item name="closure_comments" label="Closure Comments"
            rules={[{ required: true, message: 'Closure comments required' }]}>
            <Input.TextArea rows={4} placeholder="Summarize how this deviation was resolved..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* E-Signature — Close Deviation */}
      {dev && (
        <ESignatureModal
          open={closeSignOpen}
          onClose={() => setCloseSignOpen(false)}
          onSuccess={handleCloseSignSuccess}
          resourceType="deviation"
          resourceId={id!}
          resourceLabel={`${dev.deviation_number} — ${dev.title}`}
          action="close"
          actionLabel="Close Deviation & Sign"
          meanings={['Deviation Closed — Resolution Verified', 'Closed — All CAPAs Complete']}
        />
      )}

      {/* Signature History */}
      {id && <SignatureList resourceType="deviation" resourceId={id} />}

      {/* Create CAPA Modal */}
      <Modal
        title="Add CAPA"
        open={capaOpen}
        onCancel={() => setCapaOpen(false)}
        onOk={() => capaForm.submit()}
        confirmLoading={capaCreateMutation.isPending}
        okText="Create CAPA"
        width={600}
      >
        {capaCreateMutation.isError && (
          <Alert type="error" message={(capaCreateMutation.error as any)?.response?.data?.detail}
            style={{ marginBottom: 12 }} />
        )}
        <Form form={capaForm} layout="vertical" onFinish={v => {
          capaCreateMutation.mutate({
            ...v,
            due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : null,
          });
        }}>
          <Form.Item name="title" label="CAPA Title" rules={[{ required: true }]}>
            <Input placeholder="Brief title for this action..." />
          </Form.Item>
          <Form.Item name="capa_type" label="Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'CORRECTIVE', label: 'Corrective Action' },
              { value: 'PREVENTIVE', label: 'Preventive Action' },
              { value: 'BOTH',       label: 'Corrective + Preventive' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe the action to be taken..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
