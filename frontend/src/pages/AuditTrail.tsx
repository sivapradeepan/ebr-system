import {
  Card, Table, Select, Input, DatePicker, Space, Tag, Typography,
  Tooltip, Modal, Descriptions, Badge, Row, Col, Button,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/audit';
import type { AuditLog } from '../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'green', LOGOUT: 'default', LOGIN_FAILED: 'red', ACCOUNT_LOCKED: 'red',
  CREATE: 'blue', UPDATE: 'orange', DELETE: 'red',
  APPROVE: 'green', REJECT: 'red', SIGN: 'purple',
  VIEW: 'default', PRINT: 'cyan', EXPORT: 'cyan', PASSWORD_CHANGE: 'orange',
};

const ACTIONS = Object.keys(ACTION_COLORS);

export default function AuditTrail() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, filters],
    queryFn: () => auditApi.list({ page, size: 50, ...filters }),
  });

  const setFilter = (key: string, value: any) => {
    setFilters(f => value != null ? { ...f, [key]: value } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));
    setPage(1);
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 175,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleString()}</Text>,
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => v
        ? <Tag>{v}</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>System</Text>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Resource',
      key: 'resource',
      render: (_: any, r: AuditLog) => r.resource_type
        ? <Text style={{ fontSize: 13 }}>{r.resource_type}{r.resource_id ? ` · ${r.resource_id.slice(0, 8)}…` : ''}</Text>
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Badge status={v === 'SUCCESS' ? 'success' : 'error'} text={v} />,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: '',
      key: 'view',
      width: 50,
      render: (_: any, record: AuditLog) => (
        <Tooltip title="View details">
          <Button icon={<EyeOutlined />} size="small" onClick={() => setDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Audit Trail</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Immutable event log — compliant with 21 CFR Part 11 &amp; EU Annex 11
        </Text>
      </div>

      <Card>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col>
            <Input
              placeholder="Search username..."
              prefix={<SearchOutlined />}
              onChange={e => setFilter('username', e.target.value || undefined)}
              style={{ width: 200 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Action"
              style={{ width: 170 }}
              allowClear
              onChange={v => setFilter('action', v)}
              options={ACTIONS.map(a => ({ value: a, label: a }))}
            />
          </Col>
          <Col>
            <Select
              placeholder="Resource type"
              style={{ width: 160 }}
              allowClear
              onChange={v => setFilter('resource_type', v)}
              options={['user', 'role', 'batch_record', 'equipment', 'material'].map(t => ({ value: t, label: t }))}
            />
          </Col>
          <Col>
            <RangePicker
              showTime
              style={{ width: 380 }}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilter('start_date', dates[0].toISOString());
                  setFilter('end_date', dates[1].toISOString());
                } else {
                  setFilter('start_date', undefined);
                  setFilter('end_date', undefined);
                }
              }}
            />
          </Col>
        </Row>

        <Table
          dataSource={data?.items}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 50,
            total: data?.total,
            onChange: setPage,
            showTotal: total => `${total} log entries`,
          }}
        />
      </Card>

      <Modal
        title="Audit Log Detail"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={660}
      >
        {detail && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="ID"><Text code style={{ fontSize: 12 }}>{detail.id}</Text></Descriptions.Item>
            <Descriptions.Item label="Timestamp">{new Date(detail.timestamp).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="User">{detail.username ?? 'System'}</Descriptions.Item>
            <Descriptions.Item label="Action"><Tag color={ACTION_COLORS[detail.action]}>{detail.action}</Tag></Descriptions.Item>
            <Descriptions.Item label="Resource">{detail.resource_type} {detail.resource_id ?? ''}</Descriptions.Item>
            <Descriptions.Item label="Description">{detail.description ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="IP Address">{detail.ip_address ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge status={detail.status === 'SUCCESS' ? 'success' : 'error'} text={detail.status} />
            </Descriptions.Item>
            {detail.old_value != null && (
              <Descriptions.Item label="Previous Value">
                <pre style={{ fontSize: 11, margin: 0, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(detail.old_value, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {detail.new_value != null && (
              <Descriptions.Item label="New Value">
                <pre style={{ fontSize: 11, margin: 0, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(detail.new_value, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
