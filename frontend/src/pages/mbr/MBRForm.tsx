import {
  Form, Input, InputNumber, Select, Button, Tabs, Card, Table, Space,
  Switch, Typography, Collapse, Modal, Divider, Row, Col, message, Tag,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ExperimentOutlined, ToolOutlined, MedicineBoxOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mbrApi } from '../../api/mbr';
import type {
  MBRMaterial, MBREquipment, MBRStep, MBRStepParameter, MBRStepIPQC,
} from '../../types/mbr';

const { Title, Text } = Typography;

const UNITS = ['kg', 'g', 'mg', 'L', 'mL', 'units', 'tablets', 'capsules'];
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Cream', 'Ointment', 'Powder', 'Gel', 'Patch', 'Other'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const newMaterial = (): Omit<MBRMaterial, 'id' | 'order'> => ({
  material_name: '', material_code: '', quantity: 0, unit: 'kg',
  grade: '', is_active_ingredient: false, supplier: '', notes: '',
});

const newEquipment = (): Omit<MBREquipment, 'id' | 'order'> => ({
  equipment_name: '', equipment_code: '', capacity: '', notes: '',
});

const newStep = (n: number): Omit<MBRStep, 'id' | 'order'> => ({
  step_number: n, title: '', description: '', expected_duration_minutes: undefined,
  expected_yield: undefined, yield_unit: '', is_critical: false, notes: '',
  parameters: [], ipqcs: [],
});

const newParam = (): MBRStepParameter => ({
  name: '', unit: '', target_value: '', min_value: '', max_value: '', is_critical: false, notes: '',
});

const newIPQC = (): MBRStepIPQC => ({
  test_name: '', method: '', acceptance_criteria: '', frequency: '', responsible_role: '', notes: '',
});

// ── Sub-editors ──────────────────────────────────────────────────────────────
function ParametersEditor({ params, onChange }: {
  params: MBRStepParameter[];
  onChange: (p: MBRStepParameter[]) => void;
}) {
  const update = (i: number, field: keyof MBRStepParameter, val: any) => {
    const next = [...params];
    (next[i] as any)[field] = val;
    onChange(next);
  };

  const cols = [
    { title: 'Parameter Name *', key: 'name', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={params[i].name} onChange={e => update(i, 'name', e.target.value)} placeholder="e.g. Temperature" />
    )},
    { title: 'Unit', key: 'unit', width: 90, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={params[i].unit || ''} onChange={e => update(i, 'unit', e.target.value)} placeholder="°C" />
    )},
    { title: 'Target', key: 'target', width: 90, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={params[i].target_value || ''} onChange={e => update(i, 'target_value', e.target.value)} placeholder="25" />
    )},
    { title: 'Min', key: 'min', width: 80, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={params[i].min_value || ''} onChange={e => update(i, 'min_value', e.target.value)} placeholder="20" />
    )},
    { title: 'Max', key: 'max', width: 80, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={params[i].max_value || ''} onChange={e => update(i, 'max_value', e.target.value)} placeholder="30" />
    )},
    { title: 'CPP', key: 'critical', width: 60, render: (_: any, _r: any, i: number) => (
      <Switch size="small" checked={params[i].is_critical} onChange={v => update(i, 'is_critical', v)} />
    )},
    { title: '', key: 'del', width: 40, render: (_: any, _r: any, i: number) => (
      <Button icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => onChange(params.filter((_, j) => j !== i))} />
    )},
  ];

  return (
    <div>
      <Table
        dataSource={params.map((p, i) => ({ ...p, key: i }))}
        columns={cols as any}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No parameters defined' }}
      />
      <Button icon={<PlusOutlined />} size="small" style={{ marginTop: 8 }}
        onClick={() => onChange([...params, newParam()])}>
        Add Parameter
      </Button>
    </div>
  );
}

