import {
  Form, Input, Select, Button, Card, Typography, Space,
  Alert, InputNumber, Row, Col,
} from 'antd';
import { MedicineBoxOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialApi } from '../../api/equipment';

const { Title, Text } = Typography;

const TYPE_OPTIONS = [
  { value: 'API',       label: 'Active Pharmaceutical Ingredient (API)' },
  { value: 'EXCIPIENT', label: 'Excipient' },
  { value: 'PACKAGING', label: 'Packaging Material' },
  { value: 'SOLVENT',   label: 'Solvent' },
  { value: 'REAGENT',   label: 'Reagent' },
  { value: 'OTHER',     label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE',       label: 'Active' },
  { value: 'INACTIVE',     label: 'Inactive' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const PHARMACOPOEIA_OPTIONS = [
  'USP/NF', 'EP', 'BP', 'JP', 'IP', 'ChP', 'In-House', 'Other',
];

const GRADE_OPTIONS = [
  'Pharmaceutical', 'Analytical', 'Reagent', 'Food Grade', 'Industrial',
];

const UOM_OPTIONS = [
  'kg', 'g', 'mg', 'L', 'mL', 'units', 'tablets', 'capsules', 'vials', 'ampoules', 'sheets', 'rolls',
];

export default function MaterialForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  useQuery({
    queryKey: ['material', id],
    queryFn: () => materialApi.get(id!),
    enabled: isEdit,
    onSuccess: (data: any) => form.setFieldsValue(data),
  } as any);

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      isEdit ? materialApi.update(id!, values) : materialApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      navigate('/materials');
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/materials')}>Back</Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <MedicineBoxOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8, display: 'block' }} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Edit Material' : 'Add New Material'}</Title>
        <Text type="secondary">Define material specifications, supplier info, and storage requirements</Text>
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
        initialValues={{ status: 'ACTIVE', material_type: 'EXCIPIENT' }}>

        <Card title="Basic Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item name="name" label="Material Name"
                rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g. Microcrystalline Cellulose PH-102" />
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
              <Form.Item name="material_type" label="Material Type"
                rules={[{ required: true, message: 'Type is required' }]}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="unit_of_measure" label="Unit of Measure"
                rules={[{ required: true, message: 'UOM is required' }]}>
                <Select
                  showSearch
                  placeholder="Select unit"
                  options={UOM_OPTIONS.map(u => ({ value: u, label: u }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Identification & Quality Standard" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="cas_number" label="CAS Number"
                extra="For APIs and chemical ingredients">
                <Input placeholder="e.g. 9004-34-6" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="pharmacopoeia_standard" label="Pharmacopoeia Standard">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select standard"
                  options={PHARMACOPOEIA_OPTIONS.map(p => ({ value: p, label: p }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="grade" label="Grade">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select grade"
                  options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Supplier Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="supplier_name" label="Supplier Name">
                <Input placeholder="e.g. FMC Corporation" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="supplier_code" label="Supplier Code">
                <Input placeholder="e.g. SUP-FMC-001" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="manufacturer_name" label="Manufacturer">
                <Input placeholder="If different from supplier" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Storage & Handling" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="shelf_life_days" label="Shelf Life (days)">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 730" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="reorder_point" label="Reorder Point">
                <Input placeholder="e.g. 50 kg" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="storage_conditions" label="Storage Conditions">
            <Input.TextArea rows={2}
              placeholder="e.g. Store in a cool, dry place. Keep away from moisture. Temperature: 15-25°C, RH < 60%." />
          </Form.Item>
        </Card>

        <Card title="Notes" style={{ marginBottom: 24 }}>
          <Form.Item name="notes" noStyle>
            <Input.TextArea rows={3}
              placeholder="Additional specifications, handling precautions, regulatory notes..." />
          </Form.Item>
        </Card>

        <Space>
          <Button onClick={() => navigate('/materials')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} icon={<SaveOutlined />}>
            {isEdit ? 'Save Changes' : 'Add Material'}
          </Button>
        </Space>
      </Form>
    </div>
  );
}
