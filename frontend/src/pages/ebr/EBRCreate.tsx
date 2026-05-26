import { Form, Input, InputNumber, Select, Button, Card, Typography, Space, Alert, Descriptions, Tag } from 'antd';
import { ExperimentOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ebrApi } from '../../api/ebr';
import { mbrApi } from '../../api/mbr';
import type { MBRSummary } from '../../types/mbr';

const { Title, Text } = Typography;

export default function EBRCreate() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedMBR, setSelectedMBR] = useState<MBRSummary | null>(null);

  const { data: mbrData } = useQuery({
    queryKey: ['mbr', 'approved'],
    queryFn: () => mbrApi.list({ size: 100, status: 'APPROVED' }),
  });

  const { data: effectiveMBRData } = useQuery({
    queryKey: ['mbr', 'effective'],
    queryFn: () => mbrApi.list({ size: 100, status: 'EFFECTIVE' }),
  });

  const availableMBRs = [
    ...(mbrData?.items || []),
    ...(effectiveMBRData?.items || []),
  ];

  const createMutation = useMutation({
    mutationFn: ebrApi.create,
    onSuccess: (data) => {
      navigate(`/ebr/${data.id}/execute`);
    },
  });

  const handleMBRSelect = (mbrId: string) => {
    const mbr = availableMBRs.find(m => m.id === mbrId);
    setSelectedMBR(mbr || null);
    if (mbr) {
      form.setFieldsValue({
        planned_batch_size: mbr.batch_size,
        batch_unit: mbr.batch_unit,
      });
    }
  };

  const handleFinish = (values: any) => {
    createMutation.mutate(values);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/ebr')}>Back</Button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <ExperimentOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8, display: 'block' }} />
        <Title level={4} style={{ margin: 0 }}>Initiate New Batch</Title>
        <Text type="secondary">Select an approved MBR template to begin batch execution</Text>
      </div>

      {createMutation.isError && (
        <Alert type="error" message={(createMutation.error as any)?.response?.data?.detail || 'Failed to create batch'}
          style={{ marginBottom: 16 }} showIcon />
      )}

      <Card title="Batch Details">
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item name="mbr_id" label="Master Batch Record (MBR)" rules={[{ required: true, message: 'Select an MBR' }]}>
            <Select
              placeholder="Select an approved MBR..."
              showSearch
              optionFilterProp="label"
              onChange={handleMBRSelect}
              options={availableMBRs.map(m => ({
                value: m.id,
                label: `${m.mbr_number} v${m.version} — ${m.product_name} (${m.product_code})`,
              }))}
            />
          </Form.Item>

          {selectedMBR && (
            <Card size="small" style={{ marginBottom: 16, background: '#f0f7ff', border: '1px solid #91caff' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Product">{selectedMBR.product_name}</Descriptions.Item>
                <Descriptions.Item label="Code">{selectedMBR.product_code}</Descriptions.Item>
                <Descriptions.Item label="Strength">{selectedMBR.strength || '—'}</Descriptions.Item>
                <Descriptions.Item label="Dosage Form">{selectedMBR.dosage_form || '—'}</Descriptions.Item>
                <Descriptions.Item label="Batch Size">
                  {selectedMBR.batch_size ? `${selectedMBR.batch_size} ${selectedMBR.batch_unit || ''}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color="success">{selectedMBR.status}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Form.Item
            name="batch_number"
            label="Batch Number"
            rules={[{ required: true, message: 'Batch number is required' }]}
            extra="Enter the actual batch/lot number for this production run"
          >
            <Input placeholder="e.g. BN-2026-0001" style={{ fontFamily: 'monospace', fontSize: 15 }} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="planned_batch_size" label="Planned Batch Size" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="100" />
            </Form.Item>
            <Form.Item name="batch_unit" label="Unit" style={{ flex: 1 }}>
              <Select placeholder="kg" options={['kg', 'g', 'L', 'mL', 'units', 'tablets', 'capsules'].map(u => ({ value: u, label: u }))} allowClear />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={2} placeholder="Any batch-specific notes or special instructions..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Space>
              <Button onClick={() => navigate('/ebr')}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}
                icon={<ExperimentOutlined />} disabled={!selectedMBR}>
                Initiate Batch & Start Execution
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
