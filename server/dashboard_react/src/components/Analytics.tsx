import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Download,
  CheckCircle,
  RotateCcw,
  Clock,
  TrendingUp,
  AlertTriangle,
  Smartphone,
  ArrowLeft,
  BarChart3
} from 'lucide-react';
import { MetricGrid } from './analytics/MetricCards';
import { 
  AdoptionChart,
  PerformanceChart,
  VersionDistributionChart,
  TimeToAdoptionChart,
  RollbackChart,
  DeviceTypeChart
} from './analytics/Charts';
import { LoadingSpinner } from './LoadingSpinner';
import axios from '../api/axios';

interface AnalyticsProps {
  user: any;
  setIsAuthenticated: (auth: boolean) => void;
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
}

const Analytics: React.FC<AnalyticsProps> = () => {
  const { org, app, release: releaseParam } = useParams();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<string>('');
  const [releases, setReleases] = useState<Array<{id: string, version: string}>>([]);
  
  // Date filter state
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date(),
    preset: 'last7days'
  });
  
  // Analytics data state
  const [adoptionData, setAdoptionData] = useState<AdoptionData[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [interval, setInterval] = useState<'HOUR' | 'DAY'>('DAY');

  // Fetch releases for the app
  useEffect(() => {
    const fetchReleases = async () => {
      try {
        const response = await axios.get(`/organisations/${org}/applications/${app}/releases`);
        const releaseData = response.data;
        const formattedReleases = releaseData.map((r: any) => ({
          id: r.id,
          version: r.version || r.id
        }));
        setReleases(formattedReleases);
        
        // Set initial release - use URL param if available, otherwise first release
        if (releaseParam && formattedReleases.find((r: any) => r.id === releaseParam)) {
          setSelectedRelease(releaseParam);
        } else if (formattedReleases.length > 0) {
          setSelectedRelease(formattedReleases[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch releases:', err);
        setError('Failed to fetch releases');
      }
    };

    if (org && app) {
      fetchReleases();
    }
  }, [org, app, releaseParam]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!selectedRelease || !org || !app) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const baseParams = {
          tenant_id: org,
          org_id: org,
          app_id: app,
          release_id: selectedRelease,
        };

        // Fetch adoption metrics
        const adoptionParams = {
          ...baseParams,
          interval,
          start_date: dateRange.startDate.getTime(),
          end_date: dateRange.endDate.getTime(),
        };

        const [adoptionResponse, performanceResponse] = await Promise.all([
          axios.get('http://localhost:6400/analytics/adoption', { params: adoptionParams }),
          axios.get('http://localhost:6400/analytics/performance', { params: baseParams }),
        ]);

        setAdoptionData(adoptionResponse.data.data.time_breakdown || []);
        setPerformanceData(performanceResponse.data.data || null);
        
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to fetch analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedRelease, org, app, dateRange, interval]);

  // Calculate metrics from the data
  const calculateMetrics = () => {
    if (!adoptionData.length || !performanceData) {
      return {
        totalDevices: 0,
        updateChecks: 0,
        downloadSuccess: 0,
        downloadFailures: 0,
        applySuccess: 0,
        applyFailures: 0,
        rollbacks: 0,
        successRate: 0,
        downloadSuccessRate: 0,
        rollbackRate: 0
      };
    }

    const totals = adoptionData.reduce((acc, curr) => ({
      updateChecks: acc.updateChecks + curr.update_checks,
      downloadSuccess: acc.downloadSuccess + curr.download_success,
      downloadFailures: acc.downloadFailures + curr.download_failures,
      applySuccess: acc.applySuccess + curr.apply_success,
      applyFailures: acc.applyFailures + curr.apply_failures,
      rollbacks: acc.rollbacks + curr.rollbacks_initiated,
    }), {
      updateChecks: 0,
      downloadSuccess: 0,
      downloadFailures: 0,
      applySuccess: 0,
      applyFailures: 0,
      rollbacks: 0,
    });

    const totalDownloads = totals.downloadSuccess + totals.downloadFailures;
    const totalApplies = totals.applySuccess + totals.applyFailures;
    
    return {
      totalDevices: performanceData.total_devices,
      ...totals,
      successRate: totalApplies > 0 ? (totals.applySuccess / totalApplies) * 100 : 0,
      downloadSuccessRate: totalDownloads > 0 ? (totals.downloadSuccess / totalDownloads) * 100 : 0,
      rollbackRate: totals.applySuccess > 0 ? (totals.rollbacks / totals.applySuccess) * 100 : 0,
    };
  };

  // Handle release selection change - navigate to release-specific URL
  const handleReleaseChange = (releaseId: string) => {
    navigate(`/dashboard/analytics/${org}/${app}/${releaseId}`);
  };

  const metrics = calculateMetrics();

  // Show release selection screen if no release is selected
  if (!releaseParam && releases.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Select Release for Analytics
                  </h1>
                  <p className="mt-2 text-gray-600">
                    {org} / {app} - Choose a specific release to view analytics
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Release Selection */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Choose a Release
              </h2>
              <p className="text-gray-600">
                Analytics are tracked per release deployment. Select a release to view its specific metrics.
              </p>
            </div>
            
            <div className="grid gap-4 max-w-2xl mx-auto">
              {releases.map((release) => (
                <button
                  key={release.id}
                  onClick={() => handleReleaseChange(release.id)}
                  className="p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                        {release.version}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Release ID: {release.id}
                      </p>
                    </div>
                    <div className="text-gray-400 group-hover:text-blue-500">
                      <BarChart3 size={24} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Define metric cards
  const metricCards = [
    {
      title: 'Total Devices',
      value: metrics.totalDevices,
      icon: Smartphone,
      change: 0,
      changeType: 'neutral' as const,
      description: 'Total active devices'
    },
    {
      title: 'Update Checks',
      value: metrics.updateChecks,
      icon: Clock,
      change: 0,
      changeType: 'neutral' as const,
      description: 'Devices checking for updates'
    },
    {
      title: 'Download Success',
      value: metrics.downloadSuccess,
      icon: Download,
      change: 0,
      changeType: 'positive' as const,
      description: 'Successfully completed downloads'
    },
    {
      title: 'Apply Success',
      value: metrics.applySuccess,
      icon: CheckCircle,
      change: 0,
      changeType: 'positive' as const,
      description: 'Successfully applied updates'
    },
    {
      title: 'Success Rate',
      value: `${metrics.successRate.toFixed(1)}%`,
      icon: TrendingUp,
      change: 0,
      changeType: 'positive' as const,
      description: 'Overall update success rate'
    },
    {
      title: 'Download Success Rate',
      value: `${metrics.downloadSuccessRate.toFixed(1)}%`,
      icon: Download,
      change: 0,
      changeType: 'positive' as const,
      description: 'Download completion rate'
    },
    {
      title: 'Rollbacks',
      value: metrics.rollbacks,
      icon: RotateCcw,
      change: 0,
      changeType: 'negative' as const,
      description: 'Updates that were rolled back'
    },
    {
      title: 'Rollback Rate',
      value: `${metrics.rollbackRate.toFixed(1)}%`,
      icon: AlertTriangle,
      change: 0,
      changeType: 'negative' as const,
      description: 'Percentage of rollbacks'
    },
  ];

  if (loading && !adoptionData.length) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Release Analytics
                  </h1>
                  <p className="mt-2 text-gray-600">
                    {org} / {app} / {releases.find(r => r.id === selectedRelease)?.version || selectedRelease}
                  </p>
                  <p className="text-sm text-gray-500">
                    Analytics data for specific release deployment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="release-select" className="block text-sm font-medium text-gray-700 mb-1">
                Release
              </label>
              <select
                id="release-select"
                value={selectedRelease}
                onChange={(e) => setSelectedRelease(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {releases.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.version}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="interval-select" className="block text-sm font-medium text-gray-700 mb-1">
                Interval
              </label>
              <select
                id="interval-select"
                value={interval}
                onChange={(e) => setInterval(e.target.value as 'HOUR' | 'DAY')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="HOUR">Hourly</option>
                <option value="DAY">Daily</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    startDate: new Date(e.target.value),
                    preset: 'custom'
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.endDate.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    endDate: new Date(e.target.value),
                    preset: 'custom'
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Metrics Grid */}
        <div className="mb-8">
          <MetricGrid metrics={metricCards} loading={loading} />
        </div>

        {/* Charts Grid */}
        <div className="space-y-8">
          {/* Adoption & Rollout Metrics */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Adoption & Rollout Metrics
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AdoptionChart data={adoptionData} interval={interval} />
              <TimeToAdoptionChart data={adoptionData} interval={interval} />
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Performance & Success Rates
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart data={adoptionData} interval={interval} />
              <RollbackChart data={adoptionData} interval={'HOUR'} />
            </div>
          </div>

          {/* Version Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Distribution Analysis
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VersionDistributionChart releaseId={selectedRelease} />
              <DeviceTypeChart data={adoptionData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
