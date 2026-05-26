import {
  Card, Table, Button, Space, Tag, Input, Select, Typography,
  Popconfirm, message, Tooltip, Badge, Modal, Form, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, CopyOutlined, SendOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mbrApi } from '../../api/mbr';
import { useAuthStore } from '../../store/authStore';
import type { MBRSummary, MBRStatus } from '../../types/mbr';

const { Title } = Typography;

const STATUS_CONFIG: Record<MBRStatus, { color: string; label: string }> = {
  DRAFT:        { color: 'default',   label: 'Draft' },
  UNDER_REVIEW: { color: 'processing', label: 'Under Review' },
  APPROVED:     { color: 'success',   label: 'Approved' },
  EFFECTIVE:    { color: 'green',     label: 'Effective' },
  SUPERSEDED:   { color: 'orange',    label: 'Superseded' },
  OBSOLETE:     { color: 'red',       label: 'Obsolete' },
};

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Cream', 'Ointment', 'Powder', 'Gel', 'Patch', 'Other'];

export default function MBRList() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [submitModal, setSubmitModal] = useState<{ id: string; number: string } | null>(null);
  const [submitForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['mbr', page, search, statusFilter],
    queryFn: () => mbrApi.list({ page, size: 20, search: search || undefined, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: mbrApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mbr'] }); message.success('MBR deleted'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Cannot delete MBR'),
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) => mbrApi.submit(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mbr'] });
      message.success('MBR submitted for review');
      setSubmitModal(null);
      submitForm.resetFields();
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to submit'),
  });

  const newVersionMutation = useMutation({
    mutationFn: mbrApi.newVersion,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mbr'] });
      message.success(`New version ${data.mbr_number} v${data.version} created`);
      navigate(`/mbr/${data.id}/edit`);
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to create new version'),
  });

  const columns = [
    {
      title: 'MBR Number',
      key: 'mbr_number',
      render: (_: any, r: MBRSummary) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, fontWeight: 600, height: 'auto' }}
            onClick={() => navigate(`/mbr/${r.id}`)}>
            {r.mbr_number}
          </Button>
          <Tag style={{ fontSize: 10 }}>v{r.version}</Tag>
        </Space>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: MBRSummary) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.product_name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{r.product_code} {r.strength && `· ${r.strength}`}</span>
        </Space>
      ),
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Batch Size',
      key: 'batch',
      render: (_: any, r: MBRSummary) => r.batch_size
        ? `${r.batch_size} ${r.batch_unit || ''}`
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: MBRStatus) => {
        const cfg = STATUS_CONFIG[v];
        return <Badge status={cfg.color as any} text={cfg.label} />;
      },
    },
    {
      title: 'Created By',
      key: 'created_by',
      render: (_: any, r: MBRSummary) => r.created_by.full_name,
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: MBRSummary) => (
        <Space>
          <Tooltip title="View">
            <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/mbr/${r.id}`)} />
          </Tooltip>
          {hasPermission('mbr:update') && r.status === 'DRAFT' && (
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" onClick={() => navigate(`/mbr/${r.id}/edit`)} />
            </Tooltip>
          )}
          {hasPermission('mbr:update') && r.status === 'DRAFT' && (
            <Tooltip title="Submit for Review">
              <Button icon={<SendOutlined />} size="small" type="primary" ghost
                onClick={() => setSubmitModal({ id: r.id, number: r.mbr_number })} />
            </Tooltip>
          )}
          {hasPermission('mbr:create') && (r.status === 'APPROVED' || r.status === 'EFFECTIVE') && (
            <Tooltip title="Create New Version">
              <Popconfirm
                title="Create a new version?"
                description="A new DRAFT will be created based on this MBR."
                onConfirm={() => newVersionMutation.mutate(r.id)}
              >
                <Button icon={<CopyOutlined />} size="small" />
              </Popconfirm>
            </Tooltip>
          )}
          {hasPermission('mbr:delete') && r.status === 'DRAFT' && (
            <Popconfirm
              title="Delete this MBR?"
              description="This cannot be undone."
              onConfirm={() => deleteMutation.mutate(r.id)}
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Master Batch Records</Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Versioned manufacturing templates
          </Typography.Text>
        </div>
        {hasPermission('mbr:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/mbr/new')}>
            New MBR
          </Button>
        )}
      </div>

      <Card>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col>
            <Input
              placeholder="Search MBR number, product, title..."
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
              options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </Col>
        </Row>

        <Table
          dataSource={data?.items}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total,
            onChange: setPage,
            showTotal: total => `${total} MBRs`,
          }}
        />
      </Card>

      {/* Submit for Review Modal */}
      <Modal
        title={`Submit MBR ${submitModal?.number} for Review`}
        open={!!submitModal}
        onCancel={() => { setSubmitModal(null); submitForm.resetFields(); }}
        onOk={() => submitForm.submit()}
        confirmLoading={submitMutation.isPending}
      >
        <Form form={submitForm} layout="vertical" style={{ marginTop: 16 }}
          onFinish={v => submitModal && submitMutation.mutate({ id: submitModal.id, comments: v.comments })}>
          <Form.Item name="comments" label="Comments (optional)">
            <Input.TextArea rows={3} placeholder="Add any notes for the reviewer..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
