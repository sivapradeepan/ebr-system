import api from './client';
import type { Deviation, DeviationList, CAPAOut, CAPAList } from '../types/quality';

export const deviationApi = {
  list: (params?: {
    page?: number; size?: number; search?: string;
    deviation_type?: string; severity?: string; status?: string; ebr_id?: string;
  }): Promise<DeviationList> =>
    api.get('/deviations', { params }).then(r => r.data),

  get: (id: string): Promise<Deviation> =>
    api.get(`/deviations/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>): Promise<Deviation> =>
    api.post('/deviations', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>): Promise<Deviation> =>
    api.put(`/deviations/${id}`, data).then(r => r.data),

  investigate: (id: string, data: { root_cause: string; investigation_summary: string }): Promise<Deviation> =>
    api.post(`/deviations/${id}/investigate`, data).then(r => r.data),

  pendingCapa: (id: string): Promise<Deviation> =>
    api.post(`/deviations/${id}/pending-capa`).then(r => r.data),

  resolve: (id: string, data: { closure_comments: string }): Promise<Deviation> =>
    api.post(`/deviations/${id}/resolve`, data).then(r => r.data),

  close: (id: string): Promise<Deviation> =>
    api.post(`/deviations/${id}/close`).then(r => r.data),
};

export const capaApi = {
  list: (params?: {
    page?: number; size?: number; search?: string;
    capa_type?: string; status?: string; deviation_id?: string;
  }): Promise<CAPAList> =>
    api.get('/capas', { params }).then(r => r.data),

  get: (id: string): Promise<CAPAOut> =>
    api.get(`/capas/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>): Promise<CAPAOut> =>
    api.post('/capas', data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>): Promise<CAPAOut> =>
    api.put(`/capas/${id}`, data).then(r => r.data),

  start: (id: string): Promise<CAPAOut> =>
    api.post(`/capas/${id}/start`).then(r => r.data),

  complete: (id: string, data: { completion_notes: string }): Promise<CAPAOut> =>
    api.post(`/capas/${id}/complete`, data).then(r => r.data),

  verify: (id: string, data: { effectiveness_check: string }): Promise<CAPAOut> =>
    api.post(`/capas/${id}/verify`, data).then(r => r.data),

  close: (id: string): Promise<CAPAOut> =>
    api.post(`/capas/${id}/close`).then(r => r.data),
};
