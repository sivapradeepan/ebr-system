import {
  Card, Table, Button, Space, Input, Select, Typography,
  Badge, Tooltip, Popconfirm, message, Progress, Tag, Row, Col,
} from 'antd';
import { PlusOutlined, PlayCircleOutlined, EyeOutlined, DeleteOutlined, SearchOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ebrApi } from '../../api/ebr';
import { reportsApi, triggerDownload } from '../../api/reports';
import { useAuthStore } from '../../store/authStore';
import type { EBRSummary, EBRStatus } from '../../types/ebr';

const { Title } = Typography;

const STATUS_CFG: Record<EBRStatus, { color: string; label: string }> = {
  INITIATED:    { color: 'default',    label: 'Initiated' },
  IN_PROGRESS:  { color: 'processing', label: 'In Progress' },
  COMPLETED:    { color: 'warning',    label: 'Completed' },
  UNDER_REVIEW: { color: 'warning',    label: 'Under Review' },
  APPROVED:     { color: 'success',    label: 'Released' },
  REJECTED:     { color: 'error',      label: 'Rejected' },
};

export default function EBRList() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (id: string, batchNumber: string) => {
    setDownloadingId(id);
    try {
      const blob = await reportsApi.downloadEbrPdf(id);
      triggerDownload(blob, `EBR_${batchNumber}.pdf`);
    } catch { message.error('Failed to generate PDF'); }
    finally { setDownloadingId(null); }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ebr', page, search, statusFilter],
    queryFn: () => ebrApi.list({ page, size: 20, search: search || undefined, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: ebrApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ebr'] }); message.success('Batch record deleted'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Cannot delete'),
  });

  const columns = [
    {
      title: 'Batch / EBR',
      key: 'batch',
      render: (_: any, r: EBRSummary) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, fontWeight: 700, height: 'auto', fontSize: 14 }}
            onClick={() => navigate(`/ebr/${r.id}`)}>
            {r.batch_number}
          </Button>
          <Tag style={{ fontSize: 10 }}>{r.ebr_number}</Tag>
        </Space>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: EBRSummary) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.product_name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{r.product_code}{r.strength && ` · ${r.strength}`}</span>
        </Space>
      ),
    },
    { title: 'MBR', key: 'mbr', render: (_: any, r: EBRSummary) => `${r.mbr_number} v${r.mbr_version}` },
    {
      title: 'Batch Size',
      key: 'size',
      render: (_: any, r: EBRSummary) => r.planned_batch_size ? `${r.planned_batch_size} ${r.batch_unit || ''}` : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: EBRStatus) => <Badge status={STATUS_CFG[v].color as any} text={STATUS_CFG[v].label} />,
    },
    {
      title: 'Yield',
      key: 'yield',
      render: (_: any, r: EBRSummary) => r.yield_percentage != null ? (
        <Space>
          <Progress
            percent={Math.min(r.yield_percentage, 100)}
            size="small"
            style={{ width: 80 }}
            status={r.yield_percentage >= 98 ? 'success' : r.yield_percentage >= 90 ? 'normal' : 'exception'}
          />
          <span style={{ fontSize: 12 }}>{r.yield_percentage.toFixed(1)}%</span>
        </Space>
      ) : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Initiated By',
      key: 'by',
      render: (_: any, r: EBRSummary) => r.initiated_by.full_name,
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'date',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: EBRSummary) => (
        <Space>
          {(r.status === 'INITIATED' || r.status === 'IN_PROGRESS') && hasPermission('ebr:execute') ? (
            <Tooltip title="Execute Batch">
              <Button icon={<PlayCircleOutlined />} size="small" type="primary"
                onClick={() => navigate(`/ebr/${r.id}/execute`)} />
            </Tooltip>
          ) : (
            <Tooltip title="View Record">
              <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/ebr/${r.id}`)} />
            </Tooltip>
          )}
          <Tooltip title="Download Batch Record PDF">
            <Button
              icon={<FilePdfOutlined />}
              size="small"
              loading={downloadingId === r.id}
              onClick={() => handleDownloadPdf(r.id, r.batch_number)}
            />
          </Tooltip>
          {r.status === 'INITIATED' && hasPermission('ebr:create') && (
            <Popconfirm title="Delete this batch record?" onConfirm={() => deleteMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Tooltip title="Delete"><Button icon={<DeleteOutlined />} size="small" danger /></Tooltip>
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
          <Title level={4} style={{ margin: 0 }}>Batch Execution Records</Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Executed batch records linked to approved MBRs</Typography.Text>
        </div>
        {hasPermission('ebr:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ebr/new')}>
            Initiate Batch
          </Button>
        )}
      </div>

      <Card>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col>
            <Input placeholder="Search batch number, product, EBR..."
              prefix={<SearchOutlined />} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 300 }} allowClear />
          </Col>
          <Col>
            <Select placeholder="Filter by status" style={{ width: 180 }} allowClear
              onChange={v => { setStatusFilter(v); setPage(1); }}
              options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))} />
          </Col>
        </Row>
        <Table dataSource={data?.items} columns={columns} rowKey="id" loading={isLoading}
          pagination={{ current: page, pageSize: 20, total: data?.total, onChange: setPage, showTotal: t => `${t} batches` }} />
      </Card>
    </div>
  );
}
