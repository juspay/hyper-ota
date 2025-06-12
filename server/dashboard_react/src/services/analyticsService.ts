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

  // Helper method to calculate previous period dates
  private calculatePreviousPeriodDates(currentStartDate: Date, currentEndDate: Date, dateRange: string): { startDate: Date; endDate: Date } {
    const currentDuration = currentEndDate.getTime() - currentStartDate.getTime();
    
    if (dateRange === 'custom') {
      // For custom ranges, go back by the same duration
      const previousEndDate = new Date(currentStartDate.getTime() - 1); // End just before current period starts
      const previousStartDate = new Date(previousEndDate.getTime() - currentDuration);
      return { startDate: previousStartDate, endDate: previousEndDate };
    }
    
    // For preset ranges, calculate standard previous periods
    switch (dateRange) {
      case '1d':
        return {
          startDate: new Date(currentStartDate.getTime() - 24 * 60 * 60 * 1000),
          endDate: new Date(currentEndDate.getTime() - 24 * 60 * 60 * 1000)
        };
      case '7d':
        return {
          startDate: new Date(currentStartDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(currentEndDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
      case '30d':
        return {
          startDate: new Date(currentStartDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(currentEndDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
      default:
        return {
          startDate: new Date(currentStartDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(currentEndDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
    }
  }

  // Method to get adoption metrics with previous period comparison
  async getAdoptionMetricsWithComparison(filters: Partial<AnalyticsFilters>): Promise<{
    current: AdoptionMetrics;
    previous: AdoptionMetrics;
  }> {
    // Get current period data
    const currentMetrics = await this.getAdoptionMetrics(filters);
    
    // Calculate previous period dates
    let currentStartDate: Date;
    let currentEndDate: Date;
    
    if (filters.date_range === 'custom' && filters.start_date && filters.end_date) {
      currentStartDate = filters.start_date;
      currentEndDate = filters.end_date;
    } else {
      // Calculate dates based on date_range
      const now = new Date();
      currentEndDate = now;
      
      switch (filters.date_range) {
        case '1d':
          currentStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          currentStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }
    
    const previousDates = this.calculatePreviousPeriodDates(currentStartDate, currentEndDate, filters.date_range || '7d');
    
    // Create filters for previous period
    const previousFilters = {
      ...filters,
      start_date: previousDates.startDate,
      end_date: previousDates.endDate,
      date_range: 'custom' as const
    };
    
    // Get previous period data
    const previousMetrics = await this.getAdoptionMetrics(previousFilters);
    
    return {
      current: currentMetrics,
      previous: previousMetrics
    };
  }

  // Method to get performance metrics with previous period comparison
  async getPerformanceMetricsWithComparison(filters: Partial<AnalyticsFilters>): Promise<{
    current: PerformanceMetrics;
    previous: PerformanceMetrics;
  }> {
    // Get current period data
    const currentMetrics = await this.getPerformanceMetrics(filters);
    
    // Calculate previous period filters based on the date range
    let previousFilters: Partial<AnalyticsFilters>;
    
    if (filters.date_range === 'custom' && filters.start_date && filters.end_date) {
      const previousDates = this.calculatePreviousPeriodDates(filters.start_date, filters.end_date, 'custom');
      previousFilters = {
        ...filters,
        start_date: previousDates.startDate,
        end_date: previousDates.endDate,
        date_range: 'custom' as const
      };
    } else {
      // For preset ranges, use the same range but for previous period
      const now = new Date();
      let currentStartDate: Date;
      
      switch (filters.date_range) {
        case '1d':
          currentStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          currentStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const previousDates = this.calculatePreviousPeriodDates(currentStartDate, now, filters.date_range || '7d');
      previousFilters = {
        ...filters,
        start_date: previousDates.startDate,
        end_date: previousDates.endDate,
        date_range: 'custom' as const
      };
    }
    
    // Get previous period data
    const previousMetrics = await this.getPerformanceMetrics(previousFilters);
    
    return {
      current: currentMetrics,
      previous: previousMetrics
    };
  }

  // Method to get active devices metrics with previous period comparison
  async getActiveDevicesMetricsWithComparison(filters: Partial<AnalyticsFilters>): Promise<{
    current: ActiveDevicesMetrics;
    previous: ActiveDevicesMetrics;
  }> {
    // Get current period data
    const currentMetrics = await this.getActiveDevicesMetrics(filters);
    
    // For active devices, we need to modify the days parameter for previous period
    let previousFilters: Partial<AnalyticsFilters>;
    
    if (filters.date_range === 'custom' && filters.start_date && filters.end_date) {
      const previousDates = this.calculatePreviousPeriodDates(filters.start_date, filters.end_date, 'custom');
      previousFilters = {
        ...filters,
        start_date: previousDates.startDate,
        end_date: previousDates.endDate,
        date_range: 'custom' as const
      };
    } else {
      // For preset ranges, calculate previous period dates
      const now = new Date();
      let currentStartDate: Date;
      
      switch (filters.date_range) {
        case '1d':
          currentStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          currentStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const previousDates = this.calculatePreviousPeriodDates(currentStartDate, now, filters.date_range || '7d');
      previousFilters = {
        ...filters,
        start_date: previousDates.startDate,
        end_date: previousDates.endDate,
        date_range: 'custom' as const
      };
    }
    
    // Get previous period data
    const previousMetrics = await this.getActiveDevicesMetrics(previousFilters);
    
    return {
      current: currentMetrics,
      previous: previousMetrics
    };
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
