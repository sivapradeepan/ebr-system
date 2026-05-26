import client from './client';

export type TrainingType =
  | 'GMP_BASICS' | 'SOP' | 'EQUIPMENT' | 'PROCESS'
  | 'SAFETY' | 'REGULATORY' | 'COMPUTER' | 'OTHER';

export type TrainingStatus = 'CURRENT' | 'DUE_SOON' | 'EXPIRED' | 'PENDING';

export interface UserSnap { id: string; full_name: string; username: string; }

export interface TrainingRecord {
  id: string;
  record_number: string;
  training_type: TrainingType;
  title: string;
  description: string | null;
  reference_doc: string | null;
  training_date: string;
  expiry_date: string | null;
  passed: boolean | null;
  score: number | null;
  notes: string | null;
  status: TrainingStatus;
  created_at: string;
  updated_at: string;
  trainee: UserSnap;
  trainer: UserSnap | null;
  trainer_name: string | null;
  created_by: UserSnap;
}

export interface TrainingList {
  items: TrainingRecord[];
  total: number;
  page: number;
  size: number;
}

export interface MatrixCell {
  record_id: string | null;
  status: TrainingStatus | null;
  title: string | null;
  training_date: string | null;
  expiry_date: string | null;
}

export interface MatrixRow {
  training_type: TrainingType;
  label: string;
  operators: Record<string, MatrixCell>;
}

export interface QualificationMatrix {
  operators: UserSnap[];
  rows: MatrixRow[];
  summary: Record<string, { current: number; due_soon: number; expired: number; pending: number; total: number }>;
}

export interface DueSoonSummary {
  due_soon: { record_number: string; title: string; trainee: string; expiry_date: string; days_remaining: number }[];
  expired_count: number;
  due_soon_count: number;
}

export const trainingApi = {
  list: (params?: { page?: number; size?: number; trainee_id?: string; training_type?: string; status?: string; search?: string }) =>
    client.get<TrainingList>('/training', { params }).then(r => r.data),

  my: () =>
    client.get<TrainingList>('/training/my').then(r => r.data),

  dueSoon: (days = 30) =>
    client.get<DueSoonSummary>('/training/due-soon', { params: { days } }).then(r => r.data),

  matrix: () =>
    client.get<QualificationMatrix>('/training/matrix').then(r => r.data),

  get: (id: string) =>
    client.get<TrainingRecord>(`/training/${id}`).then(r => r.data),

  create: (data: Partial<TrainingRecord> & { trainee_id: string; training_type: TrainingType; title: string; training_date: string }) =>
    client.post<TrainingRecord>('/training', data).then(r => r.data),

  update: (id: string, data: Partial<TrainingRecord>) =>
    client.put<TrainingRecord>(`/training/${id}`, data).then(r => r.data),

  delete: (id: string) => client.delete(`/training/${id}`),
};

export const TYPE_LABELS: Record<TrainingType, string> = {
  GMP_BASICS:  'GMP Basics',
  SOP:         'SOP Training',
  EQUIPMENT:   'Equipment',
  PROCESS:     'Process',
  SAFETY:      'Safety',
  REGULATORY:  'Regulatory',
  COMPUTER:    'Computer Systems',
  OTHER:       'Other',
};
