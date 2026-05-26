import {
  Card, Form, Input, InputNumber, Button, Select,
  DatePicker, Switch, Space, Typography, message, Row, Col,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, TYPE_LABELS } from '../../api/training';
import client from '../../api/client';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

function useUsers() {
  return useQuery({
    queryKey: ['users-all'],
    queryFn: () => client.get('/users', { params: { size: 200 } }).then(r => r.data),
  });
}

export default function TrainingForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: usersData } = useUsers();

  const { data: existing } = useQuery({
    queryKey: ['training', id],
    queryFn: () => trainingApi.get(id!),
    enabled: isEdit,
  });

  if (isEdit && existing && !form.getFieldValue('trainee_id')) {
    form.setFieldsValue({
      trainee_id:    existing.trainee.id,
      training_type: existing.training_type,
      title:         existing.title,
      description:   existing.description,
      reference_doc: existing.reference_doc,
      training_date: dayjs(existing.training_date),
      expiry_date:   existing.expiry_date ? dayjs(existing.expiry_date) : null,
      trainer_id:    existing.trainer?.id,
      trainer_name:  existing.trainer_name,
      passed:        existing.passed,
      score:         existing.score,
      notes:         existing.notes,
    });
  }

  const createMutation = useMutation({
    mutationFn: trainingApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training'] });
      message.success('Training record created');
      navigate('/training');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => trainingApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training'] });
      message.success('Training record updated');
      navigate('/training');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed'),
  });

  const onFinish = (values: any) => {
    const payload = {
      ...values,
      training_date: values.training_date?.format('YYYY-MM-DD'),
      expiry_date:   values.expiry_date?.format('YYYY-MM-DD') ?? null,
    };
    if (isEdit) updateMutation.mutate(payload);
    else         createMutation.mutate(payload);
  };

  const users = usersData?.items ?? [];

  return (
    <div style={{ maxWidth: 760 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/training')}>
          Training Records
        </Button>
      </Space>

      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          {isEdit ? 'Edit Training Record' : 'Record New Training'}
        </Title>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="trainee_id" label="Trainee"
                rules={[{ required: true, message: 'Select a trainee' }]}>
                <Select
                  showSearch placeholder="Select employee"
                  disabled={isEdit}
                  filterOption={(inp, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(inp.toLowerCase())}
                  options={users.map((u: any) => ({
                    value: u.id,
                    label: `${u.full_name} (${u.username})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="training_type" label="Training Type"
                rules={[{ required: true }]}>
                <Select
                  options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  placeholder="Select type"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="title" label="Training Title"
            rules={[{ required: true, message: 'Enter training title' }]}>
            <Input placeholder="e.g. Granulation SOP v3.2, Mixer Equipment Qualification" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="reference_doc" label="Reference Document">
                <Input placeholder="e.g. SOP-GR-001 v3.2" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Brief description (optional)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="training_date" label="Training Date"
                rules={[{ required: true, message: 'Select training date' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiry_date" label="Expiry Date"
                help="Leave blank if this training never expires">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="trainer_id" label="Trainer (Internal)">
                <Select
                  showSearch allowClear placeholder="Select internal trainer"
                  filterOption={(inp, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(inp.toLowerCase())}
                  options={users.map((u: any) => ({
                    value: u.id,
                    label: `${u.full_name} (${u.username})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trainer_name" label="Trainer Name (External)">
                <Input placeholder="External trainer / provider name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="passed" label="Assessment Passed" valuePropName="checked">
                <Switch checkedChildren="Pass" unCheckedChildren="Fail" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="score" label="Score (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="e.g. 85" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Additional comments…" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}>
                {isEdit ? 'Save Changes' : 'Record Training'}
              </Button>
              <Button onClick={() => navigate('/training')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
