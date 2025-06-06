import React from 'react';
import { Calendar, Clock, Filter } from 'lucide-react';
// import { DateRangePicker } from './DateRangePicker';

interface FilterBarProps {
  releases: string[];
  selectedRelease: string;
  onReleaseChange: (release: string) => void;
  dateRange: {
    startDate: Date;
    endDate: Date;
    preset: string;
  };
  onDateRangeChange: (range: { startDate: Date; endDate: Date; preset: string }) => void;
  interval: 'HOUR' | 'DAY';
  onIntervalChange: (interval: 'HOUR' | 'DAY') => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  releases,
  selectedRelease,
  onReleaseChange,
  dateRange,
  onDateRangeChange,
  interval,
  onIntervalChange,
}) => {
  const presetOptions = [
    { value: 'today', label: 'Today', days: 0 },
    { value: 'last7days', label: 'Last 7 Days', days: 7 },
    { value: 'last30days', label: 'Last 30 Days', days: 30 },
    { value: 'custom', label: 'Custom Range', days: null },
  ];

  const handlePresetChange = (preset: string) => {
    const now = new Date();
    let startDate = new Date();
    
    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        return; // Don't change dates for custom
    }
    
    onDateRangeChange({
      startDate,
      endDate: now,
      preset,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Release Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Release:</span>
          </div>
          <select
            value={selectedRelease}
            onChange={(e) => onReleaseChange(e.target.value)}
            className="block px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {releases.map((release) => (
              <option key={release} value={release}>
                {release}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range and Interval Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Date Presets */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
            <div className="flex rounded-md shadow-sm" role="group">
              {presetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetChange(option.value)}
                  className={`px-3 py-2 text-sm font-medium border ${
                    dateRange.preset === option.value
                      ? 'bg-blue-50 text-blue-700 border-blue-200 z-10'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${
                    option.value === presetOptions[0].value
                      ? 'rounded-l-md'
                      : option.value === presetOptions[presetOptions.length - 1].value
                      ? 'rounded-r-md -ml-px'
                      : '-ml-px'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Picker */}
          {/* {dateRange.preset === 'custom' && (
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onDateRangeChange={(start, end) => 
                onDateRangeChange({ 
                  startDate: start, 
                  endDate: end, 
                  preset: 'custom' 
                })
              }
            />
          )} */}

          {/* Interval Selection */}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Interval:</span>
            <select
              value={interval}
              onChange={(e) => onIntervalChange(e.target.value as 'HOUR' | 'DAY')}
              className="block px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="HOUR">Hourly</option>
              <option value="DAY">Daily</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
