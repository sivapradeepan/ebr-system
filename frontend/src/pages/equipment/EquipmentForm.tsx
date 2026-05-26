import {
  Form, Input, Select, Button, Card, Typography, Space,
  Alert, DatePicker, InputNumber, Divider, Row, Col,
} from 'antd';
import { ToolOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentApi } from '../../api/equipment';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CATEGORIES = [
  'Mixer', 'Granulator', 'Tablet Press', 'Coating Machine', 'Capsule Filler',
  'Blender', 'Dryer', 'Mill', 'Sifter', 'Balance', 'HPLC', 'Autoclave',
  'Freeze Dryer', 'Filling Machine', 'Packaging Machine', 'Other',
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE',            label: 'Active' },
  { value: 'INACTIVE',          label: 'Inactive' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'CALIBRATION_DUE',   label: 'Calibration Due' },
  { value: 'RETIRED',           label: 'Retired' },
];

export default function EquipmentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { isLoading: loadingData } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.get(id!),
    enabled: isEdit,
    onSuccess: (data: any) => {
      form.setFieldsValue({
        ...data,
        last_calibration_date: data.last_calibration_date ? dayjs(data.last_calibration_date) : null,
        calibration_due_date:  data.calibration_due_date  ? dayjs(data.calibration_due_date)  : null,
        last_maintenance_date: data.last_maintenance_date ? dayjs(data.last_maintenance_date) : null,
        next_maintenance_date: data.next_maintenance_date ? dayjs(data.next_maintenance_date) : null,
      });
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: (values: any) => {
      const payload = {
        ...values,
        last_calibration_date: values.last_calibration_date?.format('YYYY-MM-DD') ?? null,
        calibration_due_date:  values.calibration_due_date?.format('YYYY-MM-DD')  ?? null,
        last_maintenance_date: values.last_maintenance_date?.format('YYYY-MM-DD') ?? null,
        next_maintenance_date: values.next_maintenance_date?.format('YYYY-MM-DD') ?? null,
      };
      return isEdit ? equipmentApi.update(id!, payload) : equipmentApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      navigate('/equipment');
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/equipment')}>Back</Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <ToolOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8, display: 'block' }} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Edit Equipment' : 'Register New Equipment'}</Title>
        <Text type="secondary">Track calibration, maintenance, and operational status</Text>
      </div>

      {saveMutation.isError && (
        <Alert
          type="error"
          message={(saveMutation.error as any)?.response?.data?.detail || 'Save failed'}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)}
        initialValues={{ status: 'ACTIVE' }}>

        <Card title="Basic Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item name="name" label="Equipment Name"
                rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g. High Shear Granulator #1" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="Category"
                rules={[{ required: true, message: 'Category is required' }]}>
                <Select
                  showSearch
                  placeholder="Select category"
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="location" label="Location">
                <Input placeholder="e.g. Production Area B, Room 204" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="manufacturer" label="Manufacturer">
                <Input placeholder="e.g. GEA Group" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="model_number" label="Model Number">
                <Input placeholder="e.g. PMA-65" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="serial_number" label="Serial Number">
                <Input placeholder="e.g. SN-2021-00483" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Calibration" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="last_calibration_date" label="Last Calibration Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="calibration_due_date" label="Calibration Due Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="calibration_certificate" label="Certificate Number">
                <Input placeholder="e.g. CAL-2024-0193" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Maintenance" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="last_maintenance_date" label="Last Maintenance Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="next_maintenance_date" label="Next Maintenance Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="maintenance_interval_days" label="Maintenance Interval (days)">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 180" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Notes" style={{ marginBottom: 24 }}>
          <Form.Item name="notes" noStyle>
            <Input.TextArea rows={3} placeholder="Any additional notes, qualifications, or special handling requirements..." />
          </Form.Item>
        </Card>

        <Space>
          <Button onClick={() => navigate('/equipment')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} icon={<SaveOutlined />}>
            {isEdit ? 'Save Changes' : 'Register Equipment'}
          </Button>
        </Space>
      </Form>
    </div>
  );
}
