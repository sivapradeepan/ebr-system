/**
 * Displays all electronic signatures recorded against a resource.
 * Used in MBR, EBR, Deviation, and CAPA detail pages.
 */
import { Card, Table, Tag, Tooltip, Typography } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { esignatureApi } from '../api/esignature';
import type { ESignature } from '../types/esignature';

const { Text } = Typography;

const ACTION_COLOR: Record<string, string> = {
  submit:  'blue',
  approve: 'success',
  reject:  'error',
  close:   'default',
};

interface Props {
  resourceType: string;
  resourceId: string;
}

export default function SignatureList({ resourceType, resourceId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['esignatures', resourceType, resourceId],
    queryFn: () => esignatureApi.list({ resource_type: resourceType, resource_id: resourceId }),
    enabled: !!resourceId,
  });

  if (!isLoading && (!data || data.total === 0)) return null;

  const columns = [
    {
      title: 'Signature #',
      dataIndex: 'signature_number',
      key: 'number',
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Signatory',
      key: 'signer',
      render: (_: any, r: ESignature) => (
        <span>
          <Text strong>{r.signer_full_name}</Text>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({r.signer_username})</Text>
        </span>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color={ACTION_COLOR[v] || 'default'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Meaning / Intent',
      dataIndex: 'meaning',
      key: 'meaning',
      render: (v: string, r: ESignature) => (
        <Tooltip title={r.comments ? `Comments: ${r.comments}` : undefined}>
          <span>{v}</span>
          {r.comments && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {r.comments.slice(0, 60)}{r.comments.length > 60 ? '…' : ''}
          </Text>}
        </Tooltip>
      ),
    },
    {
      title: 'Date / Time (UTC)',
      dataIndex: 'signed_at',
      key: 'date',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Card
      title={<span><SafetyOutlined style={{ marginRight: 6, color: '#1677ff' }} />Electronic Signatures</span>}
      size="small"
      style={{ marginTop: 16 }}
    >
      <Table
        dataSource={data?.items}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="small"
      />
    </Card>
  );
}
