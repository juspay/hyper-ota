// Analytics types based on the API responses

export interface AnalyticsTimeSeriesData {
  time_slot: string;
  download_success: number;
  download_failures: number;
  apply_success: number;
  apply_failures: number;
  rollbacks_initiated: number;
  rollbacks_completed: number;
  rollback_failures: number;
  update_checks: number;
  update_available: number;
}

export interface AdoptionMetrics {
  tenant_id: string;
  org_id: string;
  app_id: string;
  release_id: string;
  time_breakdown: AnalyticsTimeSeriesData[];
}

export interface VersionDistribution {
  tenant_id: string;
  org_id: string;
  app_id: string;
  versions: {
    js_version: string;
    device_count: number;
    percentage: number;
  }[];
  total_devices: number;
}

export interface PerformanceMetrics {
  tenant_id: string;
  org_id: string;
  app_id: string;
  release_id?: string;
  avg_download_time_ms: number;
  avg_apply_time_ms: number;
  avg_download_size_bytes: number;
}

export interface ActiveDevicesMetrics {
  tenant_id: string;
  org_id: string;
  app_id: string;
  total_active_devices: number;
  daily_breakdown: {
    date: string;
    active_devices: number;
  }[];
}

export interface FailureMetrics {
  tenant_id: string;
  org_id: string;
  app_id: string;
  release_id?: string;
  total_failures: number;
  failure_rate: number;
  failures_by_type: {
    error_code: string;
    count: number;
    percentage: number;
  }[];
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export type DateRange = '1d' | '7d' | '30d' | 'custom';

export interface AnalyticsFilters {
  tenant_id: string;
  org_id: string;
  app_id: string;
  release_id?: string;
  date_range: DateRange;
  start_date?: Date;
  end_date?: Date;
  interval?: 'HOUR' | 'DAY';
}

export interface MetricCard {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType;
  unit?: string;
}
