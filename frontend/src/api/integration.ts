import client from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IDocConnStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';
export type IDocDirection = 'INBOUND' | 'OUTBOUND';
export type IDocStatus = 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'ERROR' | 'IGNORED';
export type IDocType = 'MATMAS' | 'PRODORD' | 'BATCHA' | 'ZMBR_OUT' | 'LOIPRO' | 'MBGMCR' | 'OTHER';

export type OPCConnStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'CONNECTING';
export type OPCSecurityMode = 'NONE' | 'SIGN' | 'SIGN_AND_ENCRYPT';
export type OPCDataType = 'Boolean' | 'Int16' | 'Int32' | 'Int64' | 'Float' | 'Double' | 'String' | 'DateTime';

export interface IDocConnection {
  id: string;
  name: string;
  description?: string;
  sap_host: string;
  sap_system_number: string;
  sap_client: string;
  sap_user: string;
  rfc_destination?: string;
  partner_number?: string;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  auto_process: boolean;
  simulation_mode: boolean;
  status: IDocConnStatus;
  last_connected_at?: string;
  last_error?: string;
  is_active: boolean;
  created_at: string;
  message_count: number;
}

export interface IDocMessage {
  id: string;
  connection_id: string;
  direction: IDocDirection;
  idoc_type: IDocType;
  idoc_number?: string;
  message_type?: string;
  status: IDocStatus;
  error_message?: string;
  retry_count: number;
  reference_type?: string;
  reference_id?: string;
  payload?: any;
  processed_at?: string;
  created_at: string;
}

export interface OPCServer {
  id: string;
  name: string;
  description?: string;
  endpoint_url: string;
  security_mode: OPCSecurityMode;
  username?: string;
  polling_interval_ms: number;
  connection_timeout_s: number;
  simulation_mode: boolean;
  status: OPCConnStatus;
  last_connected_at?: string;
  last_error?: string;
  is_active: boolean;
  created_at: string;
  tag_count: number;
}

export interface OPCTag {
  id: string;
  server_id: string;
  node_id: string;
  display_name: string;
  description?: string;
  data_type: OPCDataType;
  unit?: string;
  current_value?: string;
  quality?: string;
  last_updated?: string;
  high_limit?: number;
  low_limit?: number;
  is_active: boolean;
  created_at: string;
}

export interface OPCEBRMapping {
  id: string;
  tag_id: string;
  mbr_id?: string;
  step_title?: string;
  parameter_name: string;
  auto_fill: boolean;
  transform_formula?: string;
  is_active: boolean;
  created_at: string;
}

export interface OPCEquipmentMapping {
  id: string;
  tag_id: string;
  equipment_id: string;
  log_field: string;
  log_type?: string;
  auto_fill: boolean;
  transform_formula?: string;
  is_active: boolean;
  created_at: string;
}

// ── IDoc API ─────────────────────────────────────────────────────────────────

export const idocApi = {
  listConnections: (params?: any) =>
    client.get('/integrations/idoc/connections', { params }).then(r => r.data),
  createConnection: (data: any) =>
    client.post('/integrations/idoc/connections', data).then(r => r.data),
  updateConnection: (id: string, data: any) =>
    client.patch(`/integrations/idoc/connections/${id}`, data).then(r => r.data),
  deleteConnection: (id: string) =>
    client.delete(`/integrations/idoc/connections/${id}`),
  testConnection: (id: string) =>
    client.post(`/integrations/idoc/connections/${id}/test`).then(r => r.data),
  simulateInbound: (id: string, idoc_type: string, count: number) =>
    client.post(`/integrations/idoc/connections/${id}/simulate-inbound`, null, { params: { idoc_type, count } }).then(r => r.data),
  processQueue: (id: string) =>
    client.post(`/integrations/idoc/connections/${id}/process-queue`).then(r => r.data),

  listMessages: (params?: any) =>
    client.get('/integrations/idoc/messages', { params }).then(r => r.data),
  retryMessage: (id: string) =>
    client.post(`/integrations/idoc/messages/${id}/retry`).then(r => r.data),
  deleteMessage: (id: string) =>
    client.delete(`/integrations/idoc/messages/${id}`),
};

// ── OPC API ───────────────────────────────────────────────────────────────────

export const opcApi = {
  listServers: (params?: any) =>
    client.get('/integrations/opc/servers', { params }).then(r => r.data),
  createServer: (data: any) =>
    client.post('/integrations/opc/servers', data).then(r => r.data),
  updateServer: (id: string, data: any) =>
    client.patch(`/integrations/opc/servers/${id}`, data).then(r => r.data),
  deleteServer: (id: string) =>
    client.delete(`/integrations/opc/servers/${id}`),
  connectServer: (id: string) =>
    client.post(`/integrations/opc/servers/${id}/connect`).then(r => r.data),
  disconnectServer: (id: string) =>
    client.post(`/integrations/opc/servers/${id}/disconnect`).then(r => r.data),
  simulateTags: (id: string) =>
    client.post(`/integrations/opc/servers/${id}/simulate-tags`).then(r => r.data),
  refreshAll: (id: string) =>
    client.post(`/integrations/opc/servers/${id}/refresh-all`).then(r => r.data),

  listTags: (params?: any) =>
    client.get('/integrations/opc/tags', { params }).then(r => r.data),
  createTag: (data: any) =>
    client.post('/integrations/opc/tags', data).then(r => r.data),
  updateTag: (id: string, data: any) =>
    client.patch(`/integrations/opc/tags/${id}`, data).then(r => r.data),
  deleteTag: (id: string) =>
    client.delete(`/integrations/opc/tags/${id}`),
  refreshTag: (id: string) =>
    client.post(`/integrations/opc/tags/${id}/refresh`).then(r => r.data),
  tagHistory: (id: string, limit = 50) =>
    client.get(`/integrations/opc/tags/${id}/history`, { params: { limit } }).then(r => r.data),

  listMappings: (params?: any) =>
    client.get('/integrations/opc/mappings', { params }).then(r => r.data),
  createMapping: (data: any) =>
    client.post('/integrations/opc/mappings', data).then(r => r.data),
  deleteMapping: (id: string) =>
    client.delete(`/integrations/opc/mappings/${id}`),

  listEquipmentMappings: (params?: any) =>
    client.get('/integrations/opc/equipment-mappings', { params }).then(r => r.data),
  createEquipmentMapping: (data: any) =>
    client.post('/integrations/opc/equipment-mappings', data).then(r => r.data),
  updateEquipmentMapping: (id: string, data: any) =>
    client.patch(`/integrations/opc/equipment-mappings/${id}`, data).then(r => r.data),
  deleteEquipmentMapping: (id: string) =>
    client.delete(`/integrations/opc/equipment-mappings/${id}`),
  autofillEquipmentLog: (equipment_id: string, log_type?: string) =>
    client.get(`/integrations/opc/equipment-mappings/${equipment_id}/autofill`, { params: { log_type } }).then(r => r.data),
};
