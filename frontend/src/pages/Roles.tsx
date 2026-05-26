import {
  Card, Table, Button, Tag, Modal, Form, Input, Select,
  Typography, Space, Popconfirm, message, Badge,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { Role, Permission } from '../types';

const { Title } = Typography;

export default function Roles() {
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => client.get<Role[]>('/roles').then(r => r.data),
  });

  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => client.get<Permission[]>('/roles/permissions').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => client.post('/roles', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); setModalOpen(false); form.resetFields(); message.success('Role created'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to create role'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => client.patch(`/roles/${id}`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); setModalOpen(false); setEditingRole(null); form.resetFields(); message.success('Role updated'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed to update role'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/roles/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); message.success('Role deleted'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Cannot delete role'),
  });

  const openCreate = () => { setEditingRole(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({ name: role.name, description: role.description, permission_ids: role.permissions.map(p => p.id) });
    setModalOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: { description: values.description, permission_ids: values.permission_ids } });
    } else {
      createMutation.mutate(values);
    }
  };

  // Group permissions by resource for display
  const permsByResource = (permissions ?? []).reduce((acc: Record<string, Permission[]>, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  const columns = [
    {
      title: 'Role',
      key: 'name',
      render: (_: any, r: Role) => (
        <Space>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</span>
          {r.is_system && <Tag icon={<LockOutlined />} color="gold">System</Tag>}
        </Space>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span> },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: any, r: Role) => (
        <Space wrap>
          {r.permissions.slice(0, 4).map(p => <Tag key={p.id} style={{ fontSize: 11 }}>{p.name}</Tag>)}
          {r.permissions.length > 4 && <Tag>+{r.permissions.length - 4} more</Tag>}
          {r.permissions.length === 0 && <Tag color="default">No permissions</Tag>}
        </Space>
      ),
    },
    {
      title: 'Users',
      key: 'users',
      render: (_: any, r: Role) => <Badge count={0} showZero color="#1677ff" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: Role) => (
        <Space>
          {hasPermission('roles:update') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          )}
          {hasPermission('roles:delete') && !r.is_system && (
            <Popconfirm
              title="Delete this role?"
              description="Users with this role will lose the associated permissions."
              onConfirm={() => deleteMutation.mutate(r.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Roles & Permissions</Title>
        {hasPermission('roles:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Role</Button>
        )}
      </div>

      <Card>
        <Table dataSource={roles} columns={columns} rowKey="id" loading={isLoading} />
      </Card>

      <Modal
        title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingRole(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Role Name" rules={[{ required: !editingRole }]}>
            <Input disabled={!!editingRole} placeholder="e.g. QA Lead" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Describe the responsibilities of this role" />
          </Form.Item>
          <Form.Item name="permission_ids" label="Permissions">
            <Select
              mode="multiple"
              placeholder="Search and select permissions..."
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={Object.entries(permsByResource).flatMap(([resource, perms]) =>
                perms.map(p => ({
                  value: p.id,
                  label: p.name,
                  title: p.description || p.name,
                }))
              )}
              optionRender={(option) => (
                <div>
                  <Tag style={{ fontSize: 11 }}>{option.data.label}</Tag>
                  <span style={{ fontSize: 11, color: '#888' }}>{option.data.title}</span>
                </div>
              )}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
