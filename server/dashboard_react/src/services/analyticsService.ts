// import axios from '../api/axios';
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

  private buildQueryParams(filters: Partial<AnalyticsFilters>, endpoint?: string): string {
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
    
    // Handle date/days parameters based on endpoint
    if (endpoint === 'active-devices' || endpoint === 'performance') {
      // Use days parameter for active-devices and performance endpoints
      let days: number;
      switch (filters.date_range) {
        case '1d':
          days = 1;
          break;
        case '7d':
          days = 7;
          break;
        case '30d':
          days = 30;
          break;
        default:
          days = 7;
      }
      params.append('days', days.toString());
    } else {
      // Handle date range - Always send date params for HOURLY interval or when explicitly provided
      const shouldSendDateParams = filters.interval === 'HOUR' || 
                                   filters.date_range === 'custom' || 
                                   filters.start_date || 
                                   filters.end_date;
      
      if (shouldSendDateParams) {
        let startDate: Date;
        let endDate: Date;
        
        if (filters.date_range === 'custom' && filters.start_date && filters.end_date) {
          startDate = filters.start_date;
          endDate = filters.end_date;
        } else if (filters.start_date && filters.end_date) {
          startDate = filters.start_date;
          endDate = filters.end_date;
        } else {
          // Calculate dates based on date_range
          const now = new Date();
          endDate = now;
          
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
        }
        
        // Convert to milliseconds and append to params
        params.append('start_date', startDate.getTime().toString());
        params.append('end_date', endDate.getTime().toString());
        params.append('date', endDate.getTime().toString());
      }
    }
    
    return params.toString();
  }

  async getAdoptionMetrics(filters: Partial<AnalyticsFilters>): Promise<AdoptionMetrics> {
    // For hourly data (Last 24 Hours), make two requests to get complete data
    if (filters.interval === 'HOUR' && filters.date_range === '1d') {
      return this.getHourlyAdoptionMetricsLast24Hours(filters);
    }
    
    const queryParams = this.buildQueryParams(filters, 'adoption');
    const response = await fetch(`${this.baseURL}/analytics/adoption?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch adoption metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<AdoptionMetrics> = await response.json();
    return data.data;
  }

  private async getHourlyAdoptionMetricsLast24Hours(filters: Partial<AnalyticsFilters>): Promise<AdoptionMetrics> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get current date and previous date in local timezone
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const previousDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    
    // Create filters for both days
    const currentDayFilters = {
      ...filters,
      start_date: currentDate,
      end_date: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000 - 1), // End of current day
      date_range: 'custom' as const
    };
    
    const previousDayFilters = {
      ...filters,
      start_date: previousDate,
      end_date: new Date(previousDate.getTime() + 24 * 60 * 60 * 1000 - 1), // End of previous day
      date_range: 'custom' as const
    };
    
    // Make both requests
    const [currentDayResponse, previousDayResponse] = await Promise.all([
      this.makeSingleAdoptionRequest(currentDayFilters),
      this.makeSingleAdoptionRequest(previousDayFilters)
    ]);
    
    // Combine and filter the data
    const allTimeBreakdown = [
      ...(previousDayResponse.time_breakdown || []),
      ...(currentDayResponse.time_breakdown || [])
    ];
    
    // Filter to get only the last 24 hours of data
    const filteredTimeBreakdown = allTimeBreakdown.filter(item => {
      const itemTime = new Date(item.time_slot);
      return itemTime >= twentyFourHoursAgo && itemTime <= now;
    });
    
    // Sort by time_slot to ensure proper ordering
    filteredTimeBreakdown.sort((a, b) => new Date(a.time_slot).getTime() - new Date(b.time_slot).getTime());
    
    return {
      tenant_id: filters.tenant_id || '',
      org_id: filters.org_id || '',
      app_id: filters.app_id || '',
      release_id: filters.release_id || '',
      time_breakdown: filteredTimeBreakdown
    };
  }
  
  private async makeSingleAdoptionRequest(filters: Partial<AnalyticsFilters>): Promise<AdoptionMetrics> {
    const queryParams = this.buildQueryParams(filters, 'adoption');
    const response = await fetch(`${this.baseURL}/analytics/adoption?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch adoption metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<AdoptionMetrics> = await response.json();
    return data.data;
  }

  async getVersionDistribution(filters: Partial<AnalyticsFilters>): Promise<VersionDistribution> {
    const queryParams = this.buildQueryParams(filters, 'versions');
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
    const queryParams = this.buildQueryParams(filters, 'performance');
    const response = await fetch(`${this.baseURL}/analytics/performance?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch performance metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<PerformanceMetrics> = await response.json();
    return data.data;
  }

  async getActiveDevicesMetrics(filters: Partial<AnalyticsFilters>): Promise<ActiveDevicesMetrics> {
    // No need for special hourly handling for active devices - it uses days parameter
    const queryParams = this.buildQueryParams(filters, 'active-devices');
    const response = await fetch(`${this.baseURL}/analytics/active-devices?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch active devices metrics: ${response.statusText}`);
    }
    
    const data: AnalyticsResponse<ActiveDevicesMetrics> = await response.json();
    return data.data;
  }

  async getFailureMetrics(filters: Partial<AnalyticsFilters>): Promise<FailureMetrics> {
    const queryParams = this.buildQueryParams(filters, 'failures');
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
