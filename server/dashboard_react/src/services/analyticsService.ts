// import axios from '../api/axios';
import { filter } from 'framer-motion/client';
import { 
  AdoptionMetrics, 
  VersionDistribution, 
  PerformanceMetrics, 
  ActiveDevicesMetrics, 
  FailureMetrics,
  AnalyticsResponse,
  AnalyticsFilters 
} from '../types/analytics';

// Analytics service to interact with the analytics microservice
class AnalyticsService {
  private baseURL = 'http://0.0.0.0:6400'; // Analytics service URL

  private buildQueryParams(filters: Partial<AnalyticsFilters>): string {
    filters.app_id = "zepto";
    filters.tenant_id = "zepto";
    filters.org_id = "zepto";
    filters.release_id = "release_6677";
    const params = new URLSearchParams();
    
    if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
    if (filters.org_id) params.append('org_id', filters.org_id);
    if (filters.app_id) params.append('app_id', filters.app_id);
    if (filters.release_id) params.append('release_id', filters.release_id);
    if (filters.interval) params.append('interval', filters.interval);
    
    // Handle date range
    if (filters.date_range === 'custom' && filters.start_date && filters.end_date) {
      params.append('start_date', filters.start_date.getTime().toString());
      params.append('end_date', filters.end_date.getTime().toString());
    } else if (filters.date_range) {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.date_range) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      params.append('start_date', startDate.getTime().toString());
      params.append('end_date', now.getTime().toString());
    }
    
    return params.toString();
  }

  async getAdoptionMetrics(filters: Partial<AnalyticsFilters>): Promise<AdoptionMetrics> {
    const queryParams = this.buildQueryParams(filters);
    const response = await fetch(`${this.baseURL}/analytics/adoption?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch adoption metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<AdoptionMetrics> = await response.json();
    return data.data;
  }

  async getVersionDistribution(filters: Partial<AnalyticsFilters>): Promise<VersionDistribution> {
    const queryParams = this.buildQueryParams(filters);
    const response = await fetch(`${this.baseURL}/analytics/versions?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch version distribution: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<VersionDistribution[]> = await response.json();
    // Return the first item from the array, or create a default structure if empty
    return data.data.length > 0 ? data.data[0] : {
      tenant_id: filters.tenant_id || '',
      org_id: filters.org_id || '',
      app_id: filters.app_id || '',
      versions: [],
      total_devices: 0
    };
  }

  async getPerformanceMetrics(filters: Partial<AnalyticsFilters>): Promise<PerformanceMetrics> {
    const queryParams = this.buildQueryParams(filters);
    const response = await fetch(`${this.baseURL}/analytics/performance?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<PerformanceMetrics> = await response.json();
    return data.data;
  }

  async getActiveDevicesMetrics(filters: Partial<AnalyticsFilters>): Promise<ActiveDevicesMetrics> {
    const queryParams = this.buildQueryParams(filters);
    const response = await fetch(`${this.baseURL}/analytics/active-devices?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch active devices metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<ActiveDevicesMetrics> = await response.json();
    return data.data;
  }

  async getFailureMetrics(filters: Partial<AnalyticsFilters>): Promise<FailureMetrics> {
    const queryParams = this.buildQueryParams(filters);
    const response = await fetch(`${this.baseURL}/analytics/failures?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch failure metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<FailureMetrics> = await response.json();
    return data.data;
  }

  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseURL}/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
