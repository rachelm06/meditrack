import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Predictions = () => {
  const [predictions, setPredictions] = useState({});
  const [selectedItem, setSelectedItem] = useState('');
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const availableItems = [
    'Surgical Masks',
    'Disposable Gloves',
    'Hand Sanitizer',
    'Antibiotics - Amoxicillin',
    'Digital Thermometer',
    'Syringes',
    'Bandages',
    'Gauze Pads'
  ];

  // Sample prediction data
  const samplePredictionData = [
    { date: '2024-01-01', predicted: 120, actual: 115, confidence_lower: 100, confidence_upper: 140 },
    { date: '2024-01-08', predicted: 135, actual: 130, confidence_lower: 115, confidence_upper: 155 },
    { date: '2024-01-15', predicted: 145, actual: null, confidence_lower: 125, confidence_upper: 165 },
    { date: '2024-01-22', predicted: 160, actual: null, confidence_lower: 140, confidence_upper: 180 },
    { date: '2024-01-29', predicted: 155, actual: null, confidence_lower: 135, confidence_upper: 175 },
    { date: '2024-02-05', predicted: 170, actual: null, confidence_lower: 150, confidence_upper: 190 },
    { date: '2024-02-12', predicted: 165, actual: null, confidence_lower: 145, confidence_upper: 185 },
  ];

  const budgetImpactData = [
    { item: 'Surgical Masks', current_cost: 225, predicted_cost: 400, savings_opportunity: 50 },
    { item: 'Disposable Gloves', current_cost: 450, predicted_cost: 520, savings_opportunity: 30 },
    { item: 'Hand Sanitizer', current_cost: 180, predicted_cost: 280, savings_opportunity: 75 },
    { item: 'Antibiotics', current_cost: 940, predicted_cost: 1200, savings_opportunity: 120 },
  ];

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
          confidence_interval: [145, 185],
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
        <h1 className="text-3xl font-bold text-gray-900">Demand Predictions & Analytics</h1>
        <p className="mt-2 text-gray-600">Forecast inventory demand using machine learning models</p>
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
            <div className="metric-value text-green-600">
              {currentPrediction.confidence_interval ?
                `${currentPrediction.confidence_interval[0]}-${currentPrediction.confidence_interval[1]}` :
                '145-185'
              }
            </div>
            <div className="metric-label">Confidence Range</div>
            <div className="text-sm text-gray-500 mt-1">
              95% confidence interval
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
                <Line
                  type="monotone"
                  dataKey="confidence_upper"
                  stroke="#94A3B8"
                  strokeWidth={1}
                  dot={false}
                  name="Upper Confidence"
                />
                <Line
                  type="monotone"
                  dataKey="confidence_lower"
                  stroke="#94A3B8"
                  strokeWidth={1}
                  dot={false}
                  name="Lower Confidence"
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
        </div>
        <div className="p-6">
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={budgetImpactData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Legend />
                <Bar dataKey="current_cost" fill="#10B981" name="Current Monthly Cost" />
                <Bar dataKey="predicted_cost" fill="#F59E0B" name="Predicted Monthly Cost" />
                <Bar dataKey="savings_opportunity" fill="#3B82F6" name="Potential Savings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Predictions;