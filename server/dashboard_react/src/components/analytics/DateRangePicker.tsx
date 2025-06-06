import React, { useState } from 'react';
import { Calendar, ChevronDown, Filter } from 'lucide-react';
import { DateRange, AnalyticsFilters } from '../../types/analytics';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DateRangePickerProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  className?: string;
}

interface PresetDateRange {
  label: string;
  value: DateRange;
  description: string;
}

const presetRanges: PresetDateRange[] = [
  { label: 'Today', value: '1d', description: 'Last 24 hours' },
  { label: 'Last 7 Days', value: '7d', description: 'Past week' },
  { label: 'Last 30 Days', value: '30d', description: 'Past month' },
  { label: 'Custom Range', value: 'custom', description: 'Select dates' },
];

const intervalOptions = [
  { label: 'Hourly', value: 'HOUR', description: 'Hour by hour breakdown' },
  { label: 'Daily', value: 'DAY', description: 'Day by day breakdown' },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  filters,
  onFiltersChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const handleDateRangeChange = (range: DateRange) => {
    let newFilters = { ...filters, date_range: range };
    
    if (range !== 'custom') {
      const now = new Date();
      let startDate: Date;
      
      switch (range) {
        case '1d':
          startDate = subDays(now, 1);
          newFilters.interval = 'HOUR';
          break;
        case '7d':
          startDate = subDays(now, 7);
          newFilters.interval = 'DAY';
          break;
        case '30d':
          startDate = subDays(now, 30);
          newFilters.interval = 'DAY';
          break;
        default:
          startDate = subDays(now, 7);
          newFilters.interval = 'DAY';
      }
      
      newFilters.start_date = startOfDay(startDate);
      newFilters.end_date = endOfDay(now);
      setShowCustomDates(false);
    } else {
      setShowCustomDates(true);
      // Keep existing custom dates or set defaults
      if (!newFilters.start_date || !newFilters.end_date) {
        newFilters.start_date = startOfDay(subDays(new Date(), 7));
        newFilters.end_date = endOfDay(new Date());
      }
    }
    
    onFiltersChange(newFilters);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    const date = new Date(value);
    const newFilters = { ...filters };
    
    if (type === 'start') {
      newFilters.start_date = startOfDay(date);
    } else {
      newFilters.end_date = endOfDay(date);
    }
    
    onFiltersChange(newFilters);
  };

  const handleIntervalChange = (interval: 'HOUR' | 'DAY') => {
    onFiltersChange({ ...filters, interval });
  };

  const getCurrentRangeLabel = () => {
    const preset = presetRanges.find(r => r.value === filters.date_range);
    if (preset && preset.value !== 'custom') {
      return preset.label;
    }
    
    if (filters.start_date && filters.end_date) {
      return `${format(filters.start_date, 'MMM dd')} - ${format(filters.end_date, 'MMM dd')}`;
    }
    
    return 'Select Range';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-3">
        {/* Date Range Selector */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-white hover:bg-white/15 transition-all duration-300"
          >
            <Calendar size={16} />
            <span className="text-sm font-medium">{getCurrentRangeLabel()}</span>
            <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl shadow-lg">
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Time Range</h3>
                
                <div className="space-y-2 mb-4">
                  {presetRanges.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => handleDateRangeChange(range.value)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                        filters.date_range === range.value
                          ? 'bg-blue-50 border border-blue-200 text-blue-700'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium">{range.label}</div>
                        <div className="text-xs text-gray-500">{range.description}</div>
                      </div>
                      {filters.date_range === range.value && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>

                {showCustomDates && (
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={filters.start_date ? format(filters.start_date, 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleCustomDateChange('start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={filters.end_date ? format(filters.end_date, 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleCustomDateChange('end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interval Selector */}
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-1">
          {intervalOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleIntervalChange(option.value as 'HOUR' | 'DAY')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                filters.interval === option.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Filter Indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
          <Filter size={14} className="text-white/60" />
          <span className="text-xs text-white/80">
            {filters.org_id} / {filters.app_id}
          </span>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
