import {
  Card, Form, Input, InputNumber, Button, Select, DatePicker,
  Typography, Space, message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi, type ScheduleCreatePayload } from '../../api/schedule';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

// Fetch approved MBRs for the select
import client from '../../api/client';

function useMBRs() {
  return useQuery({
    queryKey: ['mbrs-approved'],
    queryFn: () =>
      client.get('/mbr', { params: { status: 'APPROVED', size: 100 } }).then(r => r.data),
  });
}

export default function ScheduleForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: mbrData } = useMBRs();

  const { data: existing } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => scheduleApi.get(id!),
    enabled: isEdit,
  });

  // Pre-fill form when editing
  if (isEdit && existing && !form.getFieldValue('mbr_id')) {
    form.setFieldsValue({
      mbr_id: existing.mbr_id,
      planned_batch_size: existing.planned_batch_size,
      batch_unit: existing.batch_unit,
      equipment_line: existing.equipment_line,
      priority: existing.priority,
      notes: existing.notes,
      date_range: [dayjs(existing.scheduled_start), dayjs(existing.scheduled_end)],
    });
  }

  const createMutation = useMutation({
    mutationFn: scheduleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      message.success('Batch scheduled successfully');
      navigate('/schedule');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed to create schedule'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => scheduleApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      message.success('Schedule updated');
      navigate('/schedule');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Failed to update'),
  });

  const onFinish = (values: any) => {
    const [start, end] = values.date_range;
    const payload: ScheduleCreatePayload = {
      mbr_id: values.mbr_id,
      planned_batch_size: values.planned_batch_size,
      batch_unit: values.batch_unit,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      equipment_line: values.equipment_line,
      priority: values.priority || 'MEDIUM',
      notes: values.notes,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const mbrs = mbrData?.items ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/schedule')}>Schedule</Button>
      </Space>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          {isEdit ? 'Edit Schedule Entry' : 'Plan New Batch'}
        </Title>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="mbr_id" label="Master Batch Record"
            rules={[{ required: true, message: 'Select an approved MBR' }]}>
            <Select
              showSearch placeholder="Select approved MBR"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              options={mbrs.map((m: any) => ({
                value: m.id,
                label: `${m.mbr_number} v${m.version} — ${m.product_name}`,
              }))}
              disabled={isEdit}
            />
          </Form.Item>

          <Form.Item name="date_range" label="Scheduled Window"
            rules={[{ required: true, message: 'Select start and end date/time' }]}>
            <DatePicker.RangePicker
              showTime style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
              placeholder={['Start', 'End']}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="planned_batch_size" label="Planned Batch Size">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 500" />
            </Form.Item>
            <Form.Item name="batch_unit" label="Unit">
              <Input placeholder="kg / L / units" />
            </Form.Item>
          </Space>

          <Form.Item name="equipment_line" label="Equipment / Production Line">
            <Input placeholder="e.g. Line 3 — Granulator Suite B" />
          </Form.Item>

          <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
            <Select options={[
              { value: 'HIGH',   label: '🔴 High' },
              { value: 'MEDIUM', label: '🟡 Medium' },
              { value: 'LOW',    label: '🟢 Low' },
            ]} />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Special instructions, prerequisites…" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}>
                {isEdit ? 'Save Changes' : 'Schedule Batch'}
              </Button>
              <Button onClick={() => navigate('/schedule')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
