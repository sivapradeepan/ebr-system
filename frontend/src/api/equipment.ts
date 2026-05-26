import api from './client';
import type { Equipment, EquipmentList } from '../types/equipment';

export const equipmentApi = {
  list: (params?: {
    page?: number;
    size?: number;
    search?: string;
    status?: string;
    category?: string;
  }): Promise<EquipmentList> =>
    api.get('/equipment', { params }).then(r => r.data),

  get: (id: string): Promise<Equipment> =>
    api.get(`/equipment/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>): Promise<Equipment> =>
    api.post('/equipment', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>): Promise<Equipment> =>
    api.put(`/equipment/${id}`, data).then(r => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/equipment/${id}`).then(r => r.data),

  getLogs: (id: string, params?: { log_type?: string; page?: number; size?: number }) =>
    api.get(`/equipment/${id}/logs`, { params }).then(r => r.data),
  createLog: (id: string, data: Record<string, unknown>) =>
    api.post(`/equipment/${id}/logs`, data).then(r => r.data),
  updateLog: (equipmentId: string, logId: string, data: Record<string, unknown>) =>
    api.patch(`/equipment/${equipmentId}/logs/${logId}`, data).then(r => r.data),
  deleteLog: (equipmentId: string, logId: string) =>
    api.delete(`/equipment/${equipmentId}/logs/${logId}`),

  getCleaningLogs: (id: string) =>
    api.get(`/equipment/${id}/cleaning`).then(r => r.data),
  addCleaningLog: (id: string, data: Record<string, unknown>) =>
    api.post(`/equipment/${id}/cleaning`, data).then(r => r.data),
  deleteCleaningLog: (equipmentId: string, logId: string) =>
    api.delete(`/equipment/${equipmentId}/cleaning/${logId}`),
};

export const materialApi = {
  list: (params?: {
    page?: number;
    size?: number;
    search?: string;
    material_type?: string;
    status?: string;
  }) =>
    api.get('/materials', { params }).then(r => r.data),

  get: (id: string) =>
    api.get(`/materials/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/materials', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/materials/${id}`, data).then(r => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/materials/${id}`).then(r => r.data),
};
