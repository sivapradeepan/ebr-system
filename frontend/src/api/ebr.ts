import client from './client';
import type { EBRDetail, EBRSummary } from '../types/ebr';
import type { PaginatedResponse } from '../types';

interface EBRFilters { page?: number; size?: number; search?: string; status?: string; product_code?: string; }

interface CompleteStepPayload {
  actual_yield?: number;
  execution_notes?: string;
  parameters: { id: string; actual_value?: string; notes?: string }[];
  ipqcs: { id: string; actual_result?: string; passed?: boolean; notes?: string }[];
}

interface DispensePayload { actual_quantity: number; lot_number: string; expiry_date?: string; notes?: string; }

export const ebrApi = {
  list: (params?: EBRFilters) =>
    client.get<PaginatedResponse<EBRSummary>>('/ebr', { params }).then(r => r.data),

  get: (id: string) => client.get<EBRDetail>(`/ebr/${id}`).then(r => r.data),

  create: (data: { mbr_id: string; batch_number: string; planned_batch_size?: number; batch_unit?: string; notes?: string }) =>
    client.post<EBRDetail>('/ebr', data).then(r => r.data),

  delete: (id: string) => client.delete(`/ebr/${id}`),

  startStep: (ebrId: string, stepId: string) =>
    client.post(`/ebr/${ebrId}/steps/${stepId}/start`).then(r => r.data),

  saveStep: (ebrId: string, stepId: string, data: CompleteStepPayload) =>
    client.put(`/ebr/${ebrId}/steps/${stepId}/save`, data).then(r => r.data),

  completeStep: (ebrId: string, stepId: string, data: CompleteStepPayload) =>
    client.post(`/ebr/${ebrId}/steps/${stepId}/complete`, data).then(r => r.data),

  dispenseMaterial: (ebrId: string, materialId: string, data: DispensePayload) =>
    client.put(`/ebr/${ebrId}/materials/${materialId}`, data).then(r => r.data),

  finalize: (id: string, data: { actual_yield?: number; actual_yield_unit?: string; notes?: string }) =>
    client.post(`/ebr/${id}/finalize`, data).then(r => r.data),

  submit: (id: string, comments?: string) =>
    client.post(`/ebr/${id}/submit`, { comments }).then(r => r.data),

  approve: (id: string, comments?: string) =>
    client.post(`/ebr/${id}/approve`, { comments }).then(r => r.data),

  reject: (id: string, comments?: string) =>
    client.post(`/ebr/${id}/reject`, { comments }).then(r => r.data),
};
