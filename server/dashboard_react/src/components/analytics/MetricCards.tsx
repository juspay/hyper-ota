import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Download,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  Users,
  Smartphone,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { MetricCard as MetricCardType } from '../../types/analytics';

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  unit?: string;
  description?: string;
  loading?: boolean;
  className?: string;
}

interface MetricGridProps {
  metrics: MetricCardType[];
  loading?: boolean;
  className?: string;
}

const formatValue = (value: number | string, _unit?: string): string => {
  if (typeof value === 'string') return value;
  
  // Format large numbers
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  
  return value.toLocaleString();
};

const getChangeIcon = (changeType?: 'positive' | 'negative' | 'neutral') => {
  switch (changeType) {
    case 'positive':
      return <TrendingUp size={16} className="text-green-500" />;
    case 'negative':
      return <TrendingDown size={16} className="text-red-500" />;
    default:
      return <Minus size={16} className="text-gray-400" />;
  }
};

const getChangeColor = (changeType?: 'positive' | 'negative' | 'neutral') => {
  switch (changeType) {
    case 'positive':
      return 'text-green-600';
    case 'negative':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  unit,
  description,
  loading = false,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-lg ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-white/20 rounded w-24"></div>
            <div className="w-8 h-8 bg-white/20 rounded-lg"></div>
          </div>
          <div className="h-8 bg-white/20 rounded w-16 mb-2"></div>
          <div className="h-3 bg-white/20 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-lg hover:bg-white/15 transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80">{title}</h3>
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
          <Icon size={20} className="text-white/90" />
        </div>
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-white">
          {formatValue(value, unit)}
        </span>
        {unit && <span className="text-sm text-white/60">{unit}</span>}
      </div>
      
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${getChangeColor(changeType)}`}>
          {getChangeIcon(changeType)}
          <span>{Math.abs(change)}%</span>
          <span className="text-white/60">vs last period</span>
        </div>
      )}
      
      {description && (
        <p className="text-xs text-white/60 mt-2">{description}</p>
      )}
    </div>
  );
};

export const MetricGrid: React.FC<MetricGridProps> = ({
  metrics,
  loading = false,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          change={metric.change}
          changeType={metric.changeType}
          icon={metric.icon}
          unit={metric.unit}
          loading={loading}
        />
      ))}
    </div>
  );
};

// Predefined metric card configurations for common OTA metrics
export const createAdoptionMetrics = (data: {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  rollbacks: number;
  activeDevices: number;
  successRate: number;
}): MetricCardType[] => [
  {
    title: 'Total Updates',
    value: data.totalUpdates,
    icon: Download,
    changeType: 'positive',
    change: 12.5,
  },
  {
    title: 'Success Rate',
    value: data.successRate,
    unit: '%',
    icon: CheckCircle,
    changeType: data.successRate > 95 ? 'positive' : 'negative',
    change: 2.1,
  },
  {
    title: 'Failed Updates',
    value: data.failedUpdates,
    icon: XCircle,
    changeType: 'negative',
    change: -5.2,
  },
  {
    title: 'Rollbacks',
    value: data.rollbacks,
    icon: RotateCcw,
    changeType: data.rollbacks < 10 ? 'positive' : 'negative',
    change: -8.1,
  },
];

export const createPerformanceMetrics = (data: {
  avgDownloadTime: number;
  avgApplyTime: number;
  avgDownloadSize: number;
}): MetricCardType[] => [
  {
    title: 'Avg Download Time',
    value: Math.round(data.avgDownloadTime / 1000),
    unit: 's',
    icon: Clock,
    changeType: 'positive',
    change: -15.3,
  },
  {
    title: 'Avg Apply Time',
    value: Math.round(data.avgApplyTime / 1000),
    unit: 's',
    icon: Zap,
    changeType: 'positive',
    change: -8.7,
  },
  {
    title: 'Avg Bundle Size',
    value: Math.round(data.avgDownloadSize / (1024 * 1024)),
    unit: 'MB',
    icon: Smartphone,
    changeType: 'neutral',
    change: 2.1,
  },
];

export const createDeviceMetrics = (data: {
  totalDevices: number;
  activeDevices: number;
  newDevices: number;
}): MetricCardType[] => [
  {
    title: 'Total Devices',
    value: data.totalDevices,
    icon: Smartphone,
    changeType: 'positive',
    change: 8.2,
  },
  {
    title: 'Active Devices',
    value: data.activeDevices,
    icon: Users,
    changeType: 'positive',
    change: 5.4,
  },
  {
    title: 'New Devices',
    value: data.newDevices,
    icon: TrendingUp,
    changeType: 'positive',
    change: 12.8,
  },
];

export const createFailureMetrics = (data: {
  totalFailures: number;
  failureRate: number;
  criticalErrors: number;
}): MetricCardType[] => [
  {
    title: 'Total Failures',
    value: data.totalFailures,
    icon: AlertTriangle,
    changeType: 'negative',
    change: 15.2,
  },
  {
    title: 'Failure Rate',
    value: data.failureRate,
    unit: '%',
    icon: XCircle,
    changeType: data.failureRate < 5 ? 'positive' : 'negative',
    change: -3.1,
  },
  {
    title: 'Critical Errors',
    value: data.criticalErrors,
    icon: AlertTriangle,
    changeType: 'negative',
    change: 8.4,
  },
];
