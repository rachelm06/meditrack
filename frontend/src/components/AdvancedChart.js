import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, Brush,
  ReferenceLine, ReferenceArea
} from 'recharts';
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  ChartBarIcon,
  ChartBarSquareIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline';
import { DataOptimizer } from '../utils/dataOptimization';

const AdvancedChart = ({
  data = [],
  chartType = 'line',
  xField = 'date',
  yFields = ['value'],
  title = 'Chart',
  height = 300,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  enableZoom = true,
  enableBrush = true,
  enableExport = true,
  maxDataPoints = null,
  aggregationLevel = 'auto',
  onDataPointClick = null,
  className = ''
}) => {
  const [zoomDomain, setZoomDomain] = useState(null);
  const [selectedChartType, setSelectedChartType] = useState(chartType);
  const [isZooming, setIsZooming] = useState(false);
  const [dataStats, setDataStats] = useState({ original: 0, optimized: 0, processingTime: 0 });
  const chartRef = useRef(null);

  // Optimize data with performance monitoring
  const optimizedData = useMemo(() => {
    const start = performance.now();

    if (!data || data.length === 0) {
      setDataStats({ original: 0, optimized: 0, processingTime: 0 });
      return [];
    }

    let processedData = [...data];

    // Apply time-based filtering if zoom domain is set
    if (zoomDomain && zoomDomain.left !== undefined && zoomDomain.right !== undefined) {
      const leftIndex = Math.floor(zoomDomain.left);
      const rightIndex = Math.ceil(zoomDomain.right);
      processedData = processedData.slice(leftIndex, rightIndex + 1);
    }

    // Optimize dataset based on chart type and size
    const optimized = DataOptimizer.withPerformanceMonitoring(
      DataOptimizer.optimizeDataset,
      'Chart Data Optimization'
    )(processedData, selectedChartType, maxDataPoints);

    const end = performance.now();
    setDataStats({
      original: data.length,
      optimized: optimized.length,
      processingTime: end - start
    });

    return optimized;
  }, [data, selectedChartType, maxDataPoints, zoomDomain]);

  // Chart type configurations
  const chartConfigs = {
    line: { component: LineChart, element: Line },
    area: { component: AreaChart, element: Area },
    bar: { component: BarChart, element: Bar },
    scatter: { component: ScatterChart, element: Scatter }
  };

  // Handle zoom events
  const handleZoom = useCallback((e) => {
    if (!e || !enableZoom) return;

    if (e.startIndex !== undefined && e.endIndex !== undefined) {
      setZoomDomain({
        left: e.startIndex,
        right: e.endIndex
      });
      setIsZooming(true);
    }
  }, [enableZoom]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setIsZooming(false);
  }, []);

  // Handle chart type change
  const handleChartTypeChange = useCallback((newType) => {
    setSelectedChartType(newType);
  }, []);

  // Export chart data and chart image
  const exportData = useCallback((format = 'csv') => {
    if (!optimizedData.length) return;

    if (format === 'csv') {
      const headers = [xField, ...yFields].join(',');
      const rows = optimizedData.map(row =>
        [row[xField], ...yFields.map(field => row[field] || '')].join(',')
      );
      const csv = [headers, ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_data.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [optimizedData, xField, yFields, title]);

  // Export chart as image
  const exportChart = useCallback((format = 'png') => {
    if (!chartRef.current) return;

    try {
      // Find the SVG element within the chart
      const chartContainer = chartRef.current.container || chartRef.current;
      const svgElement = chartContainer.querySelector('svg');

      if (!svgElement) {
        console.error('No SVG element found in chart');
        return;
      }

      if (format === 'svg') {
        // Export as SVG
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const a = document.createElement('a');
        a.href = svgUrl;
        a.download = `${title.replace(/\s+/g, '_')}_chart.svg`;
        a.click();
        URL.revokeObjectURL(svgUrl);
      } else {
        // Export as PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svgElement);

        // Get SVG dimensions
        const svgRect = svgElement.getBoundingClientRect();
        canvas.width = svgRect.width * 2; // 2x for better quality
        canvas.height = svgRect.height * 2;

        // Scale the context to match the canvas size
        ctx.scale(2, 2);

        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = function() {
          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);

          // Draw the image
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          // Convert to PNG and download
          canvas.toBlob((blob) => {
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `${title.replace(/\s+/g, '_')}_chart.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
          });
        };

        img.src = url;
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
      // Fallback: try a simpler approach
      window.print();
    }
  }, [title]);

  // Custom tooltip with enhanced information
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">{`${xField}: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.dataKey}: ${entry.value?.toLocaleString()}`}
            {entry.payload[`${entry.dataKey}_count`] && (
              <span className="text-xs text-gray-500 ml-1">
                (avg of {entry.payload[`${entry.dataKey}_count`]} values)
              </span>
            )}
          </p>
        ))}
      </div>
    );
  };

  // Render chart elements based on type
  const renderChartElements = () => {
    const { element: Element } = chartConfigs[selectedChartType];

    return yFields.map((field, index) => {
      const color = colors[index % colors.length];

      const commonProps = {
        key: field,
        dataKey: field,
        stroke: selectedChartType !== 'bar' ? color : undefined,
        fill: selectedChartType === 'bar' || selectedChartType === 'area' ? color : undefined,
        strokeWidth: selectedChartType === 'line' ? 2 : 1,
        onClick: onDataPointClick
      };

      if (selectedChartType === 'area') {
        return <Element {...commonProps} fillOpacity={0.3} />;
      }

      return <Element {...commonProps} />;
    });
  };

  // Render the chart
  const renderChart = () => {
    const { component: ChartComponent } = chartConfigs[selectedChartType];

    return (
      <ChartComponent
        ref={chartRef}
        data={optimizedData}
        margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
        onMouseDown={(e) => setIsZooming(false)}
        onMouseMove={(e) => {
          if (isZooming && enableZoom) {
            // Handle zoom area selection
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={xField}
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {renderChartElements()}

        {enableBrush && optimizedData.length > 20 && (
          <Brush
            dataKey={xField}
            height={30}
            stroke="#8884d8"
            onChange={handleZoom}
          />
        )}
      </ChartComponent>
    );
  };

  const chartTypeIcons = {
    line: PresentationChartLineIcon,
    area: ChartBarSquareIcon,
    bar: ChartBarIcon,
    scatter: ChartBarIcon
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isZooming && (
            <div className="text-xs text-gray-500 mt-1">
              <span className="text-blue-600">• Zoomed View</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Chart Type Selector */}
          <div className="flex items-center space-x-1 mr-3">
            {Object.keys(chartConfigs).map((type) => {
              const IconComponent = chartTypeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => handleChartTypeChange(type)}
                  className={`p-2 rounded-md transition-colors ${
                    selectedChartType === type
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                  title={`Switch to ${type} chart`}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Zoom Controls */}
          {enableZoom && (
            <>
              <button
                onClick={resetZoom}
                disabled={!isZooming}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reset zoom"
              >
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Export Buttons */}
          {enableExport && (
            <div className="flex items-center space-x-2">
              <div className="relative group">
                <button className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                  Export ▾
                </button>
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={() => exportData('csv')}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Data (CSV)
                  </button>
                  <button
                    onClick={() => exportChart('png')}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Chart (PNG)
                  </button>
                  <button
                    onClick={() => exportChart('svg')}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Chart (SVG)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-4">
        {optimizedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No data available for the selected time range</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedChart;