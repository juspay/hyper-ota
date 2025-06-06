import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface ChartProps {
  data: any[];
  height?: number;
  className?: string;
}

interface LineChartProps extends ChartProps {
  lines: {
    dataKey: string;
    stroke: string;
    name: string;
    strokeWidth?: number;
  }[];
  xAxisKey: string;
  showGrid?: boolean;
  showLegend?: boolean;
  interval?: 'HOUR' | 'DAY';
}

interface AreaChartProps extends ChartProps {
  areas: {
    dataKey: string;
    fill: string;
    stroke: string;
    name: string;
  }[];
  xAxisKey: string;
  stacked?: boolean;
  interval?: 'HOUR' | 'DAY';
}

interface BarChartProps extends ChartProps {
  bars: {
    dataKey: string;
    fill: string;
    name: string;
  }[];
  xAxisKey: string;
  stacked?: boolean;
}

interface PieChartProps extends ChartProps {
  dataKey: string;
  nameKey: string;
  colors: string[];
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
}

// Custom tooltip for time-based charts
const TimeTooltip = ({ active, payload, label, interval }: any) => {
  if (active && payload && payload.length) {
    // Show time only for "Last 24 Hours" (HOUR interval) and date only for others (DAY interval)
    const formatPattern = interval === 'HOUR' ? 'MMM dd, yyyy hh:mm aaaaa\'m\'' : 'MMM dd, yyyy';
    
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-gray-900 mb-2">
          {format(new Date(label), formatPattern)}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom tooltip for general charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AdoptionLineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  xAxisKey,
  height = 300,
  showGrid = true,
  showLegend = true,
  className = '',
  interval = 'DAY',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey={xAxisKey}
            tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          {showLegend && <Legend />}
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth || 2}
              name={line.name}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AdoptionAreaChart: React.FC<AreaChartProps> = ({
  data,
  areas,
  xAxisKey,
  height = 300,
  stacked = false,
  className = '',
  interval = 'DAY',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey={xAxisKey}
            tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          <Legend />
          {areas.map((area, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={area.dataKey}
              stackId={stacked ? '1' : undefined}
              stroke={area.stroke}
              fill={area.fill}
              name={area.name}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MetricsBarChart: React.FC<BarChartProps> = ({
  data,
  bars,
  xAxisKey,
  height = 300,
  stacked = false,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xAxisKey} stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {bars.map((bar, index) => (
            <Bar
              key={index}
              dataKey={bar.dataKey}
              stackId={stacked ? '1' : undefined}
              fill={bar.fill}
              name={bar.name}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const VersionPieChart: React.FC<PieChartProps> = ({
  data,
  dataKey,
  colors,
  height = 300,
  innerRadius = 0,
  outerRadius = 100,
  showLabel = true,
  className = '',
}) => {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabel ? renderCustomizedLabel : false}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Specific chart components for analytics dashboard
interface AdoptionChartProps {
  data: any[];
  interval: 'HOUR' | 'DAY';
}

export const AdoptionChart: React.FC<AdoptionChartProps> = ({ data, interval }) => {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return interval === 'HOUR' 
      ? format(date, 'HH:mm')
      : format(date, 'MMM dd');
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Update Adoption Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time_slot" 
            tickFormatter={formatXAxis}
            className="text-sm"
          />
          <YAxis className="text-sm" />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="download_success"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
            name="Downloads"
          />
          <Area
            type="monotone"
            dataKey="apply_success"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
            name="Applied"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface PerformanceChartProps {
  data: any[];
  interval: 'HOUR' | 'DAY';
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, interval }) => {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return interval === 'HOUR' 
      ? format(date, 'HH:mm')
      : format(date, 'MMM dd');
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Success vs Failure Rates</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time_slot" 
            tickFormatter={formatXAxis}
            className="text-sm"
          />
          <YAxis className="text-sm" />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          <Legend />
          <Bar dataKey="download_success" fill="#10b981" name="Download Success" />
          <Bar dataKey="download_failures" fill="#ef4444" name="Download Failures" />
          <Bar dataKey="apply_success" fill="#3b82f6" name="Apply Success" />
          <Bar dataKey="apply_failures" fill="#f59e0b" name="Apply Failures" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface TimeToAdoptionChartProps {
  data: any[];
  interval: 'HOUR' | 'DAY';
}

export const TimeToAdoptionChart: React.FC<TimeToAdoptionChartProps> = ({ data, interval }) => {
  // Calculate cumulative adoption
  const cumulativeData = data.map((item, index) => {
    const cumulativeSuccess = data.slice(0, index + 1)
      .reduce((sum, d) => sum + d.apply_success, 0);
    
    return {
      ...item,
      cumulative_adoption: cumulativeSuccess,
    };
  });

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return interval === 'HOUR' 
      ? format(date, 'HH:mm')
      : format(date, 'MMM dd');
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Cumulative Adoption</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={cumulativeData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time_slot" 
            tickFormatter={formatXAxis}
            className="text-sm"
          />
          <YAxis className="text-sm" />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="cumulative_adoption"
            stroke="#8b5cf6"
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
            name="Cumulative Adoptions"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface RollbackChartProps {
  data: any[];
  interval: 'HOUR' | 'DAY';
}

export const RollbackChart: React.FC<RollbackChartProps> = ({ data, interval }) => {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return interval === 'HOUR' 
      ? format(date, 'HH:mm')
      : format(date, 'MMM dd');
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Rollback Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time_slot" 
            tickFormatter={formatXAxis}
            className="text-sm"
          />
          <YAxis className="text-sm" />
          <Tooltip content={(props) => <TimeTooltip {...props} interval={interval} />} />
          <Legend />
          <Bar dataKey="rollbacks_initiated" fill="#ef4444" name="Rollbacks Initiated" />
          <Bar dataKey="rollbacks_completed" fill="#f59e0b" name="Rollbacks Completed" />
          <Bar dataKey="rollback_failures" fill="#dc2626" name="Rollback Failures" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface VersionDistributionChartProps {
  releaseId: string;
}

export const VersionDistributionChart: React.FC<VersionDistributionChartProps> = ({ releaseId: _releaseId }) => {
  // Mock data for version distribution - in real implementation, fetch from API
  const mockData = [
    { version: '1.0.4', count: 450, percentage: 45 },
    { version: '1.0.3', count: 300, percentage: 30 },
    { version: '1.0.2', count: 150, percentage: 15 },
    { version: '1.0.1', count: 100, percentage: 10 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Version Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={mockData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={5}
            dataKey="count"
            nameKey="version"
          >
            {mockData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any, name: any) => [
              `${value} devices (${mockData.find(d => d.version === name)?.percentage}%)`,
              name
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DeviceTypeChart: React.FC<{ data: any[] }> = ({ data: _data }) => {
  // Mock device type data
  const deviceData = [
    { type: 'iOS', count: 650, percentage: 65 },
    { type: 'Android', count: 350, percentage: 35 },
  ];

  const COLORS = ['#000000', '#a3da8b'];

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Device Type Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={deviceData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={5}
            dataKey="count"
            nameKey="type"
          >
            {deviceData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any, name: any) => [
              `${value} devices (${deviceData.find(d => d.type === name)?.percentage}%)`,
              name
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const NetworkTypeChart: React.FC<{ data: any[] }> = ({ data: _data }) => {
  // Mock network type data
  const networkData = [
    { type: 'WiFi', count: 700, percentage: 70 },
    { type: '4G', count: 250, percentage: 25 },
    { type: '5G', count: 50, percentage: 5 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Network Type Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={networkData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={5}
            dataKey="count"
            nameKey="type"
          >
            {networkData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any, name: any) => [
              `${value} devices (${networkData.find(d => d.type === name)?.percentage}%)`,
              name
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Chart color palettes
export const chartColors = {
  primary: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  success: ['#10b981', '#059669', '#047857', '#065f46'],
  error: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  warning: ['#f59e0b', '#d97706', '#b45309', '#92400e'],
  gradient: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'],
};
