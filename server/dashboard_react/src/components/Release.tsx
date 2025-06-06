import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import ReactJson from "@uiw/react-json-view";
import axios from "../api/axios";
import ReleaseHistory from "./release/ReleaseHistory";
import { MetricGrid } from "./analytics/MetricCards";
import { 
  AdoptionChart,
  PerformanceChart,
  TimeToAdoptionChart,
  RollbackChart
} from "./analytics/Charts";
import { analyticsService } from "../services/analyticsService";
import { Package, Settings, Calendar, Eye, EyeOff, Loader2, AlertCircle, RefreshCw, BarChart3, Download, CheckCircle, RotateCcw, Clock, TrendingUp, Smartphone } from "lucide-react";
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import Datepicker from "react-tailwindcss-datepicker";


interface ReleaseConfig {
  config: {
    version: string;
    release_config_timeout: number;
    package_timeout: number;
    properties: {
      tenant_info: {
        assets_domain: string;
        default_client_id: string;
      };
    };
  };
  package: {
    name: string;
    version: string;
    properties: {
      manifest: Record<string, any>;
      manifest_hash: Record<string, any>;
    };
    index: string;
    important: Array<{
      url: string;
      file_path: string;
    }>;
    lazy: Array<{
      url: string;
      file_path: string;
    }>;
  };
}

