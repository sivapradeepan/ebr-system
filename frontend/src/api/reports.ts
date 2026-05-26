import client from './client';

export interface AnalyticsData {
  yield_trend: { batch_number: string; product_name: string; yield_percentage: number; completed_at: string | null; status: string }[];
  status_breakdown: { status: string; label: string; count: number }[];
  monthly_throughput: { month: string; initiated: number; released: number }[];
  ipqc: { total: number; passed: number; failed: number; pending: number; pass_rate: number | null };
  parameters: { total: number; in_range: number; out_of_range: number; pass_rate: number | null };
  deviations_by_severity: { severity: string; open: number; closed: number; total: number }[];
  top_products: { product: string; batches: number }[];
}

export interface DashboardStats {
  active_batches: number;
  pending_review: number;
  released_this_month: number;
  open_deviations: number;
  recent_batches: {
    id: string;
    ebr_number: string;
    batch_number: string;
    product_name: string;
    status: string;
    updated_at: string | null;
  }[];
}

export const reportsApi = {
  dashboardStats: () =>
    client.get<DashboardStats>('/reports/dashboard').then(r => r.data),

  downloadEbrPdf: (ebrId: string) =>
    client.get(`/reports/ebr/${ebrId}/pdf`, { responseType: 'blob' }).then(r => r.data),

  downloadCertificate: (ebrId: string) =>
    client.get(`/reports/ebr/${ebrId}/certificate`, { responseType: 'blob' }).then(r => r.data),

  analytics: () =>
    client.get<AnalyticsData>('/reports/analytics').then(r => r.data),
};

/** Trigger a file download from a Blob in the browser */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
