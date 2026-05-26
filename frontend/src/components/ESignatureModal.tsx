/**
 * 21 CFR Part 11 §11.50 Compliant Electronic Signature Modal
 * Captures: signatory identity, date/time (server-set), and meaning/intent.
 * Requires password re-authentication at time of signing.
 */
import { Modal, Form, Input, Select, Alert, Typography, Descriptions, Divider } from 'antd';
import { SafetyOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { esignatureApi } from '../api/esignature';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;

  // Resource being signed
  resourceType: string;        // "mbr", "ebr", "deviation", "capa"
  resourceId: string;
  resourceLabel: string;       // display name e.g. "EBR-2026-0001 — Batch BN-2026-001"

  // Action
  action: string;              // "submit", "approve", "reject", "close"
  actionLabel: string;         // button text e.g. "Approve & Sign"
  meanings: string[];          // available meaning/intent options

  isDanger?: boolean;
  requireComments?: boolean;   // true for reject — comments become the reason
}

export default function ESignatureModal({
  open, onClose, onSuccess,
  resourceType, resourceId, resourceLabel,
  action, actionLabel, meanings,
  isDanger = false,
  requireComments = false,
}: Props) {
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  const signMutation = useMutation({
    mutationFn: (values: any) =>
      esignatureApi.sign({
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        meaning: values.meaning,
        comments: values.comments || undefined,
        password: values.password,
      }),
    onSuccess: () => {
      form.resetFields();
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = () => form.submit();

  const handleClose = () => {
    form.resetFields();
    signMutation.reset();
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <SafetyOutlined style={{ color: '#1677ff', marginRight: 8 }} />
          Electronic Signature — {actionLabel}
        </span>
      }
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText={actionLabel}
      okButtonProps={{ danger: isDanger }}
      confirmLoading={signMutation.isPending}
      destroyOnClose
      width={520}
    >
      {/* 21 CFR Part 11 notice */}
      <div style={{
        background: '#fffbe6', border: '1px solid #ffe58f',
        borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#614700',
      }}>
        <strong>21 CFR Part 11 Electronic Signature</strong> — This constitutes a legally binding
        signature. Password re-entry is required to confirm your identity. The signature, timestamp,
        and meaning will be permanently recorded.
      </div>

      {/* Record being signed */}
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}
        labelStyle={{ width: 130, fontSize: 12, background: '#fafafa' }}>
        <Descriptions.Item label="Record">{resourceLabel}</Descriptions.Item>
        <Descriptions.Item label="Action">{action.toUpperCase()}</Descriptions.Item>
        <Descriptions.Item label="Signatory">
          <Text strong>{user?.full_name}</Text>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>({user?.username})</Text>
        </Descriptions.Item>
      </Descriptions>

      {signMutation.isError && (
        <Alert type="error"
          message={(signMutation.error as any)?.response?.data?.detail || 'Signature failed'}
          style={{ marginBottom: 16 }} showIcon />
      )}

      <Form form={form} layout="vertical" onFinish={v => signMutation.mutate(v)}>
        <Form.Item name="meaning" label="Signature Meaning / Intent"
          rules={[{ required: true, message: 'Select the meaning of this signature' }]}
          extra="§11.50(c): Each signature must include the meaning associated with the signing">
          <Select placeholder="Select meaning..." options={meanings.map(m => ({ value: m, label: m }))} />
        </Form.Item>

        <Form.Item
          name="comments"
          label={requireComments ? 'Reason (required)' : 'Comments (optional)'}
          rules={requireComments ? [{ required: true, message: 'Please provide a reason' }] : []}
        >
          <Input.TextArea rows={2} placeholder={
            requireComments ? 'Enter the reason for this action...' : 'Optional comments...'
          } />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        <Form.Item name="password" label={
          <span><LockOutlined style={{ marginRight: 4 }} />Password Re-Authentication</span>
        }
          rules={[{ required: true, message: 'Password is required to sign' }]}
          extra="§11.200(a)(1): Identity must be verified at time of signing">
          <Input.Password
            prefix={<UserOutlined style={{ color: '#bbb' }} />}
            placeholder="Enter your password to confirm identity"
            autoComplete="current-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
