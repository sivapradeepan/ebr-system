export type EBRStatus = 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type EBRStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface UserBrief { id: string; username: string; full_name: string; }

export interface EBRParameterResult {
  id: string;
  parameter_name: string;
  unit?: string;
  target_value?: string;
  min_value?: string;
  max_value?: string;
  is_critical: boolean;
  actual_value?: string;
  is_in_range?: boolean;
  recorded_by?: UserBrief;
  recorded_at?: string;
  notes?: string;
}

export interface EBRIPQCResult {
  id: string;
  test_name: string;
  method?: string;
  acceptance_criteria: string;
  frequency?: string;
  responsible_role?: string;
  actual_result?: string;
  passed?: boolean;
  performed_by?: UserBrief;
  performed_at?: string;
  notes?: string;
}

export interface EBRStep {
  id: string;
  step_number: number;
  title: string;
  description?: string;
  is_critical: boolean;
  expected_duration_minutes?: number;
  expected_yield?: number;
  yield_unit?: string;
  notes_template?: string;
  order: number;
  status: EBRStepStatus;
  started_at?: string;
  completed_at?: string;
  actual_yield?: number;
  operator?: UserBrief;
  operator_signed_at?: string;
  execution_notes?: string;
  parameter_results: EBRParameterResult[];
  ipqc_results: EBRIPQCResult[];
}

export interface EBRMaterialDispensing {
  id: string;
  material_name: string;
  material_code?: string;
  required_quantity: number;
  unit: string;
  grade?: string;
  is_active_ingredient: boolean;
  order: number;
  actual_quantity?: number;
  lot_number?: string;
  expiry_date?: string;
  dispensed_by?: UserBrief;
  dispensed_at?: string;
  is_dispensed: boolean;
  notes?: string;
}

export interface EBRSummary {
  id: string;
  ebr_number: string;
  batch_number: string;
  mbr_number: string;
  mbr_version: string;
  product_name: string;
  product_code: string;
  strength?: string;
  dosage_form?: string;
  status: EBRStatus;
  planned_batch_size?: number;
  batch_unit?: string;
  actual_yield?: number;
  actual_yield_unit?: string;
  yield_percentage?: number;
  initiated_by: UserBrief;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EBRDetail extends EBRSummary {
  notes?: string;
  reviewed_by?: UserBrief;
  reviewed_at?: string;
  approved_by?: UserBrief;
  approved_at?: string;
  steps: EBRStep[];
  materials: EBRMaterialDispensing[];
}
