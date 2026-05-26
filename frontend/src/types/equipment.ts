export type EquipmentStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'UNDER_MAINTENANCE'
  | 'CALIBRATION_DUE'
  | 'RETIRED';

export type CleaningStatus =
  | 'CLEAN'
  | 'DIRTY'
  | 'SANITIZED'
  | 'STERILIZED'
  | 'IN_USE'
  | 'QUARANTINE'
  | 'CLEANING_IN_PROGRESS'
  | 'AWAITING_VERIFICATION';

export type MaterialType =
  | 'API'
  | 'EXCIPIENT'
  | 'PACKAGING'
  | 'SOLVENT'
  | 'REAGENT'
  | 'OTHER';

export type MaterialStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface UserBrief {
  id: string;
  full_name: string;
  username: string;
}

export interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
  category: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  location?: string;
  status: EquipmentStatus;
  last_calibration_date?: string;
  calibration_due_date?: string;
  calibration_certificate?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  maintenance_interval_days?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: UserBrief;
  cleaning_status: CleaningStatus;
  cleaning_status_updated_at?: string;
}

export interface EquipmentList {
  items: Equipment[];
  total: number;
  page: number;
  size: number;
}

export interface Material {
  id: string;
  material_code: string;
  name: string;
  material_type: MaterialType;
  cas_number?: string;
  pharmacopoeia_standard?: string;
  grade?: string;
  supplier_name?: string;
  supplier_code?: string;
  manufacturer_name?: string;
  unit_of_measure: string;
  storage_conditions?: string;
  shelf_life_days?: number;
  reorder_point?: string;
  notes?: string;
  status: MaterialStatus;
  created_at: string;
  updated_at: string;
  created_by?: UserBrief;
}

export interface MaterialList {
  items: Material[];
  total: number;
  page: number;
  size: number;
}
