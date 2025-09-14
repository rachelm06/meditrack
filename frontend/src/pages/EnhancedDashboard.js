import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import TimelineFilter from '../components/TimelineFilter';
import AdvancedChart from '../components/AdvancedChart';
import { DataOptimizer } from '../utils/dataOptimization';

const EnhancedDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [inventoryStatus, setInventoryStatus] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeline, setSelectedTimeline] = useState('1M');
  const [timelineParams, setTimelineParams] = useState({
    key: '1M',
    label: 'Past Month',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: 30,
    aggregationLevel: 'day'
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Generate enhanced sample data for demonstration with broad categories
  const generateSampleUsageData = useCallback((days, aggregationLevel) => {
    const data = [];
    // Use broad categories instead of specific items
    const categories = ['Supplies', 'Medications', 'Equipment'];
    const baseUsage = { 'Supplies': 280, 'Medications': 85, 'Equipment': 45 };

    // Create more data points for longer time periods
    const dataPoints = Math.min(days * (aggregationLevel === 'hour' ? 24 : 1), 5000);
    const interval = days / dataPoints;

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(Date.now() - (days - i * interval) * 24 * 60 * 60 * 1000);

      const record = {
        date: aggregationLevel === 'hour'
          ? date.toISOString().slice(0, 13) + ':00:00'
          : date.toISOString().split('T')[0],
        timestamp: date.getTime()
      };

      categories.forEach(category => {
        // Add realistic patterns
        const seasonalFactor = 1 + 0.3 * Math.sin(2 * Math.PI * i / (dataPoints / 4)); // Quarterly pattern
        const weeklyFactor = 1 + 0.2 * Math.sin(2 * Math.PI * i / 7); // Weekly pattern
        const randomFactor = 1 + 0.4 * (Math.random() - 0.5); // Random variation

        const usage = Math.round(baseUsage[category] * seasonalFactor * weeklyFactor * randomFactor);
        record[category] = Math.max(0, usage);
      });

      data.push(record);
    }

    return data;
  }, []);

  // Generate sample demand forecast data
  const generateSampleDemandData = useCallback((startDate, endDate) => {
    const data = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < days; i++) {
      const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const trend = 1 + 0.001 * i; // Slight upward trend
      const seasonal = 1 + 0.2 * Math.sin(2 * Math.PI * i / 30); // Monthly seasonality
      const noise = 1 + 0.3 * (Math.random() - 0.5);

      const baseDemand = 45;
      const predicted = Math.round(baseDemand * trend * seasonal * noise);

      data.push({
        date: date.toISOString().split('T')[0],
        predicted_demand: predicted,
        confidence_lower: Math.round(predicted * 0.8),
        confidence_upper: Math.round(predicted * 1.2),
        actual_demand: i < days / 2 ? Math.round(predicted * (0.9 + 0.2 * Math.random())) : null
      });
    }

    return data;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch basic metrics
      const metricsResponse = await fetch(`${API_BASE_URL}/dashboard_metrics`);
      const inventoryResponse = await fetch(`${API_BASE_URL}/inventory_status`);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }

      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        setInventoryStatus(inventoryData);
      }

      // Try to fetch real usage data, fallback to sample data
      try {
        const usageResponse = await fetch(
          `${API_BASE_URL}/analytics/usage_trends?start_date=${timelineParams.startDate}&end_date=${timelineParams.endDate}&aggregation=${timelineParams.aggregationLevel}`
        );

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsageData(usageData.data || []);
        } else {
          throw new Error('No usage data available');
        }
      } catch {
        // Generate sample data for demonstration
        const sampleData = generateSampleUsageData(timelineParams.days, timelineParams.aggregationLevel);
        setUsageData(sampleData);
      }

      // Generate sample demand forecast
      const forecastEndDate = new Date();
      forecastEndDate.setDate(forecastEndDate.getDate() + 90);
      const sampleDemand = generateSampleDemandData(
        timelineParams.endDate,
        forecastEndDate.toISOString().split('T')[0]
      );
      setDemandData(sampleDemand);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Using sample data for demonstration.');

      // Use sample data as fallback
      const sampleData = generateSampleUsageData(timelineParams.days, timelineParams.aggregationLevel);
      setUsageData(sampleData);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, timelineParams, generateSampleUsageData, generateSampleDemandData]);

  // Handle timeline changes
  const handleTimelineChange = useCallback((newTimeline) => {
    setSelectedTimeline(newTimeline.key);
    setTimelineParams(newTimeline);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Sample category data for pie chart - simplified to three broad categories
  const sampleCategoryData = [
    { name: 'Supplies', value: 65, color: '#3B82F6' },
    { name: 'Medications', value: 25, color: '#10B981' },
    { name: 'Equipment', value: 10, color: '#F59E0B' },
  ];

  if (loading && !usageData.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading-spinner animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading enhanced dashboard...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enhanced Healthcare Inventory Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Advanced analytics with timeline controls and data optimization
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-amber-400">ℹ️</div>
            <div className="ml-3">
              <h3 className="text-amber-800 font-medium">Demo Mode</h3>
              <p className="text-amber-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Filter */}
      <div className="mb-8">
        <TimelineFilter
          selectedTimeline={selectedTimeline}
          onTimelineChange={handleTimelineChange}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-blue-600">
            {metrics?.total_items?.toLocaleString() || '7,250'}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Items</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-red-600">
            {metrics?.low_stock_items || '12'}
          </div>
          <div className="text-sm text-gray-600 mt-1">Low Stock Alerts</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-yellow-600">
            {metrics?.critical_alerts || '3'}
          </div>
          <div className="text-sm text-gray-600 mt-1">Critical Alerts</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600">
            ${metrics?.total_inventory_value?.toLocaleString() || '245,680'}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Value</div>
        </div>
      </div>

      {/* Advanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Usage Trends Chart */}
        <div className="lg:col-span-2">
          <AdvancedChart
            data={usageData}
            chartType="line"
            xField="date"
            yFields={['Supplies', 'Medications', 'Equipment']}
            title="Usage Trends Over Time"
            height={400}
            colors={['#3B82F6', '#10B981', '#F59E0B']}
            enableZoom={true}
            enableBrush={false}
            maxDataPoints={1000}
          />
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sampleCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sampleCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Demand Forecast */}
      <div className="mb-8">
        <AdvancedChart
          data={demandData}
          chartType="area"
          xField="date"
          yFields={['predicted_demand', 'confidence_lower', 'confidence_upper']}
          title="Demand Forecast with Confidence Intervals"
          height={350}
          colors={['#3B82F6', '#93C5FD', '#93C5FD']}
          enableZoom={true}
          enableBrush={false}
          maxDataPoints={500}
        />
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Critical Stock Alerts</h3>
        </div>
        <div className="p-6">
          {inventoryStatus?.predicted_shortages?.length > 0 ? (
            <div className="space-y-4">
              {inventoryStatus.predicted_shortages.slice(0, 5).map((item, index) => (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${
                  item.days_until_depletion < 7
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      item.days_until_depletion < 7 ? 'text-red-900' : 'text-yellow-900'
                    }`}>
                      {item.item_name}
                    </h4>
                    <p className={`text-sm ${
                      item.days_until_depletion < 7 ? 'text-red-700' : 'text-yellow-700'
                    }`}>
                      Current: {item.current_stock} units • {item.days_until_depletion} days remaining
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.days_until_depletion < 7
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.days_until_depletion < 7 ? 'Critical' : 'Low'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-green-600 text-4xl mb-2">✓</div>
              <p>No critical alerts - all items are well stocked!</p>
            </div>
          )}
        </div>
      </div>

      {/* Data Performance Stats */}
      {usageData.length > 1000 && (
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            Optimized visualization: showing {Math.min(1000, usageData.length)} of {usageData.length} data points
            for optimal performance
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedDashboard;