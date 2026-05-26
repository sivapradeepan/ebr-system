import client from './client';
import type { MBRDetail, MBRSummary, MBRFormData } from '../types/mbr';
import type { PaginatedResponse } from '../types';

interface MBRFilters {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  product_code?: string;
}

export const mbrApi = {
  list: (params?: MBRFilters) =>
    client.get<PaginatedResponse<MBRSummary>>('/mbr', { params }).then(r => r.data),

  get: (id: string) =>
    client.get<MBRDetail>(`/mbr/${id}`).then(r => r.data),

  create: (data: MBRFormData) =>
    client.post<MBRDetail>('/mbr', data).then(r => r.data),

  update: (id: string, data: MBRFormData) =>
    client.put<MBRDetail>(`/mbr/${id}`, data).then(r => r.data),

  delete: (id: string) => client.delete(`/mbr/${id}`),

  submit: (id: string, comments?: string) =>
    client.post(`/mbr/${id}/submit`, { comments }).then(r => r.data),

  approve: (id: string, comments?: string) =>
    client.post(`/mbr/${id}/approve`, { comments }).then(r => r.data),

  reject: (id: string, comments?: string) =>
    client.post(`/mbr/${id}/reject`, { comments }).then(r => r.data),

  newVersion: (id: string) =>
    client.post<MBRDetail>(`/mbr/${id}/new-version`).then(r => r.data),
};
