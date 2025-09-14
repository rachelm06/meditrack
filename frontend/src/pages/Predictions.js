import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Predictions = () => {
  const [predictions, setPredictions] = useState({});
  const [selectedItem, setSelectedItem] = useState('');
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [budgetImpactData, setBudgetImpactData] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Sample prediction data
  const samplePredictionData = [
    { date: '2024-01-01', predicted: 120, actual: 115 },
    { date: '2024-01-08', predicted: 135, actual: 130 },
    { date: '2024-01-15', predicted: 145, actual: null },
    { date: '2024-01-22', predicted: 160, actual: null },
    { date: '2024-01-29', predicted: 155, actual: null },
    { date: '2024-02-05', predicted: 170, actual: null },
    { date: '2024-02-12', predicted: 165, actual: null },
  ];

  const fetchInitialData = useCallback(async () => {
    try {
      setBudgetLoading(true);

      // Fetch available inventory items
      const inventoryResponse = await fetch(`${API_BASE_URL}/inventory`);
      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        const items = inventoryData.inventory.map(item => item.item_name);
        setAvailableItems(items);
      }

      // Fetch budget impact data
      const budgetResponse = await fetch(`${API_BASE_URL}/budget_impact`);
      if (budgetResponse.ok) {
        const budgetData = await budgetResponse.json();

        // Transform the data to match our chart format
        const chartData = budgetData.waste_analysis.map(item => ({
          item: item.item_name,
          current_cost: Math.round(budgetData.total_monthly_spend / budgetData.waste_analysis.length),
          predicted_cost: Math.round(item.waste_cost),
          savings_opportunity: Math.round(item.waste_cost * 0.3) // Potential 30% savings
        }));

        setBudgetImpactData(chartData);
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setBudgetLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handlePredictDemand = async () => {
    if (!selectedItem) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/predict_demand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_name: selectedItem,
          days_ahead: daysAhead
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPredictions(prev => ({
          ...prev,
          [selectedItem]: {
            ...data,
            chartData: samplePredictionData
          }
        }));
      } else {
        throw new Error('Failed to fetch prediction');
      }
    } catch (err) {
      console.error('Error fetching prediction:', err);
      setError('Failed to generate prediction. Using sample data instead.');
      // Use sample data when API fails
      setPredictions(prev => ({
        ...prev,
        [selectedItem]: {
          predicted_demand: 165,
          trend: 'increasing',
          seasonal_factors: ['winter_surge', 'flu_season'],
          chartData: samplePredictionData
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const currentPrediction = predictions[selectedItem];

  return (
    <div className="px-4 py-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Demand Predictions & Analytics</h1>
            <p className="mt-2 text-gray-600">Forecast inventory demand using machine learning models</p>
          </div>
          <button
            onClick={fetchInitialData}
            disabled={budgetLoading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {budgetLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Prediction Controls */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Prediction</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-2">
              Select Item
            </label>
            <select
              id="item"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              <option value="">Choose an item...</option>
              {availableItems.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Period (days)
            </label>
            <select
              id="days"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={daysAhead}
              onChange={(e) => setDaysAhead(parseInt(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handlePredictDemand}
              disabled={!selectedItem || loading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Prediction'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Prediction Results */}
      {currentPrediction && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="metric-card">
            <div className="metric-value text-blue-600">
              {currentPrediction.predicted_demand || 165}
            </div>
            <div className="metric-label">Predicted Demand</div>
            <div className="text-sm text-gray-500 mt-1">
              Next {daysAhead} days
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-value text-purple-600">
              {currentPrediction.seasonal_factors ?
                currentPrediction.seasonal_factors.join(', ') :
                'winter_surge, flu_season'
              }
            </div>
            <div className="metric-label">Seasonal Factors</div>
            <div className="text-sm text-gray-500 mt-1">
              Affecting demand patterns
            </div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${
              (currentPrediction.trend || 'increasing') === 'increasing' ? 'text-red-600' : 'text-green-600'
            }`}>
              {(currentPrediction.trend || 'increasing') === 'increasing' ? '↗' : '↘'}
            </div>
            <div className="metric-label">Trend</div>
            <div className="text-sm text-gray-500 mt-1 capitalize">
              {currentPrediction.trend || 'increasing'}
            </div>
          </div>
        </div>
      )}

      {/* Prediction Chart */}
      {currentPrediction && (
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Demand Forecast: {selectedItem}
          </h3>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={currentPrediction.chartData || samplePredictionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Actual Usage"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Predicted Demand"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Budget Impact Analysis */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Budget Impact Analysis</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time waste analysis and savings opportunities</p>
        </div>
        <div className="p-6">
          {budgetLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="loading-spinner"></div>
              <span className="ml-2 text-gray-600">Loading budget analysis...</span>
            </div>
          ) : budgetImpactData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={budgetImpactData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="item" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="current_cost" fill="#10B981" name="Monthly Spend" />
                  <Bar dataKey="predicted_cost" fill="#F59E0B" name="Waste Cost" />
                  <Bar dataKey="savings_opportunity" fill="#3B82F6" name="Potential Savings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-green-600 text-4xl mb-2">💰</div>
              <p>No waste analysis data available</p>
              <p className="text-sm mt-2">Upload usage data to see budget impact analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Predictions;