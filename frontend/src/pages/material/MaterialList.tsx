import {
  Card, Table, Button, Space, Input, Select, Typography,
  Badge, Tooltip, Popconfirm, message, Tag, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialApi } from '../../api/equipment';
import { useAuthStore } from '../../store/authStore';
import type { Material, MaterialType, MaterialStatus } from '../../types/equipment';

const { Title } = Typography;

const TYPE_COLOR: Record<MaterialType, string> = {
  API:        'purple',
  EXCIPIENT:  'blue',
  PACKAGING:  'cyan',
  SOLVENT:    'orange',
  REAGENT:    'gold',
  OTHER:      'default',
};

const STATUS_CFG: Record<MaterialStatus, { color: string; label: string }> = {
  ACTIVE:       { color: 'success', label: 'Active' },
  INACTIVE:     { color: 'default', label: 'Inactive' },
  DISCONTINUED: { color: 'error',   label: 'Discontinued' },
};

export default function MaterialList() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['materials', page, search, typeFilter, statusFilter],
    queryFn: () => materialApi.list({
      page, size: 20,
      search: search || undefined,
      material_type: typeFilter,
      status: statusFilter,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: materialApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      message.success('Material deleted');
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Cannot delete'),
  });

  const columns = [
    {
      title: 'Material',
      key: 'material',
      render: (_: any, r: Material) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
          <Space size={4}>
            <Tag style={{ fontSize: 10 }}>{r.material_code}</Tag>
            <Tag color={TYPE_COLOR[r.material_type]} style={{ fontSize: 10 }}>{r.material_type}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Identification',
      key: 'ident',
      render: (_: any, r: Material) => (
        <Space direction="vertical" size={0}>
          {r.cas_number && <span style={{ fontSize: 12, fontFamily: 'monospace' }}>CAS: {r.cas_number}</span>}
          {r.pharmacopoeia_standard && <span style={{ fontSize: 12, color: '#888' }}>{r.pharmacopoeia_standard}</span>}
          {r.grade && <Tag style={{ fontSize: 10 }}>{r.grade}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_: any, r: Material) => (
        <Space direction="vertical" size={0}>
          <span>{r.supplier_name || '—'}</span>
          {r.supplier_code && <span style={{ fontSize: 12, color: '#888' }}>{r.supplier_code}</span>}
        </Space>
      ),
    },
    { title: 'UOM', dataIndex: 'unit_of_measure', key: 'uom' },
    {
      title: 'Shelf Life',
      key: 'shelf',
      render: (_: any, r: Material) => r.shelf_life_days
        ? `${r.shelf_life_days} days`
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Storage',
      dataIndex: 'storage_conditions',
      key: 'storage',
      render: (v: string) => v
        ? <Tooltip title={v}><span style={{ fontSize: 12, color: '#666' }}>{v.slice(0, 30)}{v.length > 30 ? '…' : ''}</span></Tooltip>
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: MaterialStatus) => (
        <Badge status={STATUS_CFG[v].color as any} text={STATUS_CFG[v].label} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: Material) => (
        <Space>
          {hasPermission('materials:manage') && (
            <>
              <Tooltip title="Edit">
                <Button icon={<EditOutlined />} size="small"
                  onClick={() => navigate(`/materials/${r.id}/edit`)} />
              </Tooltip>
              <Popconfirm
                title="Delete this material?"
                onConfirm={() => deleteMutation.mutate(r.id)}
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete">
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <MedicineBoxOutlined style={{ marginRight: 8 }} />Materials Catalog
          </Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Raw materials, APIs, excipients, and packaging components
          </Typography.Text>
        </div>
        {hasPermission('materials:manage') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/materials/new')}>
            Add Material
          </Button>
        )}
      </div>

      <Card>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col>
            <Input
              placeholder="Search name, code, supplier, CAS..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 300 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Filter by type"
              style={{ width: 160 }}
              allowClear
              onChange={v => { setTypeFilter(v); setPage(1); }}
              options={[
                { value: 'API',       label: 'API' },
                { value: 'EXCIPIENT', label: 'Excipient' },
                { value: 'PACKAGING', label: 'Packaging' },
                { value: 'SOLVENT',   label: 'Solvent' },
                { value: 'REAGENT',   label: 'Reagent' },
                { value: 'OTHER',     label: 'Other' },
              ]}
            />
          </Col>
          <Col>
            <Select
              placeholder="Filter by status"
              style={{ width: 160 }}
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
            current: page,
            pageSize: 20,
            total: data?.total,
            onChange: setPage,
            showTotal: t => `${t} materials`,
          }}
        />
      </Card>
    </div>
  );
}
