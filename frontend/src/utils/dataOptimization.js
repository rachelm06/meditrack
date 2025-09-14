/**
 * Data Optimization Utilities for Large Dataset Visualization
 * Handles data sampling, aggregation, and performance optimization
 */

export const DataOptimizer = {
  // Maximum data points before optimization kicks in
  MAX_POINTS: {
    line: 1000,     // Line charts
    bar: 500,       // Bar charts
    scatter: 2000,  // Scatter plots
    area: 800       // Area charts
  },

  /**
   * Intelligent data sampling based on chart type and dataset size
   */
  optimizeDataset: (data, chartType = 'line', maxPoints = null) => {
    if (!data || data.length === 0) return data;

    const limit = maxPoints || DataOptimizer.MAX_POINTS[chartType] || 1000;

    if (data.length <= limit) {
      return data;
    }

    // Choose optimization strategy based on data characteristics
    const hasTimeData = DataOptimizer.detectTimeData(data);

    if (hasTimeData) {
      return DataOptimizer.timeBasedSampling(data, limit);
    } else {
      return DataOptimizer.statisticalSampling(data, limit);
    }
  },

  /**
   * Detect if dataset contains time-based data
   */
  detectTimeData: (data) => {
    if (!data.length) return false;

    const sample = data[0];
    const timeFields = ['date', 'time', 'timestamp', 'created_at', 'updated_at', 'ds'];

    return timeFields.some(field => {
      if (sample[field]) {
        const value = sample[field];
        return !isNaN(Date.parse(value));
      }
      return false;
    });
  },

  /**
   * Time-based sampling for temporal data
   */
  timeBasedSampling: (data, targetPoints) => {
    const sorted = [...data].sort((a, b) => {
      const aTime = DataOptimizer.getTimeValue(a);
      const bTime = DataOptimizer.getTimeValue(b);
      return new Date(aTime) - new Date(bTime);
    });

    const interval = Math.ceil(sorted.length / targetPoints);
    const sampled = [];

    for (let i = 0; i < sorted.length; i += interval) {
      // Take the original point plus aggregate nearby points
      const window = sorted.slice(i, i + interval);
      const aggregated = DataOptimizer.aggregateWindow(window, interval > 1);
      sampled.push(aggregated);
    }

    return sampled;
  },

  /**
   * Statistical sampling for non-temporal data
   */
  statisticalSampling: (data, targetPoints) => {
    const interval = Math.ceil(data.length / targetPoints);
    const sampled = [];

    // Always include first and last points
    sampled.push(data[0]);

    for (let i = interval; i < data.length - interval; i += interval) {
      sampled.push(data[i]);
    }

    sampled.push(data[data.length - 1]);
    return sampled;
  },

  /**
   * Get time value from a data point
   */
  getTimeValue: (point) => {
    const timeFields = ['date', 'time', 'timestamp', 'created_at', 'updated_at', 'ds'];
    for (const field of timeFields) {
      if (point[field]) return point[field];
    }
    return null;
  },

  /**
   * Aggregate a window of data points
   */
  aggregateWindow: (window, shouldAggregate = true) => {
    if (!shouldAggregate || window.length <= 1) {
      return window[0];
    }

    const result = { ...window[0] };
    const numericFields = DataOptimizer.getNumericFields(window[0]);

    // Aggregate numeric fields
    numericFields.forEach(field => {
      const values = window.map(item => item[field]).filter(val => val != null && !isNaN(val));
      if (values.length > 0) {
        result[field] = DataOptimizer.aggregateValues(values);
        result[`${field}_min`] = Math.min(...values);
        result[`${field}_max`] = Math.max(...values);
        result[`${field}_count`] = values.length;
      }
    });

    return result;
  },

  /**
   * Get numeric field names from a data point
   */
  getNumericFields: (point) => {
    return Object.keys(point).filter(key => {
      const value = point[key];
      return typeof value === 'number' && !isNaN(value);
    });
  },

  /**
   * Aggregate numeric values (can be customized per use case)
   */
  aggregateValues: (values) => {
    // Default to mean, but could be sum, median, etc.
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  },

  /**
   * Dynamic aggregation based on time range
   */
  getAggregationLevel: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) return 'hour';
    if (diffDays <= 7) return 'day';
    if (diffDays <= 30) return 'day';
    if (diffDays <= 90) return 'week';
    if (diffDays <= 365) return 'week';
    return 'month';
  },

  /**
   * Aggregate data by time periods
   */
  aggregateByTimePeriod: (data, period = 'day') => {
    const groups = {};

    data.forEach(item => {
      const timeValue = DataOptimizer.getTimeValue(item);
      if (!timeValue) return;

      const key = DataOptimizer.getTimePeriodKey(timeValue, period);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.keys(groups).map(key => {
      const window = groups[key];
      return DataOptimizer.aggregateWindow(window, true);
    });
  },

  /**
   * Get time period key for grouping
   */
  getTimePeriodKey: (timeValue, period) => {
    const date = new Date(timeValue);

    switch (period) {
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'week':
        const week = DataOptimizer.getWeekNumber(date);
        return `${date.getFullYear()}-W${week}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth()}`;
      case 'year':
        return `${date.getFullYear()}`;
      default:
        return timeValue;
    }
  },

  /**
   * Get ISO week number
   */
  getWeekNumber: (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  /**
   * Performance monitoring for data processing
   */
  withPerformanceMonitoring: (fn, label = 'Data Processing') => {
    return (...args) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();

      if (end - start > 100) { // Log if processing takes > 100ms
        console.warn(`${label} took ${(end - start).toFixed(2)}ms`, {
          inputSize: args[0]?.length,
          outputSize: result?.length
        });
      }

      return result;
    };
  },

  /**
   * Intelligent chart type recommendations based on data
   */
  recommendChartType: (data, xField, yFields) => {
    if (!data.length) return 'line';

    const dataSize = data.length;
    const hasTimeData = DataOptimizer.detectTimeData(data);
    const numSeries = yFields.length;

    if (hasTimeData) {
      if (dataSize > 1000) return 'area'; // Better for large temporal datasets
      if (numSeries > 3) return 'area';   // Better for multiple series
      return 'line';
    }

    if (dataSize > 100) return 'bar';
    if (numSeries === 1) return 'bar';
    return 'line';
  }
};

export default DataOptimizer;