function IPQCEditor({ ipqcs, onChange }: { ipqcs: MBRStepIPQC[]; onChange: (i: MBRStepIPQC[]) => void }) {
  const update = (i: number, field: keyof MBRStepIPQC, val: any) => {
    const next = [...ipqcs];
    (next[i] as any)[field] = val;
    onChange(next);
  };

  const cols = [
    { title: 'Test Name *', key: 'test', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={ipqcs[i].test_name} onChange={e => update(i, 'test_name', e.target.value)} placeholder="e.g. pH Test" />
    )},
    { title: 'Acceptance Criteria *', key: 'criteria', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={ipqcs[i].acceptance_criteria} onChange={e => update(i, 'acceptance_criteria', e.target.value)} placeholder="e.g. 6.0–7.0" />
    )},
    { title: 'Frequency', key: 'freq', width: 140, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={ipqcs[i].frequency || ''} onChange={e => update(i, 'frequency', e.target.value)} placeholder="Every 30 min" />
    )},
    { title: 'Method', key: 'method', width: 130, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={ipqcs[i].method || ''} onChange={e => update(i, 'method', e.target.value)} placeholder="USP <791>" />
    )},
    { title: 'Responsible', key: 'role', width: 120, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={ipqcs[i].responsible_role || ''} onChange={e => update(i, 'responsible_role', e.target.value)} placeholder="Operator" />
    )},
    { title: '', key: 'del', width: 40, render: (_: any, _r: any, i: number) => (
      <Button icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => onChange(ipqcs.filter((_, j) => j !== i))} />
    )},
  ];

  return (
    <div>
      <Table
        dataSource={ipqcs.map((p, i) => ({ ...p, key: i }))}
        columns={cols as any}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No IPQC checks defined' }}
      />
      <Button icon={<PlusOutlined />} size="small" style={{ marginTop: 8 }}
        onClick={() => onChange([...ipqcs, newIPQC()])}>
        Add IPQC Check
      </Button>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function MBRForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');

  const [materials, setMaterials] = useState<Omit<MBRMaterial, 'id' | 'order'>[]>([]);
  const [equipment, setEquipment] = useState<Omit<MBREquipment, 'id' | 'order'>[]>([]);
  const [steps, setSteps] = useState<Omit<MBRStep, 'id' | 'order'>[]>([]);

  // Load existing MBR for edit
  const { data: existing } = useQuery({
    queryKey: ['mbr', id],
    queryFn: () => mbrApi.get(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      form.setFieldsValue({
        title: existing.title,
        product_name: existing.product_name,
        product_code: existing.product_code,
        dosage_form: existing.dosage_form,
        strength: existing.strength,
        batch_size: existing.batch_size,
        batch_unit: existing.batch_unit,
        theoretical_yield: existing.theoretical_yield,
        yield_unit: existing.yield_unit,
        description: existing.description,
        storage_conditions: existing.storage_conditions,
        manufacturing_site: existing.manufacturing_site,
        notes: existing.notes,
      });
      setMaterials(existing.materials.map(({ id: _id, order: _o, ...m }) => m));
      setEquipment(existing.equipment.map(({ id: _id, order: _o, ...e }) => e));
      setSteps(existing.steps.map(({ id: _id, order: _o, ...s }) => ({
        ...s,
        parameters: s.parameters.map(({ id: _pid, ...p }) => p),
        ipqcs: s.ipqcs.map(({ id: _iid, ...i }) => i),
      })));
    }
  }, [existing, form]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => isEdit ? mbrApi.update(id!, data) : mbrApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mbr'] });
      message.success(isEdit ? 'MBR updated successfully' : `MBR ${result.mbr_number} created`);
      navigate(`/mbr/${result.id}`);
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to save MBR'),
  });

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      saveMutation.mutate({ ...values, materials, equipment, steps });
    } catch {
      message.warning('Please complete all required fields in the General tab');
      setActiveTab('general');
    }
  };

  // ── Materials Tab ──
  const updateMaterial = (i: number, field: keyof typeof materials[0], val: any) => {
    const next = [...materials];
    (next[i] as any)[field] = val;
    setMaterials(next);
  };

  const materialCols = [
    { title: '#', key: 'idx', width: 40, render: (_: any, _r: any, i: number) => <Text type="secondary">{i + 1}</Text> },
    { title: 'Material Name *', key: 'name', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={materials[i].material_name} onChange={e => updateMaterial(i, 'material_name', e.target.value)} placeholder="Microcrystalline Cellulose" />
    )},
    { title: 'Code', key: 'code', width: 110, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={materials[i].material_code || ''} onChange={e => updateMaterial(i, 'material_code', e.target.value)} placeholder="RM-001" />
    )},
    { title: 'Qty *', key: 'qty', width: 90, render: (_: any, _r: any, i: number) => (
      <InputNumber size="small" value={materials[i].quantity} onChange={v => updateMaterial(i, 'quantity', v)} min={0} style={{ width: '100%' }} />
    )},
    { title: 'Unit', key: 'unit', width: 90, render: (_: any, _r: any, i: number) => (
      <Select size="small" value={materials[i].unit} onChange={v => updateMaterial(i, 'unit', v)} options={UNITS.map(u => ({ value: u, label: u }))} style={{ width: '100%' }} />
    )},
    { title: 'Grade', key: 'grade', width: 130, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={materials[i].grade || ''} onChange={e => updateMaterial(i, 'grade', e.target.value)} placeholder="Pharma Grade" />
    )},
    { title: 'API', key: 'api', width: 50, render: (_: any, _r: any, i: number) => (
      <Switch size="small" checked={materials[i].is_active_ingredient} onChange={v => updateMaterial(i, 'is_active_ingredient', v)} />
    )},
    { title: '', key: 'del', width: 40, render: (_: any, _r: any, i: number) => (
      <Button icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => setMaterials(materials.filter((_, j) => j !== i))} />
    )},
  ];

  // ── Equipment Tab ──
  const updateEquipment = (i: number, field: keyof typeof equipment[0], val: any) => {
    const next = [...equipment];
    (next[i] as any)[field] = val;
    setEquipment(next);
  };

  const equipmentCols = [
    { title: '#', key: 'idx', width: 40, render: (_: any, _r: any, i: number) => <Text type="secondary">{i + 1}</Text> },
    { title: 'Equipment Name *', key: 'name', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={equipment[i].equipment_name} onChange={e => updateEquipment(i, 'equipment_name', e.target.value)} placeholder="Granulator" />
    )},
    { title: 'Equipment Code', key: 'code', width: 140, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={equipment[i].equipment_code || ''} onChange={e => updateEquipment(i, 'equipment_code', e.target.value)} placeholder="EQ-G-001" />
    )},
    { title: 'Capacity', key: 'cap', width: 120, render: (_: any, _r: any, i: number) => (
      <Input size="small" value={equipment[i].capacity || ''} onChange={e => updateEquipment(i, 'capacity', e.target.value)} placeholder="200 kg" />
    )},
    { title: 'Notes', key: 'notes', render: (_: any, _r: any, i: number) => (
      <Input size="small" value={equipment[i].notes || ''} onChange={e => updateEquipment(i, 'notes', e.target.value)} placeholder="Optional notes" />
    )},
    { title: '', key: 'del', width: 40, render: (_: any, _r: any, i: number) => (
      <Button icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))} />
    )},
  ];

  // ── Step helpers ──
  const updateStep = (i: number, field: keyof typeof steps[0], val: any) => {
    const next = [...steps];
    (next[i] as any)[field] = val;
    setSteps(next);
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((s, idx) => { s.step_number = idx + 1; });
    setSteps(next);
  };

  const stepPanels = steps.map((step, i) => ({
    key: `step-${i}`,
    label: (
      <Space>
        <Tag color="blue">Step {step.step_number}</Tag>
        <span style={{ fontWeight: step.title ? 600 : 400, color: step.title ? undefined : '#ccc' }}>
          {step.title || 'Untitled Step'}
        </span>
        {step.is_critical && <Tag color="red" style={{ fontSize: 10 }}>CPP</Tag>}
        {step.parameters.length > 0 && <Tag style={{ fontSize: 10 }}>{step.parameters.length} params</Tag>}
        {step.ipqcs.length > 0 && <Tag style={{ fontSize: 10 }}>{step.ipqcs.length} IPQC</Tag>}
      </Space>
    ),
    extra: (
      <Space onClick={e => e.stopPropagation()}>
        <Button icon={<ArrowUpOutlined />} size="small" disabled={i === 0} onClick={() => moveStep(i, -1)} />
        <Button icon={<ArrowDownOutlined />} size="small" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} />
        <Button icon={<DeleteOutlined />} size="small" danger type="text"
          onClick={() => {
            const next = steps.filter((_, j) => j !== i);
            next.forEach((s, idx) => { s.step_number = idx + 1; });
            setSteps(next);
          }}
        />
      </Space>
    ),
    children: (
      <div>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Step Title" required>
              <Input value={step.title} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="e.g. Wet Granulation" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Duration (min)">
              <InputNumber value={step.expected_duration_minutes} onChange={v => updateStep(i, 'expected_duration_minutes', v)} min={0} style={{ width: '100%' }} placeholder="60" />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Expected Yield">
              <InputNumber value={step.expected_yield} onChange={v => updateStep(i, 'expected_yield', v)} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Unit">
              <Input value={step.yield_unit || ''} onChange={e => updateStep(i, 'yield_unit', e.target.value)} placeholder="kg" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Instructions / Description">
          <Input.TextArea
            value={step.description || ''}
            onChange={e => updateStep(i, 'description', e.target.value)}
            rows={3}
            placeholder="Detailed instructions for this manufacturing step..."
          />
        </Form.Item>
        <Space>
          <Form.Item label="Critical Process Step">
            <Switch checked={step.is_critical} onChange={v => updateStep(i, 'is_critical', v)} />
          </Form.Item>
        </Space>
        <Divider orientation="left" style={{ fontSize: 13 }}>Process Parameters</Divider>
        <ParametersEditor params={step.parameters} onChange={p => updateStep(i, 'parameters', p)} />
        <Divider orientation="left" style={{ fontSize: 13 }}>In-Process Quality Controls (IPQC)</Divider>
        <IPQCEditor ipqcs={step.ipqcs} onChange={ipqcs => updateStep(i, 'ipqcs', ipqcs)} />
        <Form.Item label="Step Notes" style={{ marginTop: 16 }}>
          <Input.TextArea value={step.notes || ''} onChange={e => updateStep(i, 'notes', e.target.value)} rows={2} placeholder="Additional notes..." />
        </Form.Item>
      </div>
    ),
  }));

  const tabItems = [
    {
      key: 'general',
      label: <Space><FileTextOutlined />General Info</Space>,
      children: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="MBR Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Amoxicillin 500mg Capsule Manufacturing" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="product_name" label="Product Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Amoxicillin Capsules" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="product_code" label="Product Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. AMX-500" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dosage_form" label="Dosage Form">
                <Select placeholder="Select form" options={DOSAGE_FORMS.map(f => ({ value: f, label: f }))} allowClear />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="strength" label="Strength">
                <Input placeholder="e.g. 500 mg" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="batch_size" label="Batch Size">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="100" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="batch_unit" label="Batch Unit">
                <Select options={UNITS.map(u => ({ value: u, label: u }))} placeholder="kg" allowClear />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="theoretical_yield" label="Theoretical Yield">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="98" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="yield_unit" label="Yield Unit">
                <Select options={[...UNITS, '%'].map(u => ({ value: u, label: u }))} placeholder="%" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="manufacturing_site" label="Manufacturing Site">
                <Input placeholder="e.g. Plant A — Building 3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="storage_conditions" label="Storage Conditions">
                <Input placeholder="e.g. 15–25°C, <60% RH, protected from light" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Overview and purpose of this batch record..." />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Any additional notes or references..." />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'materials',
      label: <Space><MedicineBoxOutlined />Bill of Materials ({materials.length})</Space>,
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">Define all raw materials, excipients, and active ingredients required for one batch.</Text>
            <Button icon={<PlusOutlined />} type="primary" ghost onClick={() => setMaterials([...materials, newMaterial()])}>
              Add Material
            </Button>
          </div>
          <Table
            dataSource={materials.map((m, i) => ({ ...m, key: i }))}
            columns={materialCols as any}
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No materials added yet' }}
          />
        </div>
      ),
    },
    {
      key: 'equipment',
      label: <Space><ToolOutlined />Equipment ({equipment.length})</Space>,
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">List all equipment required for this batch manufacturing process.</Text>
            <Button icon={<PlusOutlined />} type="primary" ghost onClick={() => setEquipment([...equipment, newEquipment()])}>
              Add Equipment
            </Button>
          </div>
          <Table
            dataSource={equipment.map((e, i) => ({ ...e, key: i }))}
            columns={equipmentCols as any}
            pagination={false}
            size="small"
            locale={{ emptyText: 'No equipment added yet' }}
          />
        </div>
      ),
    },
    {
      key: 'steps',
      label: <Space><ExperimentOutlined />Manufacturing Steps ({steps.length})</Space>,
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Define each manufacturing step with process parameters and in-process quality controls.
            </Text>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              ghost
              onClick={() => setSteps([...steps, newStep(steps.length + 1)])}
            >
              Add Step
            </Button>
          </div>
          {steps.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 0', color: '#ccc' }}>
              <ExperimentOutlined style={{ fontSize: 40, marginBottom: 8, display: 'block' }} />
              <Text type="secondary">No steps yet — add the first manufacturing step above</Text>
            </Card>
          ) : (
            <Collapse items={stepPanels} defaultActiveKey={['step-0']} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? `Edit MBR — ${existing?.mbr_number}` : 'Create Master Batch Record'}
          </Title>
          {isEdit && existing && (
            <Space style={{ marginTop: 4 }}>
              <Tag>v{existing.version}</Tag>
              <Tag color="default">{existing.status}</Tag>
            </Space>
          )}
        </div>
        <Space>
          <Button onClick={() => navigate('/mbr')}>Cancel</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Create MBR'}
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ padding: '0 24px' }}
          tabBarStyle={{ marginBottom: 0 }}
        />
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Button onClick={() => navigate('/mbr')}>Cancel</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={handleSave}>
              {isEdit ? 'Save Changes' : 'Create MBR'}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
