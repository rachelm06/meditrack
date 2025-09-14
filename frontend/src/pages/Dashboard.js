import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [inventoryStatus, setInventoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <h1 className="text-3xl font-bold text-gray-900">Healthcare Inventory Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor your inventory levels, usage patterns, and predictions</p>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="metric-card">
          <div className="metric-value text-blue-600">247</div>
          <div className="metric-label">Total Items</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-red-600">23</div>
          <div className="metric-label">Low Stock</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-yellow-600">12</div>
          <div className="metric-label">Expiring Soon</div>
        </div>
        <div className="metric-card">
          <div className="metric-value text-green-600">$45,670</div>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <h4 className="font-medium text-red-900">Surgical Masks</h4>
                <p className="text-sm text-red-700">Current stock: 45 units (Min: 100)</p>
              </div>
              <span className="status-indicator status-low">Critical</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div>
                <h4 className="font-medium text-yellow-900">Disposable Gloves</h4>
                <p className="text-sm text-yellow-700">Current stock: 180 units (Min: 150)</p>
              </div>
              <span className="status-indicator status-high">Low</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <h4 className="font-medium text-red-900">Hand Sanitizer</h4>
                <p className="text-sm text-red-700">Current stock: 12 bottles (Min: 50)</p>
              </div>
              <span className="status-indicator status-low">Critical</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;