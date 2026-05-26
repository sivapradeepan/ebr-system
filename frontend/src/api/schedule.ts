import client from './client';

export type ScheduleStatus   = 'PLANNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type SchedulePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface UserSnap { id: string; full_name: string; username: string; }

export interface Schedule {
  id: string;
  schedule_number: string;
  mbr_id: string;
  mbr_number: string;
  mbr_version: string;
  product_name: string;
  product_code: string;
  planned_batch_size: number | null;
  batch_unit: string | null;
  scheduled_start: string;
  scheduled_end: string;
  equipment_line: string | null;
  status: ScheduleStatus;
  priority: SchedulePriority;
  notes: string | null;
  ebr_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_operator: UserSnap | null;
  converted_by: UserSnap | null;
  created_by: UserSnap;
}

export interface CalendarEntry {
  id: string;
  schedule_number: string;
  product_name: string;
  product_code: string;
  mbr_number: string;
  status: ScheduleStatus;
  priority: SchedulePriority;
  scheduled_start: string;
  scheduled_end: string;
  equipment_line: string | null;
  ebr_id: string | null;
  assigned_operator: string | null;
  planned_batch_size: number | null;
  batch_unit: string | null;
}

export interface ScheduleList {
  items: Schedule[];
  total: number;
  page: number;
  size: number;
}

export interface ScheduleCreatePayload {
  mbr_id: string;
  planned_batch_size?: number;
  batch_unit?: string;
  scheduled_start: string;
  scheduled_end: string;
  assigned_operator_id?: string;
  equipment_line?: string;
  priority?: SchedulePriority;
  notes?: string;
}

export const scheduleApi = {
  list: (params?: { page?: number; size?: number; status?: string; search?: string }) =>
    client.get<ScheduleList>('/schedule', { params }).then(r => r.data),

  calendar: (start: string, end: string) =>
    client.get<CalendarEntry[]>('/schedule/calendar', { params: { start, end } }).then(r => r.data),

  get: (id: string) =>
    client.get<Schedule>(`/schedule/${id}`).then(r => r.data),

  create: (data: ScheduleCreatePayload) =>
    client.post<Schedule>('/schedule', data).then(r => r.data),

  update: (id: string, data: Partial<ScheduleCreatePayload>) =>
    client.put<Schedule>(`/schedule/${id}`, data).then(r => r.data),

  delete: (id: string) => client.delete(`/schedule/${id}`),

  confirm: (id: string) =>
    client.post<Schedule>(`/schedule/${id}/confirm`).then(r => r.data),

  cancel: (id: string) =>
    client.post<Schedule>(`/schedule/${id}/cancel`).then(r => r.data),

  convert: (id: string, data: { batch_number: string; planned_batch_size?: number; batch_unit?: string; notes?: string }) =>
    client.post<Schedule>(`/schedule/${id}/convert`, data).then(r => r.data),
};
