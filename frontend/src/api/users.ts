import client from './client';
import type { User, PaginatedResponse } from '../types';

interface UserCreatePayload {
  username: string;
  email: string;
  full_name: string;
  password: string;
  department?: string;
  employee_id?: string;
  role_ids: string[];
}

interface UserUpdatePayload {
  full_name?: string;
  email?: string;
  department?: string;
  employee_id?: string;
  is_active?: boolean;
  role_ids?: string[];
}

export const usersApi = {
  list: (params?: { page?: number; size?: number; search?: string; is_active?: boolean }) =>
    client.get<PaginatedResponse<User>>('/users', { params }).then(r => r.data),

  get: (id: string) => client.get<User>(`/users/${id}`).then(r => r.data),

  create: (data: UserCreatePayload) => client.post<User>('/users', data).then(r => r.data),

  update: (id: string, data: UserUpdatePayload) =>
    client.patch<User>(`/users/${id}`, data).then(r => r.data),

  delete: (id: string) => client.delete(`/users/${id}`),

  unlock: (id: string) => client.post(`/users/${id}/unlock`),
};
