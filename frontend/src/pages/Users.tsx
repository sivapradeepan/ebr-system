import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  Popconfirm, message, Typography, Badge, Tooltip, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UnlockOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users';
import { useAuthStore } from '../store/authStore';
import type { User, Role } from '../types';
import client from '../api/client';

const { Title } = Typography;

export default function Users() {
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, size: 20, search: search || undefined }),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => client.get<Role[]>('/roles').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      form.resetFields();
      message.success('User created successfully');
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Failed to create user';
      message.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      message.success('User updated successfully');
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Failed to update user';
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); message.success('User deleted'); },
    onError: () => message.error('Failed to delete user'),
  });

  const unlockMutation = useMutation({
    mutationFn: usersApi.unlock,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); message.success('User unlocked'); },
  });

  const openCreate = () => { setEditingUser(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({ ...user, role_ids: user.roles.map(r => r.id) });
    setModalOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: User) => (
        <Space>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#1677ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>
            {record.full_name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{record.full_name}</div>
            <div style={{ color: '#888', fontSize: 12 }}>@{record.username}</div>
          </div>
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Department', dataIndex: 'department', key: 'department', render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span> },
    { title: 'Employee ID', dataIndex: 'employee_id', key: 'employee_id', render: (v: string) => v || <span style={{ color: '#ccc' }}>—</span> },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: any, record: User) => (
        <Space wrap>
          {record.roles.map(r => <Tag key={r.id} color="blue">{r.name}</Tag>)}
          {record.roles.length === 0 && <Tag>No roles</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: User) =>
        record.is_locked ? <Badge status="error" text="Locked" /> :
        record.is_active ? <Badge status="success" text="Active" /> :
        <Badge status="default" text="Inactive" />,
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (v: string) => v ? new Date(v).toLocaleString() : <span style={{ color: '#ccc' }}>Never</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          {hasPermission('users:update') && (
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {hasPermission('users:update') && record.is_locked && (
            <Tooltip title="Unlock Account">
              <Button icon={<UnlockOutlined />} size="small" type="primary" ghost
                onClick={() => unlockMutation.mutate(record.id)} />
            </Tooltip>
          )}
          {hasPermission('users:delete') && (
            <Popconfirm
              title="Delete this user?"
              description="This action cannot be undone."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>User Management</Title>
        {hasPermission('users:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New User</Button>
        )}
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search by name, username, or email..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 340 }}
            allowClear
          />
        </div>
        <Table
          dataSource={data?.items}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total,
            onChange: setPage,
            showTotal: total => `${total} users`,
          }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Edit User' : 'Create New User'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUser(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
                <Input placeholder="Jane Doe" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: !editingUser }]}>
                <Input placeholder="janedoe" disabled={!!editingUser} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="jane.doe@pharma.com" />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, min: 8, message: 'Min 8 chars with uppercase, lowercase, and digit' }]}
            >
              <Input.Password placeholder="Min 8 chars — uppercase, lowercase, digit" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input placeholder="Production" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="employee_id" label="Employee ID">
                <Input placeholder="EMP-001" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="role_ids" label="Roles">
            <Select
              mode="multiple"
              placeholder="Assign roles to this user"
              options={roles?.map(r => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
          {editingUser && (
            <Form.Item name="is_active" label="Account Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
