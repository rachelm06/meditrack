import React, { useState } from 'react';
import { CalendarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const TimelineFilter = ({ onTimelineChange, selectedTimeline = '1M' }) => {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customDates, setCustomDates] = useState({
    startDate: '',
    endDate: ''
  });

  const predefinedRanges = [
    { key: '1W', label: 'Past Week', days: 7, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: '2W', label: 'Past 2 Weeks', days: 14, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { key: '1M', label: 'Past Month', days: 30, color: 'bg-green-50 text-green-700 border-green-200' },
    { key: '2M', label: 'Past 2 Months', days: 60, color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { key: '3M', label: 'Past 3 Months', days: 90, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: '6M', label: 'Past 6 Months', days: 180, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { key: '1Y', label: 'Past Year', days: 365, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { key: '5Y', label: 'Past 5 Years', days: 1825, color: 'bg-red-50 text-red-700 border-red-200' }
  ];

  const handleRangeSelect = (range) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - range.days);

    const timelineData = {
      key: range.key,
      label: range.label,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      days: range.days,
      aggregationLevel: getOptimalAggregation(range.days)
    };

    onTimelineChange(timelineData);
    setIsCustomOpen(false);
  };

  const handleCustomDateSubmit = () => {
    if (customDates.startDate && customDates.endDate) {
      const start = new Date(customDates.startDate);
      const end = new Date(customDates.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      const timelineData = {
        key: 'CUSTOM',
        label: `${customDates.startDate} to ${customDates.endDate}`,
        startDate: customDates.startDate,
        endDate: customDates.endDate,
        days: days,
        aggregationLevel: getOptimalAggregation(days)
      };

      onTimelineChange(timelineData);
      setIsCustomOpen(false);
    }
  };

  const getOptimalAggregation = (days) => {
    if (days <= 7) return 'hour';
    if (days <= 30) return 'day';
    if (days <= 90) return 'week';
    if (days <= 365) return 'week';
    return 'month';
  };

  const getSelectedRange = () => {
    return predefinedRanges.find(range => range.key === selectedTimeline) ||
           { label: 'Custom Range', color: 'bg-gray-50 text-gray-700 border-gray-200' };
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center text-sm font-medium text-gray-700 mr-2">
          <CalendarIcon className="w-4 h-4 mr-2" />
          Time Range:
        </div>

        {/* Predefined Range Buttons */}
        {predefinedRanges.map((range) => (
          <button
            key={range.key}
            onClick={() => handleRangeSelect(range)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 hover:shadow-sm ${
              selectedTimeline === range.key
                ? range.color + ' ring-2 ring-offset-1 ring-opacity-50'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {range.label}
          </button>
        ))}

        {/* Custom Range Toggle */}
        <button
          onClick={() => setIsCustomOpen(!isCustomOpen)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 hover:shadow-sm flex items-center ${
            selectedTimeline === 'CUSTOM'
              ? 'bg-gray-50 text-gray-700 border-gray-300 ring-2 ring-gray-200 ring-offset-1'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          Custom
          <ChevronDownIcon className={`ml-1 w-3 h-3 transition-transform ${isCustomOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Custom Date Picker */}
      {isCustomOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-80">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Select Custom Range</h4>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customDates.startDate}
                onChange={(e) => setCustomDates(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customDates.endDate}
                onChange={(e) => setCustomDates(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCustomOpen(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomDateSubmit}
              disabled={!customDates.startDate || !customDates.endDate}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}

      {/* Selected Range Indicator */}
      <div className="text-xs text-gray-500 mt-2 flex items-center">
        <div className={`w-2 h-2 rounded-full mr-2 ${getSelectedRange().color.split(' ')[0]}`}></div>
        Currently viewing: {getSelectedRange().label}
        {selectedTimeline !== 'CUSTOM' && (
          <span className="ml-2 text-gray-400">
            (Aggregated by {getOptimalAggregation(getSelectedRange().days || 30)})
          </span>
        )}
      </div>
    </div>
  );
};

export default TimelineFilter;