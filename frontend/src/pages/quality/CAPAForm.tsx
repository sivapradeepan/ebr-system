import {
  Form, Input, Select, Button, Card, Typography, Space, Alert, DatePicker, Row, Col,
} from 'antd';
import { FileSearchOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { capaApi, deviationApi } from '../../api/quality';

const { Title, Text } = Typography;

export default function CAPAForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const preselectedDeviationId = searchParams.get('deviation_id');

  // Load open deviations for selection
  const { data: devData } = useQuery({
    queryKey: ['deviations', 'open-for-capa'],
    queryFn: () => deviationApi.list({ size: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (v: any) => capaApi.create({
      ...v,
      due_date: v.due_date ? v.due_date.format('YYYY-MM-DD') : null,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      navigate(`/quality/capas/${data.id}`);
    },
  });

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/quality')}>Back</Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <FileSearchOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8, display: 'block' }} />
        <Title level={4} style={{ margin: 0 }}>Create New CAPA</Title>
        <Text type="secondary">Define a corrective or preventive action linked to a deviation</Text>
      </div>

      {createMutation.isError && (
        <Alert type="error"
          message={(createMutation.error as any)?.response?.data?.detail || 'Failed to create CAPA'}
          style={{ marginBottom: 16 }} showIcon />
      )}

      <Form form={form} layout="vertical" onFinish={v => createMutation.mutate(v)}
        initialValues={{ deviation_id: preselectedDeviationId || undefined }}>

        <Card title="Linked Deviation" style={{ marginBottom: 16 }}>
          <Form.Item name="deviation_id" label="Deviation"
            rules={[{ required: true, message: 'Select a linked deviation' }]}>
            <Select
              showSearch
              placeholder="Select the deviation this CAPA addresses..."
              optionFilterProp="label"
              options={(devData?.items || [])
                .filter(d => d.status !== 'CLOSED')
                .map(d => ({
                  value: d.id,
                  label: `${d.deviation_number} — ${d.title}`,
                }))}
            />
          </Form.Item>
        </Card>

        <Card title="CAPA Details" style={{ marginBottom: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Update SOP-MFG-012 to include revised mixing time limits" />
          </Form.Item>
          <Form.Item name="capa_type" label="CAPA Type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'CORRECTIVE', label: 'Corrective Action — Fix the existing problem' },
              { value: 'PREVENTIVE', label: 'Preventive Action — Prevent recurrence' },
              { value: 'BOTH',       label: 'Both Corrective and Preventive' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={4}
              placeholder="Describe in detail what actions will be taken, by whom, and how effectiveness will be measured..." />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Space>
          <Button onClick={() => navigate('/quality')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending} icon={<SaveOutlined />}>
            Create CAPA
          </Button>
        </Space>
      </Form>
    </div>
  );
}
