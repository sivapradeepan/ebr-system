import {
  Form, Input, Select, Button, Card, Typography, Space, Alert, Row, Col,
} from 'antd';
import { WarningOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deviationApi } from '../../api/quality';

const { Title, Text } = Typography;

export default function DeviationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const createMutation = useMutation({
    mutationFn: (v: any) => deviationApi.create(v),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deviations'] });
      navigate(`/quality/deviations/${data.id}`);
    },
  });

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/quality')}>Back</Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <WarningOutlined style={{ fontSize: 40, color: '#faad14', marginBottom: 8, display: 'block' }} />
        <Title level={4} style={{ margin: 0 }}>Raise New Deviation</Title>
        <Text type="secondary">Document a deviation from expected process, material, or equipment standards</Text>
      </div>

      {createMutation.isError && (
        <Alert type="error"
          message={(createMutation.error as any)?.response?.data?.detail || 'Failed to create'}
          style={{ marginBottom: 16 }} showIcon />
      )}

      <Form form={form} layout="vertical" onFinish={v => createMutation.mutate(v)}>
        <Card title="Classification" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="deviation_type" label="Deviation Type"
                rules={[{ required: true, message: 'Type is required' }]}>
                <Select placeholder="Select type" options={[
                  { value: 'PROCESS',       label: 'Process Deviation' },
                  { value: 'EQUIPMENT',     label: 'Equipment Deviation' },
                  { value: 'MATERIAL',      label: 'Material Deviation' },
                  { value: 'ENVIRONMENTAL', label: 'Environmental Deviation' },
                  { value: 'DOCUMENTATION', label: 'Documentation Deviation' },
                  { value: 'OTHER',         label: 'Other' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="severity" label="Severity"
                rules={[{ required: true, message: 'Severity is required' }]}>
                <Select placeholder="Select severity" options={[
                  { value: 'CRITICAL', label: 'Critical — Potential patient safety impact' },
                  { value: 'MAJOR',    label: 'Major — Significant process impact' },
                  { value: 'MINOR',    label: 'Minor — Limited impact' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Deviation Details" style={{ marginBottom: 16 }}>
          <Form.Item name="title" label="Title"
            rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Brief description of the deviation..." />
          </Form.Item>
          <Form.Item name="description" label="Full Description"
            rules={[{ required: true, message: 'Description is required' }]}>
            <Input.TextArea rows={4}
              placeholder="Describe in detail what happened, when, and where. Include observed values vs. expected values." />
          </Form.Item>
          <Form.Item name="immediate_action" label="Immediate Action Taken (optional)">
            <Input.TextArea rows={2}
              placeholder="Describe any immediate containment actions already taken..." />
          </Form.Item>
        </Card>

        <Card title="Batch Linkage (optional)" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="batch_number" label="Batch Number"
                extra="Link this deviation to a specific batch">
                <Input placeholder="e.g. BN-2026-0001" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="product_name" label="Product Name">
                <Input placeholder="e.g. Amoxicillin 500mg Capsules" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Space>
          <Button onClick={() => navigate('/quality')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending} icon={<SaveOutlined />}>
            Raise Deviation
          </Button>
        </Space>
      </Form>
    </div>
  );
}
