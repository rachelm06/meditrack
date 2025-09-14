import React, { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  ShieldExclamationIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const EmergencyAlerts = ({ className = '' }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [showDetails, setShowDetails] = useState({});

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const fetchEmergencyAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ai_judge/emergency_alerts`);

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.emergency_alerts || []);
        setError(null);
      } else {
        throw new Error('Failed to fetch emergency alerts');
      }
    } catch (err) {
      console.error('Error fetching emergency alerts:', err);
      setError('Unable to fetch emergency alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencyAlerts();

    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchEmergencyAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const toggleDetails = (alertId) => {
    setShowDetails(prev => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  const getAlertIcon = (decision) => {
    if (decision === 'EMERGENCY') {
      return <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />;
    } else if (decision === 'URGENT') {
      return <ShieldExclamationIcon className="w-6 h-6 text-orange-500" />;
    }
    return <ClockIcon className="w-6 h-6 text-yellow-500" />;
  };

  const getAlertBorder = (decision) => {
    if (decision === 'EMERGENCY') {
      return 'border-l-4 border-red-500';
    } else if (decision === 'URGENT') {
      return 'border-l-4 border-orange-500';
    }
    return 'border-l-4 border-yellow-500';
  };

  const getAlertBackground = (decision) => {
    if (decision === 'EMERGENCY') {
      return 'bg-red-50';
    } else if (decision === 'URGENT') {
      return 'bg-orange-50';
    }
    return 'bg-yellow-50';
  };

  const formatRationale = (rationale) => {
    // Extract key parts of the rationale for display
    const lines = rationale.split('\n').filter(line => line.trim());
    const decision = lines[0]; // First line usually contains decision
    const evidence = lines.filter(line => line.match(/^\d+\./)); // Numbered evidence

    return {
      decision: decision.replace('AI Judge Decision: ', ''),
      evidence: evidence.slice(0, 3) // Show top 3 evidence points
    };
  };

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(alert =>
    !dismissedAlerts.has(alert.item_name + alert.decision)
  );

  if (loading) {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <ClockIcon className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-blue-700 text-sm">Loading emergency alerts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <span className="text-green-700 text-sm font-medium">
            ✅ All Clear - No emergency purchases required
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span>Emergency Purchase Alerts</span>
            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
              {visibleAlerts.length}
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            AI Judge analysis • Ask the AI Assistant for detailed explanations (bottom-right corner)
          </p>
        </div>
        <button
          onClick={fetchEmergencyAlerts}
          className="text-gray-400 hover:text-gray-600 text-sm"
          title="Refresh alerts"
        >
          Refresh
        </button>
      </div>

      {visibleAlerts.map((alert, index) => {
        const alertId = alert.item_name + alert.decision;
        const formatted = formatRationale(alert.rationale);

        return (
          <div
            key={alertId}
            className={`${getAlertBackground(alert.decision)} ${getAlertBorder(alert.decision)} rounded-lg p-4 relative`}
          >
            {/* Dismiss Button */}
            <button
              onClick={() => handleDismiss(alertId)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              title="Dismiss alert"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* Main Alert Content */}
            <div className="flex items-start space-x-4 pr-8">
              {getAlertIcon(alert.decision)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="font-bold text-gray-900">{alert.item_name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    alert.decision === 'EMERGENCY'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {alert.decision}
                  </span>
                  <span className="text-xs text-gray-500">
                    Score: {alert.score}/10 • {Math.round(alert.confidence * 100)}% confidence
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2">
                  <strong>Action Required:</strong> {alert.action_required}
                </p>

                <p className="text-sm text-gray-600 mb-2">
                  <strong>Timeline:</strong> {alert.timeline}
                </p>

                {/* Toggle Details */}
                <button
                  onClick={() => toggleDetails(alertId)}
                  className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <EyeIcon className="w-3 h-3" />
                  <span>{showDetails[alertId] ? 'Hide Details' : 'Show AI Analysis'}</span>
                </button>

                {/* Expandable Details */}
                {showDetails[alertId] && (
                  <div className="mt-3 p-3 bg-white bg-opacity-50 rounded border border-gray-200">
                    <div className="text-xs text-gray-600 mb-2">
                      <strong>AI Judge Analysis:</strong> {formatted.decision}
                    </div>

                    {formatted.evidence.length > 0 && (
                      <div className="text-xs text-gray-600">
                        <strong>Supporting Evidence:</strong>
                        <ul className="mt-1 space-y-1">
                          {formatted.evidence.map((evidence, idx) => (
                            <li key={idx} className="ml-2">• {evidence.replace(/^\d+\.\s*/, '')}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500">
                      Analysis follows healthcare supply chain constitutional rules for patient safety.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Summary Footer */}
      {visibleAlerts.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-sm text-gray-600">
            <strong>AI Judge Active:</strong> Monitoring {alerts.length + dismissedAlerts.size} items •
            Last updated {new Date().toLocaleTimeString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Constitutional rules applied to prevent patient care disruption
          </p>
        </div>
      )}
    </div>
  );
};

export default EmergencyAlerts;