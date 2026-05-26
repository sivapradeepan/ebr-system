import client from './client';
import type { AuditLog, PaginatedResponse } from '../types';

interface AuditFilters {
  page?: number;
  size?: number;
  user_id?: string;
  username?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
}

export const auditApi = {
  list: (params?: AuditFilters) =>
    client.get<PaginatedResponse<AuditLog>>('/audit', { params }).then(r => r.data),
};
