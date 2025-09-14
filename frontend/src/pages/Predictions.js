import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import TimelineFilter from '../components/TimelineFilter';
import AdvancedChart from '../components/AdvancedChart';

const Predictions = () => {
  const [predictions, setPredictions] = useState({});
  const [selectedItem, setSelectedItem] = useState('');
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [budgetImpactData, setBudgetImpactData] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [usageData, setUsageData] = useState([]);
  const [selectedTimeline, setSelectedTimeline] = useState('1M');
  const [usageViewMode, setUsageViewMode] = useState('all'); // 'all' or 'specific'
  const [specificItemUsageData, setSpecificItemUsageData] = useState([]);
  const [budgetViewMode, setBudgetViewMode] = useState('all'); // 'all' or 'specific'
  const [timelineParams, setTimelineParams] = useState({
    key: '1M',
    label: 'Past Month',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: 30,
    aggregationLevel: 'day'
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Category mapping for grouping items
  const getCategoryForItem = (itemName) => {
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('mask') || lowerName.includes('gloves') || lowerName.includes('sanitizer') ||
        lowerName.includes('syringe') || lowerName.includes('bandage') || lowerName.includes('shield')) {
      return 'Supplies';
    }
    if (lowerName.includes('acetaminophen') || lowerName.includes('ibuprofen') || lowerName.includes('insulin') ||
        lowerName.includes('medicine') || lowerName.includes('medication')) {
      return 'Medications';
    }
    if (lowerName.includes('thermometer') || lowerName.includes('ventilator') || lowerName.includes('oximeter') ||
        lowerName.includes('equipment') || lowerName.includes('iv bag')) {
      return 'Equipment';
    }
    return 'Supplies'; // Default fallback
  };

  // Transform API usage data to chart format with proper categories
  const transformUsageData = useCallback((apiData) => {
    if (!apiData || apiData.length === 0) return [];

    // Group data by date and aggregate by category
    const dateGroups = {};

    apiData.forEach(item => {
      const date = item.date;
      const category = getCategoryForItem(item.item_name);

      if (!dateGroups[date]) {
        dateGroups[date] = {
          date,
          timestamp: new Date(date).getTime(),
          Supplies: 0,
          Medications: 0,
          Equipment: 0
        };
      }
      dateGroups[date][category] += item.total_usage;
    });

    // Convert to array and sort by date
    return Object.values(dateGroups).sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Filter budget data based on view mode and selected item
  const filteredBudgetData = useMemo(() => {
    if (budgetViewMode === 'specific' && selectedItem) {
      // Try exact match first, then partial match for more flexible filtering
      const exactMatch = budgetImpactData.filter(item =>
        item.item.toLowerCase() === selectedItem.toLowerCase()
      );

      if (exactMatch.length > 0) {
        return exactMatch;
      }

      // If no exact match, try partial match
      return budgetImpactData.filter(item =>
        item.item.toLowerCase().includes(selectedItem.toLowerCase()) ||
        selectedItem.toLowerCase().includes(item.item.toLowerCase())
      );
    }
    return budgetImpactData;
  }, [budgetImpactData, budgetViewMode, selectedItem]);

  // Transform API data for specific item view
  const transformSpecificItemData = (apiData, itemName) => {
    if (!apiData || apiData.length === 0) return [];

    // Filter for specific item and create chart format
    const itemData = apiData
      .filter(item => item.item_name === itemName)
      .map(item => ({
        date: item.date,
        timestamp: new Date(item.date).getTime(),
        [itemName]: item.total_usage
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return itemData;
  };

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

  // Generate enhanced sample data for demonstration with broad categories
  const generateSampleUsageData = useCallback((days, aggregationLevel) => {
    const data = [];
    const categories = ['Supplies', 'Medications', 'Equipment'];
    const baseUsage = { 'Supplies': 280, 'Medications': 85, 'Equipment': 45 };

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
        const seasonalFactor = 1 + 0.3 * Math.sin(2 * Math.PI * i / (dataPoints / 4));
        const weeklyFactor = 1 + 0.2 * Math.sin(2 * Math.PI * i / 7);
        const randomFactor = 1 + 0.4 * (Math.random() - 0.5);

        const usage = Math.round(baseUsage[category] * seasonalFactor * weeklyFactor * randomFactor);
        record[category] = Math.max(0, usage);
      });

      data.push(record);
    }

    return data;
  }, []);

  // Generate sample usage data for a specific item
  const generateSpecificItemUsageData = useCallback((itemName, days, aggregationLevel) => {
    const data = [];
    const baseUsage = 150; // Base usage for any specific item

    const dataPoints = Math.min(days * (aggregationLevel === 'hour' ? 24 : 1), 5000);
    const interval = days / dataPoints;

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(Date.now() - (days - i * interval) * 24 * 60 * 60 * 1000);

      // Add realistic patterns specific to the item
      const seasonalFactor = 1 + 0.3 * Math.sin(2 * Math.PI * i / (dataPoints / 4));
      const weeklyFactor = 1 + 0.2 * Math.sin(2 * Math.PI * i / 7);
      const randomFactor = 1 + 0.4 * (Math.random() - 0.5);

      const usage = Math.round(baseUsage * seasonalFactor * weeklyFactor * randomFactor);

      data.push({
        date: aggregationLevel === 'hour'
          ? date.toISOString().slice(0, 13) + ':00:00'
          : date.toISOString().split('T')[0],
        [itemName]: Math.max(0, usage),
        timestamp: date.getTime()
      });
    }

    return data;
  }, []);


  // Handle timeline changes
  const handleTimelineChange = useCallback((newTimeline) => {
    setSelectedTimeline(newTimeline.key);
    setTimelineParams(newTimeline);
  }, []);

  // Auto-select appropriate timeline based on forecast period
  const getTimelineForForecastDays = useCallback((days) => {
    if (days <= 7) return '1W';        // 7 days -> Past Week
    if (days <= 14) return '2W';       // 14 days -> Past 2 Weeks
    if (days <= 30) return '1M';       // 30 days -> Past Month
    if (days <= 60) return '2M';       // 60 days -> Past 2 Months
    if (days <= 90) return '3M';       // 90 days -> Past 3 Months
    if (days <= 180) return '6M';      // Anything up to 180 days -> Past 6 Months
    return '1Y';                       // Anything longer -> Past Year
  }, []);

  // Auto-update timeline when forecast period changes
  const handleDaysAheadChange = useCallback((newDaysAhead) => {
    setDaysAhead(newDaysAhead);

    // Auto-select corresponding timeline
    const suggestedTimeline = getTimelineForForecastDays(newDaysAhead);

    // Only update if it's different from current selection
    if (suggestedTimeline !== selectedTimeline) {
      // Find the timeline object with the matching key (matches TimelineFilter options)
      const timelineOptions = [
        { key: '1W', label: 'Past Week', days: 7, aggregationLevel: 'day' },
        { key: '2W', label: 'Past 2 Weeks', days: 14, aggregationLevel: 'day' },
        { key: '1M', label: 'Past Month', days: 30, aggregationLevel: 'day' },
        { key: '2M', label: 'Past 2 Months', days: 60, aggregationLevel: 'day' },
        { key: '3M', label: 'Past 3 Months', days: 90, aggregationLevel: 'week' },
        { key: '6M', label: 'Past 6 Months', days: 180, aggregationLevel: 'week' },
        { key: '1Y', label: 'Past Year', days: 365, aggregationLevel: 'month' },
      ];

      const matchingTimeline = timelineOptions.find(t => t.key === suggestedTimeline);
      if (matchingTimeline) {
        const newTimelineParams = {
          ...matchingTimeline,
          startDate: new Date(Date.now() - matchingTimeline.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        };
        setSelectedTimeline(suggestedTimeline);
        setTimelineParams(newTimelineParams);
      }
    }
  }, [selectedTimeline, getTimelineForForecastDays]);

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
          current_cost: Math.round(budgetData.total_monthly_spend / budgetData.waste_analysis.length), // Monthly average spend per category
          predicted_cost: Math.round(item.waste_cost), // Monthly waste cost based on usage patterns
          savings_opportunity: Math.round(item.waste_cost * 0.3) // 30% of waste cost could be saved with better management
        }));

        setBudgetImpactData(chartData);
      }

      // Try to fetch real usage data, fallback to sample data
      try {
        const usageResponse = await fetch(
          `${API_BASE_URL}/analytics/usage_trends?start_date=${timelineParams.startDate}&end_date=${timelineParams.endDate}&aggregation=${timelineParams.aggregationLevel}`
        );

        if (usageResponse.ok) {
          const usageResponse_data = await usageResponse.json();
          const rawUsageData = usageResponse_data.data || [];

          // Transform API data to chart format for categories
          const transformedData = transformUsageData(rawUsageData);
          setUsageData(transformedData);

          // Store raw data for specific item transformations
          window.rawUsageData = rawUsageData; // Temporary storage for specific item view
        } else {
          throw new Error('No usage data available');
        }
      } catch {
        // Generate sample data for demonstration
        const sampleData = generateSampleUsageData(timelineParams.days, timelineParams.aggregationLevel);
        setUsageData(sampleData);
      }

      // Generate specific item usage data if an item is selected
      if (selectedItem && window.rawUsageData) {
        const specificData = transformSpecificItemData(window.rawUsageData, selectedItem);
        setSpecificItemUsageData(specificData);
      } else if (selectedItem) {
        // Fallback to generated data if no API data available
        const specificData = generateSpecificItemUsageData(selectedItem, timelineParams.days, timelineParams.aggregationLevel);
        setSpecificItemUsageData(specificData);
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
      // Use sample data as fallback
      const sampleData = generateSampleUsageData(timelineParams.days, timelineParams.aggregationLevel);
      setUsageData(sampleData);
    } finally {
      setBudgetLoading(false);
    }
  }, [API_BASE_URL, timelineParams, selectedItem, generateSampleUsageData, generateSpecificItemUsageData, transformUsageData]);

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
              onChange={(e) => handleDaysAheadChange(parseInt(e.target.value))}
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

      {/* Timeline Filter */}
      <div className="mb-8">
        <TimelineFilter
          selectedTimeline={selectedTimeline}
          onTimelineChange={handleTimelineChange}
        />
      </div>

      {/* Advanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Usage Trends Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Chart Header with Toggle */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Usage Trends Over Time</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setUsageViewMode('all')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    usageViewMode === 'all'
                      ? 'bg-blue-100 text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  All Categories
                </button>
                <button
                  onClick={() => setUsageViewMode('specific')}
                  disabled={!selectedItem}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    usageViewMode === 'specific' && selectedItem
                      ? 'bg-blue-100 text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  } ${!selectedItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!selectedItem ? 'Select an item above to view specific usage' : ''}
                >
                  {selectedItem || 'Select Item'}
                </button>
              </div>
            </div>
            {/* Chart Content */}
            <div className="p-4">
              <AdvancedChart
                data={usageViewMode === 'all' ? usageData : specificItemUsageData}
                chartType="line"
                xField="date"
                yFields={usageViewMode === 'all' ? ['Supplies', 'Medications', 'Equipment'] : [selectedItem || 'Item']}
                title=""
                height={400}
                colors={usageViewMode === 'all' ? ['#3B82F6', '#10B981', '#F59E0B'] : ['#3B82F6']}
                enableZoom={true}
                enableBrush={false}
                maxDataPoints={1000}
              />
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={[
                    { name: 'Supplies', value: 65, color: '#3B82F6', fullName: 'Medical Supplies' },
                    { name: 'Medications', value: 25, color: '#10B981', fullName: 'Medications & Drugs' },
                    { name: 'Equipment', value: 10, color: '#F59E0B', fullName: 'Medical Equipment' },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Supplies', value: 65, color: '#3B82F6' },
                    { name: 'Medications', value: 25, color: '#10B981' },
                    { name: 'Equipment', value: 10, color: '#F59E0B' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, entry) => [
                    `${value}%`,
                    entry.payload.fullName || name
                  ]}
                  labelFormatter={() => ''}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry) => entry.payload.fullName || value}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Separator and Header for Specific Item Predictions */}
      {selectedItem && (
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-100 px-6 py-2 text-lg font-semibold text-gray-900 rounded-full border border-gray-300">
                {selectedItem} Predictions
              </span>
            </div>
          </div>
        </div>
      )}

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
                currentPrediction.seasonal_factors.map(factor =>
                  factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                ).join(', ') :
                'Winter surge, Flu season'
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
        <div className="mb-8">
          <AdvancedChart
            data={currentPrediction.chartData || samplePredictionData}
            chartType="line"
            xField="date"
            yFields={['actual', 'predicted']}
            title={`${selectedItem} - Demand Forecast for Next ${daysAhead} Days`}
            height={400}
            colors={['#10B981', '#3B82F6']}
            enableZoom={true}
            enableBrush={false}
            enableExport={true}
            maxDataPoints={500}
          />
        </div>
      )}

      {/* Budget Impact Analysis */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Monthly Budget Impact Analysis</h3>
              <p className="text-sm text-gray-500 mt-1">
                {budgetViewMode === 'all'
                  ? 'Monthly budget averages vs. waste costs calculated from your usage patterns and potential savings'
                  : selectedItem
                    ? `Budget analysis for ${selectedItem} only`
                    : 'Select an item above to view specific budget analysis'
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setBudgetViewMode('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  budgetViewMode === 'all'
                    ? 'bg-blue-100 text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => setBudgetViewMode('specific')}
                disabled={!selectedItem}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  budgetViewMode === 'specific'
                    ? 'bg-blue-100 text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } ${!selectedItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!selectedItem ? 'Select an item above to view specific budget analysis' : ''}
              >
                {selectedItem || 'Select Item'}
              </button>
            </div>
          </div>
          {/* Legend with explanations */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span><strong>Monthly Budget:</strong> Average monthly spending per category (total budget ÷ categories)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
              <span><strong>Waste Cost:</strong> Monthly waste cost based on expiration and usage patterns</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span><strong>Potential Savings:</strong> Monthly savings achievable with optimized inventory management</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          {budgetLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="loading-spinner"></div>
              <span className="ml-2 text-gray-600">Loading budget analysis...</span>
            </div>
          ) : filteredBudgetData.length > 0 ? (
            <>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={filteredBudgetData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="item" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => {
                        const labels = {
                          'current_cost': 'Monthly Budget',
                          'predicted_cost': 'Monthly Waste Cost',
                          'savings_opportunity': 'Monthly Potential Savings'
                        };
                        return [`$${value.toLocaleString()}`, labels[name] || name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="current_cost" fill="#10B981" name="Monthly Budget" />
                    <Bar dataKey="predicted_cost" fill="#F59E0B" name="Monthly Waste Cost" />
                    <Bar dataKey="savings_opportunity" fill="#3B82F6" name="Monthly Potential Savings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-green-600 text-4xl mb-2">💰</div>
              {budgetViewMode === 'specific' && selectedItem ? (
                <>
                  <p>No budget data available for {selectedItem}</p>
                  <p className="text-sm mt-2">This item may not have waste analysis data yet</p>
                  {budgetImpactData.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">Items with budget data:</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {budgetImpactData.map(item => item.item).join(', ')}
                      </p>
                    </div>
                  )}
                </>
              ) : budgetViewMode === 'specific' ? (
                <>
                  <p>Select an item to view specific budget analysis</p>
                  <p className="text-sm mt-2">Choose an item from the dropdown above</p>
                </>
              ) : (
                <>
                  <p>No waste analysis data available</p>
                  <p className="text-sm mt-2">Upload usage data to see budget impact analysis</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Predictions;