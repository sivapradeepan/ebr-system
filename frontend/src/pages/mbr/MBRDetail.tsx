import {
  Card, Descriptions, Tag, Button, Space, Typography, Tabs, Table,
  Badge, Collapse, Divider, Popconfirm, message, Alert,
} from 'antd';
import {
  EditOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  CopyOutlined, ArrowLeftOutlined, WarningOutlined, SafetyOutlined,
} from '@ant-design/icons';
import ESignatureModal from '../../components/ESignatureModal';
import SignatureList from '../../components/SignatureList';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mbrApi } from '../../api/mbr';
import { useAuthStore } from '../../store/authStore';
import type { MBRStatus, MBRStep } from '../../types/mbr';

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<MBRStatus, { color: string; label: string }> = {
  DRAFT:        { color: 'default',    label: 'Draft' },
  UNDER_REVIEW: { color: 'processing', label: 'Under Review' },
  APPROVED:     { color: 'success',    label: 'Approved' },
  EFFECTIVE:    { color: 'green',      label: 'Effective' },
  SUPERSEDED:   { color: 'orange',     label: 'Superseded' },
  OBSOLETE:     { color: 'red',        label: 'Obsolete' },
};

export default function MBRDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [signConfig, setSignConfig] = useState<{
    action: string; actionLabel: string; meanings: string[];
    isDanger?: boolean; requireComments?: boolean;
  } | null>(null);

  const { data: mbr, isLoading } = useQuery({
    queryKey: ['mbr', id],
    queryFn: () => mbrApi.get(id!),
    enabled: !!id,
  });

  const handleSignSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['mbr', id] });
    queryClient.invalidateQueries({ queryKey: ['esignatures', 'mbr', id] });
    message.success('Signature recorded — record updated');
    setSignConfig(null);
  };

  const newVersionMutation = useMutation({
    mutationFn: () => mbrApi.newVersion(id!),
    onSuccess: (data) => { navigate(`/mbr/${data.id}/edit`); message.success(`New version ${data.version} created`); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const submitMutation = useMutation({
    mutationFn: (comments?: string) => mbrApi.submit(id!, comments),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mbr', id] }); message.success('MBR submitted for review'); setSignConfig(null); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to submit'),
  });

  const approveMutation = useMutation({
    mutationFn: (comments?: string) => mbrApi.approve(id!, comments),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mbr', id] }); message.success('MBR approved'); setSignConfig(null); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (comments?: string) => mbrApi.reject(id!, comments),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mbr', id] }); message.success('MBR rejected'); setSignConfig(null); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to reject'),
  });

  if (isLoading || !mbr) return <Card loading />;

  const statusCfg = STATUS_CONFIG[mbr.status];

  // Materials table
  const materialCols = [
    { title: '#', key: 'i', width: 40, render: (_: any, _r: any, i: number) => i + 1 },
    { title: 'Material Name', dataIndex: 'material_name', key: 'name', render: (v: string, r: any) => (
      <Space>{v} {r.is_active_ingredient && <Tag color="red" style={{ fontSize: 10 }}>API</Tag>}</Space>
    )},
    { title: 'Code', dataIndex: 'material_code', key: 'code', render: (v: string) => v || '—' },
    { title: 'Quantity', key: 'qty', render: (_: any, r: any) => `${r.quantity} ${r.unit}` },
    { title: 'Grade', dataIndex: 'grade', key: 'grade', render: (v: string) => v || '—' },
    { title: 'Supplier', dataIndex: 'supplier', key: 'supplier', render: (v: string) => v || '—' },
  ];

  // Equipment table
  const equipCols = [
    { title: '#', key: 'i', width: 40, render: (_: any, _r: any, i: number) => i + 1 },
    { title: 'Equipment', dataIndex: 'equipment_name', key: 'name' },
    { title: 'Code', dataIndex: 'equipment_code', key: 'code', render: (v: string) => v || '—' },
    { title: 'Capacity', dataIndex: 'capacity', key: 'cap', render: (v: string) => v || '—' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '—' },
  ];

  // Steps collapse
  const stepPanels = mbr.steps.map((step: MBRStep, i: number) => ({
    key: `s${i}`,
    label: (
      <Space>
        <Tag color="blue">Step {step.step_number}</Tag>
        <span style={{ fontWeight: 600 }}>{step.title}</span>
        {step.is_critical && <Tag color="red" style={{ fontSize: 10 }}>Critical</Tag>}
        {step.expected_duration_minutes && <Tag style={{ fontSize: 10 }}>{step.expected_duration_minutes} min</Tag>}
      </Space>
    ),
    children: (
      <div>
        {step.description && (
          <div style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>
            <Text>{step.description}</Text>
          </div>
        )}
        {step.expected_yield && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Expected Yield: <strong>{step.expected_yield} {step.yield_unit || ''}</strong>
          </Text>
        )}
        {step.parameters.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Process Parameters</Divider>
            <Table
              dataSource={step.parameters}
              rowKey={(r, i) => r.id || String(i)}
              size="small"
              pagination={false}
              columns={[
                { title: 'Parameter', dataIndex: 'name', key: 'name', render: (v: string, r: any) => (
                  <Space>{v} {r.is_critical && <Tag color="orange" style={{ fontSize: 10 }}>CPP</Tag>}</Space>
                )},
                { title: 'Unit', dataIndex: 'unit', key: 'unit', render: (v: string) => v || '—' },
                { title: 'Target', dataIndex: 'target_value', key: 'target', render: (v: string) => v || '—' },
                { title: 'Min', dataIndex: 'min_value', key: 'min', render: (v: string) => v || '—' },
                { title: 'Max', dataIndex: 'max_value', key: 'max', render: (v: string) => v || '—' },
                { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '—' },
              ]}
            />
          </>
        )}
        {step.ipqcs.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>In-Process Quality Controls</Divider>
            <Table
              dataSource={step.ipqcs}
              rowKey={(r, i) => r.id || String(i)}
              size="small"
              pagination={false}
              columns={[
                { title: 'Test', dataIndex: 'test_name', key: 'test' },
                { title: 'Method', dataIndex: 'method', key: 'method', render: (v: string) => v || '—' },
                { title: 'Acceptance Criteria', dataIndex: 'acceptance_criteria', key: 'criteria' },
                { title: 'Frequency', dataIndex: 'frequency', key: 'freq', render: (v: string) => v || '—' },
                { title: 'Responsible', dataIndex: 'responsible_role', key: 'role', render: (v: string) => v || '—' },
              ]}
            />
          </>
        )}
        {step.notes && <Text type="secondary" style={{ display: 'block', marginTop: 12, fontStyle: 'italic' }}>Note: {step.notes}</Text>}
      </div>
    ),
  }));

  const tabItems = [
    {
      key: 'general',
      label: 'General Info',
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="MBR Number">{mbr.mbr_number}</Descriptions.Item>
          <Descriptions.Item label="Version">v{mbr.version}</Descriptions.Item>
          <Descriptions.Item label="Product Name">{mbr.product_name}</Descriptions.Item>
          <Descriptions.Item label="Product Code">{mbr.product_code}</Descriptions.Item>
          <Descriptions.Item label="Dosage Form">{mbr.dosage_form || '—'}</Descriptions.Item>
          <Descriptions.Item label="Strength">{mbr.strength || '—'}</Descriptions.Item>
          <Descriptions.Item label="Batch Size">{mbr.batch_size ? `${mbr.batch_size} ${mbr.batch_unit || ''}` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Theoretical Yield">{mbr.theoretical_yield ? `${mbr.theoretical_yield} ${mbr.yield_unit || ''}` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Manufacturing Site" span={2}>{mbr.manufacturing_site || '—'}</Descriptions.Item>
          <Descriptions.Item label="Storage Conditions" span={2}>{mbr.storage_conditions || '—'}</Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>{mbr.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="Created By">{mbr.created_by.full_name}</Descriptions.Item>
          <Descriptions.Item label="Created At">{new Date(mbr.created_at).toLocaleString()}</Descriptions.Item>
          {mbr.approved_by && <>
            <Descriptions.Item label="Approved By">{mbr.approved_by.full_name}</Descriptions.Item>
            <Descriptions.Item label="Approved At">{mbr.approved_at ? new Date(mbr.approved_at).toLocaleString() : '—'}</Descriptions.Item>
          </>}
          {mbr.notes && <Descriptions.Item label="Notes" span={2}>{mbr.notes}</Descriptions.Item>}
        </Descriptions>
      ),
    },
    {
      key: 'materials',
      label: `Materials (${mbr.materials.length})`,
      children: (
        <Table dataSource={mbr.materials} columns={materialCols} rowKey={(r, i) => r.id || String(i)} size="small" pagination={false} />
      ),
    },
    {
      key: 'equipment',
      label: `Equipment (${mbr.equipment.length})`,
      children: (
        <Table dataSource={mbr.equipment} columns={equipCols} rowKey={(r, i) => r.id || String(i)} size="small" pagination={false} />
      ),
    },
    {
      key: 'steps',
      label: `Manufacturing Steps (${mbr.steps.length})`,
      children: mbr.steps.length === 0
        ? <Text type="secondary">No manufacturing steps defined</Text>
        : <Collapse items={stepPanels} />,
    },
  ];

  const isPending = approveMutation.isPending || rejectMutation.isPending || submitMutation.isPending;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Space direction="vertical" size={4}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/mbr')}>Back</Button>
          </Space>
          <Space align="center">
            <Title level={4} style={{ margin: 0 }}>{mbr.mbr_number} — {mbr.title}</Title>
            <Tag>v{mbr.version}</Tag>
            <Badge status={statusCfg.color as any} text={statusCfg.label} />
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {mbr.product_name} · {mbr.product_code} {mbr.strength && `· ${mbr.strength}`}
          </Text>
        </Space>

        <Space wrap>
          {hasPermission('mbr:update') && mbr.status === 'DRAFT' && (
            <Button icon={<EditOutlined />} onClick={() => navigate(`/mbr/${id}/edit`)}>Edit</Button>
          )}
          {hasPermission('mbr:update') && mbr.status === 'DRAFT' && (
            <Button icon={<SendOutlined />} type="primary" ghost onClick={() => setSignConfig({
              action: 'submit', actionLabel: 'Submit & Sign',
              meanings: ['Submitted for Review — Author Confirmation'],
            })}>
              Submit for Review
            </Button>
          )}
          {hasPermission('mbr:approve') && mbr.status === 'UNDER_REVIEW' && (
            <>
              <Button icon={<CloseOutlined />} danger onClick={() => setSignConfig({
                action: 'reject', actionLabel: 'Reject & Sign',
                meanings: ['Rejected — Revisions Required', 'Rejected — Does Not Meet Requirements'],
                isDanger: true, requireComments: true,
              })}>Reject</Button>
              <Button icon={<SafetyOutlined />} type="primary" onClick={() => setSignConfig({
                action: 'approve', actionLabel: 'Approve & Sign',
                meanings: ['Approved for Production', 'Reviewed and Approved by QA', 'Approved — Meets All Requirements'],
              })}>Approve</Button>
            </>
          )}
          {hasPermission('mbr:create') && (mbr.status === 'APPROVED' || mbr.status === 'EFFECTIVE') && (
            <Popconfirm title="Create new version?" onConfirm={() => newVersionMutation.mutate()}>
              <Button icon={<CopyOutlined />}>New Version</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {mbr.status === 'UNDER_REVIEW' && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          message="This MBR is pending review and approval before it can be used for batch execution."
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs items={tabItems} style={{ padding: '0 24px' }} />
      </Card>

      {/* E-Signature Modal */}
      {signConfig && mbr && (
        <ESignatureModal
          open={!!signConfig}
          onClose={() => setSignConfig(null)}
          onSuccess={handleSignSuccess}
          resourceType="mbr"
          resourceId={id!}
          resourceLabel={`${mbr.mbr_number} v${mbr.version} — ${mbr.product_name}`}
          action={signConfig.action}
          actionLabel={signConfig.actionLabel}
          meanings={signConfig.meanings}
          isDanger={signConfig.isDanger}
          requireComments={signConfig.requireComments}
        />
      )}

      {/* Signature History */}
      {id && <SignatureList resourceType="mbr" resourceId={id} />}
    </div>
  );
}
