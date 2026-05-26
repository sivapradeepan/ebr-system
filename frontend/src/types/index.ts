export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: Permission[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  department?: string;
  employee_id?: string;
  is_active: boolean;
  is_locked: boolean;
  last_login?: string;
  created_at: string;
  roles: Role[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  roles: { id: string; name: string }[];
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE'
  | 'ACCOUNT_LOCKED' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'
  | 'APPROVE' | 'REJECT' | 'SIGN' | 'PRINT' | 'EXPORT';

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  username?: string;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  description?: string;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string;
  status: 'SUCCESS' | 'FAILURE';
}
