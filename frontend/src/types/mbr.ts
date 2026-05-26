export type MBRStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'EFFECTIVE' | 'SUPERSEDED' | 'OBSOLETE';

export interface MBRStepParameter {
  id?: string;
  name: string;
  unit?: string;
  target_value?: string;
  min_value?: string;
  max_value?: string;
  is_critical: boolean;
  notes?: string;
}

export interface MBRStepIPQC {
  id?: string;
  test_name: string;
  method?: string;
  acceptance_criteria: string;
  frequency?: string;
  responsible_role?: string;
  notes?: string;
}

export interface MBRStep {
  id?: string;
  step_number: number;
  title: string;
  description?: string;
  expected_duration_minutes?: number;
  expected_yield?: number;
  yield_unit?: string;
  is_critical: boolean;
  notes?: string;
  order: number;
  parameters: MBRStepParameter[];
  ipqcs: MBRStepIPQC[];
}

export interface MBRMaterial {
  id?: string;
  material_name: string;
  material_code?: string;
  quantity: number;
  unit: string;
  grade?: string;
  is_active_ingredient: boolean;
  supplier?: string;
  notes?: string;
  order: number;
}

export interface MBREquipment {
  id?: string;
  equipment_name: string;
  equipment_code?: string;
  capacity?: string;
  notes?: string;
  order: number;
}

export interface UserBrief {
  id: string;
  username: string;
  full_name: string;
}

export interface MBRSummary {
  id: string;
  mbr_number: string;
  version: string;
  title: string;
  product_name: string;
  product_code: string;
  dosage_form?: string;
  strength?: string;
  batch_size?: number;
  batch_unit?: string;
  status: MBRStatus;
  effective_date?: string;
  created_by: UserBrief;
  approved_by?: UserBrief;
  created_at: string;
  updated_at: string;
}

export interface MBRDetail extends MBRSummary {
  description?: string;
  storage_conditions?: string;
  manufacturing_site?: string;
  theoretical_yield?: number;
  yield_unit?: string;
  expiry_date?: string;
  notes?: string;
  approved_at?: string;
  parent_mbr_id?: string;
  materials: MBRMaterial[];
  equipment: MBREquipment[];
  steps: MBRStep[];
}

export interface MBRFormData {
  title: string;
  product_name: string;
  product_code: string;
  dosage_form?: string;
  strength?: string;
  batch_size?: number;
  batch_unit?: string;
  theoretical_yield?: number;
  yield_unit?: string;
  description?: string;
  storage_conditions?: string;
  manufacturing_site?: string;
  notes?: string;
  materials: Omit<MBRMaterial, 'id' | 'order'>[];
  equipment: Omit<MBREquipment, 'id' | 'order'>[];
  steps: Omit<MBRStep, 'id' | 'order'>[];
}
