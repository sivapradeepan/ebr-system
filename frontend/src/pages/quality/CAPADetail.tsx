import {
  Card, Button, Space, Tag, Typography, Descriptions, Badge,
  Modal, Form, Input, Alert, Divider, Timeline, Row, Col,
} from 'antd';
import {
  ArrowLeftOutlined, FileSearchOutlined,
  CheckCircleOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { capaApi } from '../../api/quality';
import ESignatureModal from '../../components/ESignatureModal';
import SignatureList from '../../components/SignatureList';
import { useAuthStore } from '../../store/authStore';
import type { CAPAStatus } from '../../types/quality';

const { Title, Text } = Typography;

const STATUS_CFG: Record<CAPAStatus, { badge: string; label: string }> = {
  OPEN:                 { badge: 'default',    label: 'Open' },
  IN_PROGRESS:          { badge: 'processing', label: 'In Progress' },
  PENDING_VERIFICATION: { badge: 'warning',    label: 'Pending Verification' },
  VERIFIED:             { badge: 'success',    label: 'Verified' },
  CLOSED:               { badge: 'default',    label: 'Closed' },
};
const TYPE_COLOR: Record<string, string> = {
  CORRECTIVE: 'red', PREVENTIVE: 'green', BOTH: 'purple',
};

export default function CAPADetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('quality:manage');

  const [completeOpen, setCompleteOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [closeSignOpen, setCloseSignOpen] = useState(false);
  const [completeForm] = Form.useForm();
  const [verifyForm] = Form.useForm();

  const { data: capa, isLoading } = useQuery({
    queryKey: ['capa', id],
    queryFn: () => capaApi.get(id!),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['capa', id] });

  const startMutation = useMutation({
    mutationFn: () => capaApi.start(id!),
    onSuccess: invalidate,
  });
  const completeMutation = useMutation({
    mutationFn: (v: any) => capaApi.complete(id!, v),
    onSuccess: () => { invalidate(); setCompleteOpen(false); completeForm.resetFields(); },
  });
  const verifyMutation = useMutation({
    mutationFn: (v: any) => capaApi.verify(id!, v),
    onSuccess: () => { invalidate(); setVerifyOpen(false); verifyForm.resetFields(); },
  });
  const handleCloseSignSuccess = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['esignatures', 'capa', id] });
    setCloseSignOpen(false);
  };

  if (isLoading || !capa) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/quality')}>Back</Button>
        {canManage && (
          <Space>
            {capa.status === 'OPEN' && (
              <Button type="primary" icon={<PlayCircleOutlined />}
                onClick={() => startMutation.mutate()} loading={startMutation.isPending}>
                Start CAPA
              </Button>
            )}
            {capa.status === 'IN_PROGRESS' && (
              <Button type="primary" onClick={() => setCompleteOpen(true)}>
                Mark Complete
              </Button>
            )}
            {capa.status === 'PENDING_VERIFICATION' && (
              <Button type="primary" icon={<CheckCircleOutlined />}
                onClick={() => setVerifyOpen(true)}>
                Verify Effectiveness
              </Button>
            )}
            {capa.status === 'VERIFIED' && (
              <Button icon={<CheckCircleOutlined />} onClick={() => setCloseSignOpen(true)}>
                Close CAPA
              </Button>
            )}
          </Space>
        )}
      </div>

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Space>
            <FileSearchOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>{capa.title}</Title>
          </Space>
          <Space wrap>
            <Tag style={{ fontSize: 11 }}>{capa.capa_number}</Tag>
            <Tag color={TYPE_COLOR[capa.capa_type]}>{capa.capa_type}</Tag>
            <Badge status={STATUS_CFG[capa.status].badge as any}
              text={STATUS_CFG[capa.status].label} />
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="CAPA Details" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Created By">{capa.created_by.full_name}</Descriptions.Item>
              <Descriptions.Item label="Created On">
                {new Date(capa.created_at).toLocaleDateString()}
              </Descriptions.Item>
              {capa.assigned_to && (
                <Descriptions.Item label="Assigned To">{capa.assigned_to.full_name}</Descriptions.Item>
              )}
              {capa.due_date && (
                <Descriptions.Item label="Due Date">
                  <span style={{
                    color: new Date(capa.due_date) < new Date() && capa.status !== 'CLOSED' ? '#ff4d4f' : undefined,
                  }}>
                    {new Date(capa.due_date).toLocaleDateString()}
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>DESCRIPTION</Text>
            <p style={{ marginTop: 6, marginBottom: 0 }}>{capa.description}</p>
          </Card>

          {/* Linked Deviation */}
          <Card title="Linked Deviation" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Deviation">
                <Button type="link" style={{ padding: 0 }}
                  onClick={() => navigate(`/quality/deviations/${capa.deviation.id}`)}>
                  {capa.deviation.deviation_number} — {capa.deviation.title}
                </Button>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag color={capa.deviation.severity === 'CRITICAL' ? 'error' : capa.deviation.severity === 'MAJOR' ? 'warning' : 'default'}>
                  {capa.deviation.severity}
                </Tag>
              </Descriptions.Item>
              {capa.deviation.batch_number && (
                <Descriptions.Item label="Batch">
                  <span style={{ fontFamily: 'monospace' }}>{capa.deviation.batch_number}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {capa.completion_notes && (
            <Card title="Completion Notes" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small" style={{ marginBottom: 8 }}>
                {capa.completed_by && (
                  <Descriptions.Item label="Completed By">{capa.completed_by.full_name}</Descriptions.Item>
                )}
                {capa.completed_at && (
                  <Descriptions.Item label="Completed On">
                    {new Date(capa.completed_at).toLocaleDateString()}
                  </Descriptions.Item>
                )}
              </Descriptions>
              <p style={{ margin: 0 }}>{capa.completion_notes}</p>
            </Card>
          )}

          {capa.effectiveness_check && (
            <Card title="Effectiveness Verification">
              <Descriptions column={2} size="small" style={{ marginBottom: 8 }}>
                {capa.verified_by && (
                  <Descriptions.Item label="Verified By">{capa.verified_by.full_name}</Descriptions.Item>
                )}
                {capa.verified_at && (
                  <Descriptions.Item label="Verified On">
                    {new Date(capa.verified_at).toLocaleDateString()}
                  </Descriptions.Item>
                )}
              </Descriptions>
              <p style={{ margin: 0 }}>{capa.effectiveness_check}</p>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Progress Timeline">
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <>
                      <Text strong>CAPA Created</Text><br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(capa.created_at).toLocaleString()} by {capa.created_by.full_name}
                      </Text>
                    </>
                  ),
                },
                {
                  color: capa.status !== 'OPEN' ? 'blue' : 'gray',
                  children: (
                    <>
                      <Text strong style={{ color: capa.status === 'OPEN' ? '#ccc' : undefined }}>
                        In Progress
                      </Text>
                    </>
                  ),
                },
                {
                  color: capa.completed_at ? 'blue' : 'gray',
                  children: (
                    <>
                      <Text strong style={{ color: !capa.completed_at ? '#ccc' : undefined }}>
                        Completed
                      </Text>
                      {capa.completed_at && (
                        <><br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(capa.completed_at).toLocaleString()}
                          </Text>
                        </>
                      )}
                    </>
                  ),
                },
                {
                  color: capa.verified_at ? 'green' : 'gray',
                  children: (
                    <>
                      <Text strong style={{ color: !capa.verified_at ? '#ccc' : undefined }}>
                        Effectiveness Verified
                      </Text>
                      {capa.verified_at && (
                        <><br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(capa.verified_at).toLocaleString()} by {capa.verified_by?.full_name}
                          </Text>
                        </>
                      )}
                    </>
                  ),
                },
                {
                  color: capa.closed_at ? 'gray' : 'gray',
                  children: (
                    <>
                      <Text strong style={{ color: !capa.closed_at ? '#ccc' : undefined }}>
                        Closed
                      </Text>
                      {capa.closed_at && (
                        <><br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(capa.closed_at).toLocaleString()}
                          </Text>
                        </>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Complete Modal */}
      <Modal title="Mark CAPA Complete" open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={() => completeForm.submit()}
        confirmLoading={completeMutation.isPending} okText="Submit for Verification">
        <Form form={completeForm} layout="vertical" onFinish={v => completeMutation.mutate(v)}>
          <Form.Item name="completion_notes" label="Completion Notes"
            rules={[{ required: true, message: 'Completion notes are required' }]}>
            <Input.TextArea rows={4}
              placeholder="Describe what was done to implement this corrective/preventive action..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* E-Signature — Close CAPA */}
      {capa && (
        <ESignatureModal
          open={closeSignOpen}
          onClose={() => setCloseSignOpen(false)}
          onSuccess={handleCloseSignSuccess}
          resourceType="capa"
          resourceId={id!}
          resourceLabel={`${capa.capa_number} — ${capa.title}`}
          action="close"
          actionLabel="Close CAPA & Sign"
          meanings={['CAPA Closed — Effectiveness Confirmed', 'Closed — All Actions Implemented and Verified']}
        />
      )}

      {/* Signature History */}
      {id && <SignatureList resourceType="capa" resourceId={id} />}

      {/* Verify Modal */}
      <Modal title="Verify Effectiveness" open={verifyOpen}
        onCancel={() => setVerifyOpen(false)}
        onOk={() => verifyForm.submit()}
        confirmLoading={verifyMutation.isPending} okText="Confirm Effective">
        <Form form={verifyForm} layout="vertical" onFinish={v => verifyMutation.mutate(v)}>
          <Form.Item name="effectiveness_check" label="Effectiveness Evidence"
            rules={[{ required: true, message: 'Evidence is required' }]}>
            <Input.TextArea rows={4}
              placeholder="Describe the evidence that the CAPA was effective and the issue has not recurred..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