interface AdoptionData {
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

interface PerformanceData {
  total_devices: number;
  check_for_update_rate: number;
  update_available_rate: number;
  download_success_rate: number;
  download_failure_rate: number;
  apply_success_rate: number;
  apply_failure_rate: number;
  rollback_rate: number;
  average_download_time: number;
  average_apply_time: number;
  changes?: {
    total_devices: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    download_success_rate: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    download_failure_rate: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    apply_success_rate: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    apply_failure_rate: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    rollback_rate: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    average_download_time: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
    average_apply_time: { change: number; changeType: 'positive' | 'negative' | 'neutral' };
  };
}

const Release: React.FC = () => {
  const { org, app } = useParams<{ org: string; app: string }>();
  const [loading, setLoading] = useState(true);
  const [releaseData, setReleaseData] = useState<ReleaseConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  
  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [adoptionData, setAdoptionData] = useState<AdoptionData[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d'>('7d');
  const [userTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Custom date picker state
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null,
    isCustom: false
  });
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowCustomDatePicker(false);
      }
    };

    if (showCustomDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomDatePicker]);

  // Helper functions for custom date range (removed duplicates)

  // Utility function to convert UTC time_slot to user timezone
  const convertToUserTimezone = (utcTimeSlot: string, userTimezone: string): string => {
    try {
      const utcDate = new Date(utcTimeSlot);
      return utcDate.toLocaleString('en-CA', { 
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(', ', 'T');
    } catch (error) {
      console.warn('Failed to convert timezone for:', utcTimeSlot, error);
      return utcTimeSlot; // fallback to original
    }
  };

  // Helper function to calculate percentage change
  const calculatePercentageChange = (current: number, previous: number): { change: number; changeType: 'positive' | 'negative' | 'neutral' } => {
    if (previous === 0) {
      if (current === 0) {
        return { change: 0, changeType: 'neutral' };
      }
      return { change: 100, changeType: 'positive' };
    }
    
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 0.1) {
      return { change: 0, changeType: 'neutral' };
    }
    
    return {
      change: Math.abs(change),
      changeType: change > 0 ? 'positive' : 'negative'
    };
  };

  // Helper function to determine if higher is better for a metric
  const isHigherBetter = (metricType: string): boolean => {
    const higherIsBetter = [
      'total_devices',
      'download_success_rate',
      'apply_success_rate',
      'update_available_rate'
    ];
    
    const lowerIsBetter = [
      'download_failure_rate',
      'apply_failure_rate',
      'rollback_rate',
      'average_download_time',
      'average_apply_time'
    ];
    
    if (higherIsBetter.includes(metricType)) return true;
    if (lowerIsBetter.includes(metricType)) return false;
    return true; // default to higher is better
  };

  // Helper function to get change type considering if higher is better
  const getChangeTypeForMetric = (current: number, previous: number, metricType: string): { change: number; changeType: 'positive' | 'negative' | 'neutral' } => {
    const rawChange = calculatePercentageChange(current, previous);
    
    if (rawChange.changeType === 'neutral') {
      return rawChange;
    }
    
    const higherBetter = isHigherBetter(metricType);
    
    if (higherBetter) {
      return rawChange; // Keep original: positive = good, negative = bad
    } else {
      // Invert: positive change in bad metrics = bad, negative change = good
      return {
        change: rawChange.change,
        changeType: rawChange.changeType === 'positive' ? 'negative' : 'positive'
      };
    }
  };

  // Custom date picker utility functions
  const formatDateRange = (startDate: Date, endDate: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
    };
    
    if (startDate.toDateString() === endDate.toDateString()) {
      return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }
    
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  const isSingleDay = (startDate: Date, endDate: Date): boolean => {
    return startDate.toDateString() === endDate.toDateString();
  };

  // Helper function to determine chart interval based on current date range
  const getChartInterval = (): 'HOUR' | 'DAY' => {
    if (customDateRange.isCustom && customDateRange.startDate && customDateRange.endDate) {
      // For custom ranges, use hourly if it's a single day, otherwise daily
      return isSingleDay(customDateRange.startDate, customDateRange.endDate) ? 'HOUR' : 'DAY';
    } else {
      // For preset ranges, only 1d uses hourly
      return dateRange === '1d' ? 'HOUR' : 'DAY';
    }
  };

  const handleCustomDateChange = (value: { startDate: Date | null; endDate: Date | null }) => {
    setDateRangeError(null);
    
    console.log('Custom date change:', {
      startDate: value.startDate,
      endDate: value.endDate,
      startDateISO: value.startDate?.toISOString(),
      endDateISO: value.endDate?.toISOString()
    });
    
    if (value.startDate && value.endDate) {
      // Check if start date is after end date
      if (value.startDate > value.endDate) {
        setDateRangeError('Start date cannot be after end date');
        return;
      }
      
      // Check 3-month limit
      const diffInMonths = (value.endDate.getFullYear() - value.startDate.getFullYear()) * 12 + 
                           (value.endDate.getMonth() - value.startDate.getMonth());
      
      if (diffInMonths > 3) {
        setDateRangeError('Date range cannot exceed 3 months');
        return;
      }
      
      // Create proper date objects with start of day for startDate and end of day for endDate
      const normalizedStartDate = new Date(value.startDate);
      normalizedStartDate.setHours(0, 0, 0, 0); // Start of day
      
      const normalizedEndDate = new Date(value.endDate);
      normalizedEndDate.setHours(23, 59, 59, 999); // End of day
      
      console.log('Normalized dates:', {
        normalizedStartDate: normalizedStartDate.toISOString(),
        normalizedEndDate: normalizedEndDate.toISOString()
      });
      
      // Automatically apply the custom date range when both dates are selected
      setCustomDateRange({
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        isCustom: true
      });
      
      // Close the picker
      setShowCustomDatePicker(false);
      
      // Trigger analytics refresh with custom date range
      if (releaseData && showAnalytics) {
        fetchAnalyticsData();
      }
    } else {
      // Update the temporary state while user is selecting dates
      setCustomDateRange({
        startDate: value.startDate,
        endDate: value.endDate,
        isCustom: false
      });
    }
  };

  const fetchReleaseData = useCallback(async (version?: number) => {
    try {
      setLoading(true);
      let url = `/release/v2/${org}/${app}`;
      if (version) {
        url += `?version=${version}`;
      }
      const { data } = await axios.get(url);
      setReleaseData(data);
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to fetch release data");
    } finally {
      setLoading(false);
    }
  }, [org, app]);

  const fetchAnalyticsData = useCallback(async () => {
    if (!releaseData?.package?.version || !org || !app) return;
    
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      // Determine interval and dates based on selected range
      let interval: 'HOUR' | 'DAY';
      let startDate: Date;
      let endDate: Date;
      let effectiveDateRange: '1d' | '7d' | '30d' | 'custom';

      if (customDateRange.isCustom && customDateRange.startDate && customDateRange.endDate) {
        // Handle custom date range
        startDate = new Date(customDateRange.startDate);
        endDate = new Date(customDateRange.endDate);
        
        // Set end date to end of day (23:59:59) to include the full day
        endDate.setHours(23, 59, 59, 999);
        
        // Check if it's a single day
        const isSingle = isSingleDay(customDateRange.startDate, customDateRange.endDate);
        interval = isSingle ? 'HOUR' : 'DAY';
        effectiveDateRange = 'custom';
      } else {
        // Handle preset date ranges
        interval = dateRange === '1d' ? 'HOUR' : 'DAY';
        const now = new Date();
        endDate = now;
        effectiveDateRange = dateRange;

        switch (dateRange) {
          case '1d':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
            break;
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            break;
          default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      }

      // Prepare filters for analytics service
      const filters = {
        tenant_id: "default", // You may want to get this from context or props
        org_id: org,
        app_id: app,
        release_id: releaseData.package.version,
        date_range: effectiveDateRange,
        start_date: startDate,
        end_date: endDate,
        interval: interval
      };

      // Check if analytics service is available
      try {
        await analyticsService.checkHealth();
      } catch (healthError) {
        throw new Error("Analytics service is unavailable. Please check if the analytics microservice is running.");
      }

      // Fetch adoption metrics with comparison using analytics service
      const adoptionComparison = await analyticsService.getAdoptionMetricsWithComparison(filters);
      
      // Convert timezone for adoption data if needed (for hourly data)
      let processedAdoptionData = adoptionComparison.current.time_breakdown || [];
      if (interval === 'HOUR' && processedAdoptionData.length > 0) {
        processedAdoptionData = processedAdoptionData.map(item => ({
          ...item,
          time_slot: convertToUserTimezone(item.time_slot, userTimezone)
        }));
      }
      
      setAdoptionData(processedAdoptionData);

      // Fetch performance metrics with comparison using analytics service
      const performanceComparison = await analyticsService.getPerformanceMetricsWithComparison(filters);
      
      // Fetch active devices metrics with comparison to get total device count
      const activeDevicesComparison = await analyticsService.getActiveDevicesMetricsWithComparison(filters);

      // Calculate rates from processed adoption data (with fallback for empty data)
      const totalUpdateChecks = processedAdoptionData.reduce((sum, item) => sum + item.update_checks, 0);
      const totalUpdateAvailable = processedAdoptionData.reduce((sum, item) => sum + item.update_available, 0);
      const totalDownloadSuccess = processedAdoptionData.reduce((sum, item) => sum + item.download_success, 0);
      const totalDownloadFailures = processedAdoptionData.reduce((sum, item) => sum + item.download_failures, 0);
      const totalApplySuccess = processedAdoptionData.reduce((sum, item) => sum + item.apply_success, 0);
      const totalApplyFailures = processedAdoptionData.reduce((sum, item) => sum + item.apply_failures, 0);
      const totalRollbacks = processedAdoptionData.reduce((sum, item) => sum + item.rollbacks_initiated, 0);

      // Calculate previous period rates for comparison
      const prevTotalUpdateChecks = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.update_checks, 0) || 0;
      const prevTotalUpdateAvailable = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.update_available, 0) || 0;
      const prevTotalDownloadSuccess = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.download_success, 0) || 0;
      const prevTotalDownloadFailures = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.download_failures, 0) || 0;
      const prevTotalApplySuccess = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.apply_success, 0) || 0;
      const prevTotalApplyFailures = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.apply_failures, 0) || 0;
      const prevTotalRollbacks = adoptionComparison.previous.time_breakdown?.reduce((sum, item) => sum + item.rollbacks_initiated, 0) || 0;

      // Current period rates
      const currentRates = {
        total_devices: activeDevicesComparison.current.total_active_devices || 0,
        check_for_update_rate: totalUpdateChecks > 0 ? totalUpdateAvailable / totalUpdateChecks : 0,
        update_available_rate: totalUpdateChecks > 0 ? totalUpdateAvailable / totalUpdateChecks : 0,
        download_success_rate: (totalDownloadSuccess + totalDownloadFailures) > 0 ? totalDownloadSuccess / (totalDownloadSuccess + totalDownloadFailures) : 0,
        download_failure_rate: (totalDownloadSuccess + totalDownloadFailures) > 0 ? totalDownloadFailures / (totalDownloadSuccess + totalDownloadFailures) : 0,
        apply_success_rate: (totalApplySuccess + totalApplyFailures) > 0 ? totalApplySuccess / (totalApplySuccess + totalApplyFailures) : 0,
        apply_failure_rate: (totalApplySuccess + totalApplyFailures) > 0 ? totalApplyFailures / (totalApplySuccess + totalApplyFailures) : 0,
        rollback_rate: activeDevicesComparison.current.total_active_devices > 0 ? totalRollbacks / activeDevicesComparison.current.total_active_devices : 0,
        average_download_time: performanceComparison.current.avg_download_time_ms || 0,
        average_apply_time: performanceComparison.current.avg_apply_time_ms || 0
      };

      // Previous period rates
      const previousRates = {
        total_devices: activeDevicesComparison.previous.total_active_devices || 0,
        check_for_update_rate: prevTotalUpdateChecks > 0 ? prevTotalUpdateAvailable / prevTotalUpdateChecks : 0,
        update_available_rate: prevTotalUpdateChecks > 0 ? prevTotalUpdateAvailable / prevTotalUpdateChecks : 0,
        download_success_rate: (prevTotalDownloadSuccess + prevTotalDownloadFailures) > 0 ? prevTotalDownloadSuccess / (prevTotalDownloadSuccess + prevTotalDownloadFailures) : 0,
        download_failure_rate: (prevTotalDownloadSuccess + prevTotalDownloadFailures) > 0 ? prevTotalDownloadFailures / (prevTotalDownloadSuccess + prevTotalDownloadFailures) : 0,
        apply_success_rate: (prevTotalApplySuccess + prevTotalApplyFailures) > 0 ? prevTotalApplySuccess / (prevTotalApplySuccess + prevTotalApplyFailures) : 0,
        apply_failure_rate: (prevTotalApplySuccess + prevTotalApplyFailures) > 0 ? prevTotalApplyFailures / (prevTotalApplySuccess + prevTotalApplyFailures) : 0,
        rollback_rate: activeDevicesComparison.previous.total_active_devices > 0 ? prevTotalRollbacks / activeDevicesComparison.previous.total_active_devices : 0,
        average_download_time: performanceComparison.previous.avg_download_time_ms || 0,
        average_apply_time: performanceComparison.previous.avg_apply_time_ms || 0
      };

      // Transform performance metrics to match our PerformanceData interface with changes
      const transformedPerformanceData = {
        total_devices: currentRates.total_devices,
        check_for_update_rate: currentRates.check_for_update_rate,
        update_available_rate: currentRates.update_available_rate,
        download_success_rate: currentRates.download_success_rate,
        download_failure_rate: currentRates.download_failure_rate,
        apply_success_rate: currentRates.apply_success_rate,
        apply_failure_rate: currentRates.apply_failure_rate,
        rollback_rate: currentRates.rollback_rate,
        average_download_time: currentRates.average_download_time,
        average_apply_time: currentRates.average_apply_time,
        // Add comparison data
        changes: {
          total_devices: getChangeTypeForMetric(currentRates.total_devices, previousRates.total_devices, 'total_devices'),
          download_success_rate: getChangeTypeForMetric(currentRates.download_success_rate, previousRates.download_success_rate, 'download_success_rate'),
          download_failure_rate: getChangeTypeForMetric(currentRates.download_failure_rate, previousRates.download_failure_rate, 'download_failure_rate'),
          apply_success_rate: getChangeTypeForMetric(currentRates.apply_success_rate, previousRates.apply_success_rate, 'apply_success_rate'),
          apply_failure_rate: getChangeTypeForMetric(currentRates.apply_failure_rate, previousRates.apply_failure_rate, 'apply_failure_rate'),
          rollback_rate: getChangeTypeForMetric(currentRates.rollback_rate, previousRates.rollback_rate, 'rollback_rate'),
          average_download_time: getChangeTypeForMetric(currentRates.average_download_time, previousRates.average_download_time, 'average_download_time'),
          average_apply_time: getChangeTypeForMetric(currentRates.average_apply_time, previousRates.average_apply_time, 'average_apply_time'),
        }
      };

      setPerformanceData(transformedPerformanceData);

    } catch (error: any) {
      console.error("Analytics fetch error:", error);
      setAnalyticsError(error.message || "Failed to fetch analytics data");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [org, app, releaseData?.package?.version, dateRange, userTimezone, customDateRange]);

  useEffect(() => {
    fetchReleaseData(selectedVersion || undefined);
  }, [fetchReleaseData, selectedVersion]);

  useEffect(() => {
    if (releaseData && showAnalytics) {
      fetchAnalyticsData();
    }
  }, [fetchAnalyticsData, releaseData, showAnalytics]);

  const handleSelectRelease = (version: number) => {
    setSelectedVersion(version);
    setShowHistory(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex justify-center items-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 flex items-center justify-center mx-auto mb-6">
            <Loader2 size={32} className="text-white animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Loading Release Details</h3>
          <p className="text-white/60">Fetching release information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex justify-center items-center p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 max-w-md w-full shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <h4 className="text-xl font-semibold text-white mb-4">Error Loading Release</h4>
            <p className="text-white/70 mb-6">{error}</p>
            <button
              onClick={() => fetchReleaseData(selectedVersion || undefined)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              <RefreshCw size={18} className="mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!releaseData) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <Package size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Release Details</h1>
                  <p className="text-white/60">{org} / {app}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`inline-flex items-center px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                  showAnalytics 
                    ? "bg-white/10 hover:bg-white/20 text-white border border-white/20" 
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20"
                }`}
              >
                <BarChart3 size={18} className="mr-2" />
                <span className="hidden sm:inline">{showAnalytics ? "Hide Analytics" : "Show Analytics"}</span>
                <span className="sm:hidden">{showAnalytics ? "Hide" : "Analytics"}</span>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`inline-flex items-center px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                  showHistory 
                    ? "bg-white/10 hover:bg-white/20 text-white border border-white/20" 
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-purple-500/20"
                }`}
              >
                {showHistory ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
                <span className="hidden sm:inline">{showHistory ? "Hide History" : "Show Release History"}</span>
                <span className="sm:hidden">{showHistory ? "Hide" : "History"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Release History */}
        {showHistory && org && app && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                <Calendar size={20} className="mr-2" />
                Release History
              </h3>
              <div className="overflow-hidden">
                <ReleaseHistory
                  organisation={org}
                  application={app}
                  onSelectRelease={handleSelectRelease}
                />
              </div>
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {showAnalytics && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                <BarChart3 size={20} className="mr-2" />
                Release Analytics
                <span className="ml-2 text-sm font-normal text-white/60">
                  Version {releaseData?.package?.version}
                </span>
              </h3>

              {/* Date Range Selector with Custom Date Picker */}
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-white/60" />
                  <span className="text-sm font-medium text-white/80">Time Range:</span>
                </div>
                
                {/* Preset Range Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-white/10 backdrop-blur rounded-xl border border-white/20 p-1">
                    {(['1d', '7d', '30d'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setDateRange(range);
                          setCustomDateRange({ startDate: null, endDate: null, isCustom: false });
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          dateRange === range && !customDateRange.isCustom
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {range === '1d' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Date Range Toggle with Popover */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all duration-200 ${
                        customDateRange.isCustom
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-purple-400 shadow-lg shadow-purple-500/20'
                          : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20'
                      }`}
                    >
                      {customDateRange.isCustom && customDateRange.startDate && customDateRange.endDate
                        ? formatDateRange(customDateRange.startDate, customDateRange.endDate)
                        : 'Custom Range'
                      }
                    </button>
                    
                    {/* Custom Date Picker Popover */}
                    {showCustomDatePicker && (
                      <div 
                        ref={datePickerRef}
                        className="absolute top-full bg-[#8068a9] left-0 mt-2 z-50 backdrop-blur rounded-xl border border-white/20 p-4 shadow-2xl min-w-[320px]"
                      >
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                              Select Date Range
                            </label>
                            <Datepicker
                              value={{ 
                                startDate: customDateRange.startDate, 
                                endDate: customDateRange.endDate 
                              }}
                              onChange={handleCustomDateChange}
                              showShortcuts={true}
                              maxDate={new Date()}
                              minDate={new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)}
                              primaryColor="cyan"
                              inputClassName="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                              containerClassName="relative z-50"
                              popoverDirection="down"
                              displayFormat="MMM DD, YYYY"
                              separator=" to "
                              startFrom={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
                              useRange={true}
                            />
                          </div>
                          
                          {customDateRange.startDate && customDateRange.endDate && customDateRange.isCustom && (
                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                              <div className="text-sm text-white/70">
                                <span className="font-medium text-white">Active Range:</span> {formatDateRange(customDateRange.startDate, customDateRange.endDate)}
                                {isSingleDay(customDateRange.startDate, customDateRange.endDate) && (
                                  <span className="ml-2 px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-md text-xs">
                                    Hourly View
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {dateRangeError && (
                            <div className="flex items-center gap-2 text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                              <AlertCircle size={16} />
                              <span>{dateRangeError}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {analyticsLoading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                  <p className="text-white/60">Loading analytics data...</p>
                </div>
              )}

              {analyticsError && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-2xl mb-4">
                    <AlertCircle size={24} className="text-red-400" />
                  </div>
                  <p className="text-red-400 mb-4">{analyticsError}</p>
                  <button
                    onClick={fetchAnalyticsData}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Retry
                  </button>
                </div>
              )}

              {!analyticsLoading && !analyticsError && performanceData && (
                <div className="space-y-6">
                  {/* Performance Metrics */}
                  <div>
                    <h4 className="text-base font-semibold text-white mb-4 flex items-center">
                      <Smartphone size={16} className="mr-2" />
                      Performance Overview
                    </h4>
                    <MetricGrid
                      metrics={[
                        {
                          title: "Total Devices",
                          value: performanceData.total_devices.toLocaleString(),
                          change: performanceData.changes?.total_devices.change,
                          changeType: performanceData.changes?.total_devices.changeType,
                          icon: Smartphone
                        },
                        {
                          title: "Check for Update Rate",
                          value: `${(performanceData.check_for_update_rate * 100).toFixed(1)}%`,
                          change: performanceData.changes?.total_devices.change, // Using total_devices as proxy since we don't track this separately
                          changeType: performanceData.changes?.total_devices.changeType,
                          icon: RefreshCw
                        },
                        {
                          title: "Download Success Rate",
                          value: `${(performanceData.download_success_rate * 100).toFixed(1)}%`,
                          change: performanceData.changes?.download_success_rate.change,
                          changeType: performanceData.changes?.download_success_rate.changeType,
                          icon: Download
                        },
                        {
                          title: "Apply Success Rate",
                          value: `${(performanceData.apply_success_rate * 100).toFixed(1)}%`,
                          change: performanceData.changes?.apply_success_rate.change,
                          changeType: performanceData.changes?.apply_success_rate.changeType,
                          icon: CheckCircle
                        },
                        {
                          title: "Rollback Rate",
                          value: `${(performanceData.rollback_rate * 100).toFixed(1)}%`,
                          change: performanceData.changes?.rollback_rate.change,
                          changeType: performanceData.changes?.rollback_rate.changeType,
                          icon: RotateCcw
                        },
                        {
                          title: "Avg Download Time",
                          value: `${(performanceData.average_download_time / 1000).toFixed(1)}s`,
                          change: performanceData.changes?.average_download_time.change,
                          changeType: performanceData.changes?.average_download_time.changeType,
                          icon: Clock
                        }
                      ]}
                    />
                  </div>

                  {/* Charts */}
                  {adoptionData.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center">
                          <TrendingUp size={16} className="mr-2" />
                          Adoption Over Time
                        </h5>
                        <AdoptionChart data={adoptionData} interval={getChartInterval()} />
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center">
                          <BarChart3 size={16} className="mr-2" />
                          Performance Metrics
                        </h5>
                        <PerformanceChart data={adoptionData} interval={getChartInterval()} />
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center">
                          <Clock size={16} className="mr-2" />
                          Time to Adoption
                        </h5>
                        <TimeToAdoptionChart data={adoptionData} interval={getChartInterval()} />
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h5 className="text-sm font-semibold text-white mb-4 flex items-center">
                          <RotateCcw size={16} className="mr-2" />
                          Rollback Analysis
                        </h5>
                        <RollbackChart data={adoptionData} interval={getChartInterval()} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Package Info Header */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4 sm:space-x-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <Package size={24} className="text-white sm:w-7 sm:h-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white break-words">{releaseData.package.name}</h2>
                <p className="text-white/60">Version {releaseData.package.version}</p>
              </div>
            </div>
            <div>
              <div className="px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-semibold border border-green-500/30 text-sm sm:text-base">
                Active Release
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Configuration Section */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
              <Settings size={20} className="mr-2" />
              Configuration
            </h3>
            <div className="overflow-hidden rounded-xl">
              <ReactJson
                value={releaseData.config}
                style={{
                  ...vscodeTheme,
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
                collapsed={2}
                indentWidth={2}
                shortenTextAfterLength={50}
                // quotesOnKeys={false}
                // sortKeys={false}
              />
            </div>
          </div>

          {/* Package Section */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
              <Package size={20} className="mr-2" />
              Package Details
            </h3>
            
            {/* Package Properties */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                
                <div className="overflow-hidden rounded-xl">
                  <ReactJson
                    value={releaseData.package}
                    style={{
                      ...vscodeTheme,
                      backgroundColor: 'rgba(17, 24, 39, 0.8)',
                      fontSize: '13px',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      maxHeight: '400px',
                      overflow: 'auto'
                    }}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    enableClipboard={true}
                    collapsed={2}
                    indentWidth={2}
                    shortenTextAfterLength={50}
                    // quotesOnKeys={false}
                    // sortKeys={false}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Additional Package Information */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Additional Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Index</h4>
              <p className="text-white font-mono text-sm break-all">{releaseData.package.index}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Important Files Count</h4>
              <p className="text-white text-lg font-semibold">{releaseData.package.important.length}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Lazy Files Count</h4>
              <p className="text-white text-lg font-semibold">{releaseData.package.lazy.length}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 sm:col-span-2 lg:col-span-1">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Timeout (Config)</h4>
              <p className="text-white text-lg font-semibold">{releaseData.config.release_config_timeout}ms</p>
            </div>
          </div>

          {/* Important Files Information */}
          {releaseData.package.important.length > 0 && (
            <div className="mt-6">
              <h4 className="text-base sm:text-lg font-semibold text-white mb-3">Important Files</h4>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="space-y-2">
                  {releaseData.package.important.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
                      <span className="text-white/60 text-sm">File {index + 1}</span>
                      <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">{file.file_path}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Lazy Files Information */}
          {releaseData.package.lazy.length > 0 && (
            <div className="mt-6">
              <h4 className="text-base sm:text-lg font-semibold text-white mb-3">Lazy Files</h4>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="space-y-2">
                  {releaseData.package.lazy.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
                      <span className="text-white/60 text-sm">File {index + 1}</span>
                      <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">{file.file_path}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Release;
