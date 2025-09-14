import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import AIAgent from '../components/AIAgent';
import EmergencyAlerts from '../components/EmergencyAlerts';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [inventoryStatus, setInventoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAgentOpen, setAiAgentOpen] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch dashboard metrics
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

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Listen for inventory updates to refresh dashboard metrics
  useEffect(() => {
    const handleInventoryUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    return () => window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
  }, [fetchDashboardData]);

  // Sample data for demonstration
  const sampleUsageData = [
    { month: 'Jan', supplies: 120, medications: 80, equipment: 30 },
    { month: 'Feb', supplies: 140, medications: 95, equipment: 25 },
    { month: 'Mar', supplies: 180, medications: 110, equipment: 40 },
    { month: 'Apr', supplies: 160, medications: 85, equipment: 35 },
    { month: 'May', supplies: 200, medications: 120, equipment: 45 },
    { month: 'Jun', supplies: 175, medications: 100, equipment: 38 },
  ];

  const sampleCategoryData = [
    { name: 'Medical Supplies', value: 45, color: '#3B82F6' },
    { name: 'Medications', value: 30, color: '#10B981' },
    { name: 'Equipment', value: 15, color: '#F59E0B' },
    { name: 'Other', value: 10, color: '#EF4444' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Healthcare Inventory Dashboard</h1>
            <p className="mt-2 text-gray-600">Monitor your inventory levels, usage patterns, and predictions</p>
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
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400">⚠️</div>
            <div className="ml-3">
              <h3 className="text-red-800 font-medium">Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Promotion Banner */}
      {!aiAgentOpen && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">New: AI Supply Chain Assistant</h3>
                <p className="text-sm text-blue-700">
                  Get instant answers about emergency purchases, trends, and supply forecasts
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setAiAgentOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                Try Now
              </button>
              <button
                onClick={() => setAiAgentOpen(true)}
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                See bottom-right corner →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Alerts - High Priority */}
      <div className="mb-8">
        <EmergencyAlerts />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="metric-card">
          <div className="metric-value text-blue-600">
            {metrics?.total_items || '--'}
          </div>
          <div className="metric-label">Total Items</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-red-600">
            {metrics?.low_stock_items || '--'}
          </div>
          <div className="metric-label">Low Stock</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-yellow-600">
            {metrics?.critical_alerts || '--'}
          </div>
          <div className="metric-label">Critical Alerts</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-green-600">
            ${metrics?.total_inventory_value ? metrics.total_inventory_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'}
          </div>
          <div className="metric-label">Total Value</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Usage Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Usage Trends</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sampleUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="supplies" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="medications" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="equipment" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Category</h3>
          <div className="chart-container">
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
        </div>
        <div className="p-6">
          {inventoryStatus?.predicted_shortages?.length > 0 ? (
            <div className="space-y-4">
              {inventoryStatus.predicted_shortages.map((item, index) => (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${
                  item.days_until_depletion < 7
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div>
                    <h4 className={`font-medium ${
                      item.days_until_depletion < 7 ? 'text-red-900' : 'text-yellow-900'
                    }`}>
                      {item.item_name}
                    </h4>
                    <p className={`text-sm ${
                      item.days_until_depletion < 7 ? 'text-red-700' : 'text-yellow-700'
                    }`}>
                      Current stock: {item.current_stock} units - {item.days_until_depletion} days left
                    </p>
                  </div>
                  <span className={`status-indicator ${
                    item.days_until_depletion < 7 ? 'status-low' : 'status-high'
                  }`}>
                    {item.days_until_depletion < 7 ? 'Critical' : 'Low'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-green-600 text-4xl mb-2">✓</div>
              <p>No low stock alerts - all items are well stocked!</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Agent - Floating Assistant */}
      <AIAgent
        isOpen={aiAgentOpen}
        onToggle={() => setAiAgentOpen(!aiAgentOpen)}
      />
    </div>
  );
};

export default Dashboard;