export type DeviationType =
  | 'PROCESS' | 'EQUIPMENT' | 'MATERIAL'
  | 'ENVIRONMENTAL' | 'DOCUMENTATION' | 'OTHER';

export type DeviationSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type DeviationStatus =
  | 'OPEN' | 'UNDER_INVESTIGATION' | 'PENDING_CAPA' | 'RESOLVED' | 'CLOSED';

export type CAPAType = 'CORRECTIVE' | 'PREVENTIVE' | 'BOTH';

export type CAPAStatus =
  | 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'CLOSED';

export interface UserBrief {
  id: string;
  full_name: string;
  username: string;
}

export interface CAPASummary {
  id: string;
  capa_number: string;
  title: string;
  capa_type: CAPAType;
  status: CAPAStatus;
  due_date?: string;
  assigned_to?: UserBrief;
}

export interface DeviationSummary {
  id: string;
  deviation_number: string;
  title: string;
  deviation_type: DeviationType;
  severity: DeviationSeverity;
  status: DeviationStatus;
  batch_number?: string;
  product_name?: string;
  detected_at: string;
  detected_by: UserBrief;
}

export interface Deviation extends DeviationSummary {
  description: string;
  ebr_id?: string;
  ebr_step_id?: string;
  immediate_action?: string;
  root_cause?: string;
  investigation_summary?: string;
  closure_comments?: string;
  investigated_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  investigated_by?: UserBrief;
  closed_by?: UserBrief;
  capas: CAPASummary[];
}

export interface DeviationList {
  items: DeviationSummary[];
  total: number;
  page: number;
  size: number;
}

export interface DeviationBrief {
  id: string;
  deviation_number: string;
  title: string;
  severity: DeviationSeverity;
  batch_number?: string;
}

export interface CAPAOut {
  id: string;
  capa_number: string;
  deviation_id: string;
  title: string;
  description: string;
  capa_type: CAPAType;
  status: CAPAStatus;
  due_date?: string;
  completion_notes?: string;
  effectiveness_check?: string;
  completed_at?: string;
  verified_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  deviation: DeviationBrief;
  assigned_to?: UserBrief;
  completed_by?: UserBrief;
  verified_by?: UserBrief;
  closed_by?: UserBrief;
  created_by: UserBrief;
}

export interface CAPAList {
  items: CAPAOut[];
  total: number;
  page: number;
  size: number;
}
