import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const Import = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inventory');
  const [importHistory, setImportHistory] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchImportHistory = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/import/history');
      setImportHistory(response.data.imports);
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  }, []);

  useEffect(() => {
    fetchImportHistory();
  }, [fetchImportHistory]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    if (!file.name.match(/\.(csv|xlsx|xls|pdf|docx|txt)$/i)) {
      setUploadResult({
        success: false,
        message: 'Please select a supported file format (CSV, Excel, PDF, Word, or Text)'
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = activeTab === 'inventory'
        ? 'http://localhost:8000/import/inventory'
        : 'http://localhost:8000/import/usage';

      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadResult({
        success: true,
        ...response.data
      });

      // Refresh import history
      fetchImportHistory();

      // Notify other components that inventory may have been updated
      window.dispatchEvent(new Event('inventoryUpdated'));
    } catch (error) {
      setUploadResult({
        success: false,
        message: error.response?.data?.detail || 'Upload failed'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = async (type) => {
    try {
      const response = await axios.get('http://localhost:8000/import/templates');
      const template = response.data.templates[type];

      // Create CSV content
      const headers = template.headers.join(',');
      const sampleRow = template.sample_data[0];
      const values = template.headers.map(header => {
        const value = sampleRow[header];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',');

      const csvContent = `${headers}\n${values}`;

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'completed_with_errors':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const ConfidenceIndicator = ({ confidence, accuracyInfo }) => {
    if (!accuracyInfo) return null;

    const getColorClasses = (color) => {
      switch (color) {
        case 'green':
          return {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-800',
            icon: 'text-green-500'
          };
        case 'blue':
          return {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-800',
            icon: 'text-blue-500'
          };
        case 'yellow':
          return {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            text: 'text-yellow-800',
            icon: 'text-yellow-500'
          };
        case 'red':
          return {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-800',
            icon: 'text-red-500'
          };
        default:
          return {
            bg: 'bg-gray-50',
            border: 'border-gray-200',
            text: 'text-gray-800',
            icon: 'text-gray-500'
          };
      }
    };

    const colorClasses = getColorClasses(accuracyInfo.color);

    return (
      <div className={`${colorClasses.bg} ${colorClasses.border} border rounded-lg p-4 mt-3`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {accuracyInfo.needs_human_review ? (
              <ExclamationTriangleIcon className={`h-6 w-6 ${colorClasses.icon}`} />
            ) : (
              <InformationCircleIcon className={`h-6 w-6 ${colorClasses.icon}`} />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className={`text-sm font-medium ${colorClasses.text}`}>
                {accuracyInfo.description} ({confidence.toFixed(1)}% confidence)
              </h4>
            </div>
            <p className={`mt-1 text-sm ${colorClasses.text} opacity-90`}>
              {accuracyInfo.interpretation}
            </p>

            {/* Accuracy Metrics */}
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Labeling Accuracy:</span>
                <span className="ml-1">{accuracyInfo.labeling_accuracy_estimate}%</span>
              </div>
              <div>
                <span className="font-medium">Critical Fields:</span>
                <span className="ml-1">{accuracyInfo.critical_fields_mapped}</span>
              </div>
            </div>

            {/* Human Review Warning */}
            {accuracyInfo.needs_human_review && (
              <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="font-medium text-yellow-800">Human Review Recommended</span>
                </div>
                <p className="text-yellow-700 mt-1">{accuracyInfo.review_reason}</p>
              </div>
            )}

            {/* Issues */}
            {accuracyInfo.issues && accuracyInfo.issues.length > 0 && (
              <div className="mt-3">
                <p className={`text-xs font-medium ${colorClasses.text} mb-1`}>Issues Detected:</p>
                <ul className={`text-xs ${colorClasses.text} opacity-90 list-disc list-inside space-y-1`}>
                  {accuracyInfo.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {accuracyInfo.recommendations && accuracyInfo.recommendations.length > 0 && (
              <div className="mt-3">
                <p className={`text-xs font-medium ${colorClasses.text} mb-1`}>Recommendations:</p>
                <ul className={`text-xs ${colorClasses.text} opacity-90 list-disc list-inside space-y-1`}>
                  {accuracyInfo.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload inventory and usage data from CSV or Excel files
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inventory'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Inventory Data
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'usage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Usage & Prescriptions
          </button>
        </nav>
      </div>

      {/* Upload Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Upload {activeTab === 'inventory' ? 'Inventory' : 'Usage'} Data
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {activeTab === 'inventory'
                ? 'Upload files containing inventory information in any format (CSV, Excel, PDF, Word, Text)'
                : 'Upload files containing usage and prescription data in any format (CSV, Excel, PDF, Word, Text)'
              }
            </p>
          </div>
          <button
            onClick={() => downloadTemplate(activeTab)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Download Template
          </button>
        </div>

        {/* File Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Drop files here or click to browse
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls,.pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">
                CSV, XLSX, XLS, PDF, DOCX, or TXT up to 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <div className="flex items-center">
              <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="text-sm text-blue-700">Uploading and processing file...</span>
            </div>
          </div>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-md ${
            uploadResult.success ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="flex items-start">
              {uploadResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.message}
                </p>
                {uploadResult.success && (
                  <div className="mt-2 text-sm text-green-700">
                    <p>Records imported: {uploadResult.imported_records}</p>
                    {uploadResult.failed_records > 0 && (
                      <p>Records failed: {uploadResult.failed_records}</p>
                    )}
                    {uploadResult.import_id && (
                      <p>Import ID: {uploadResult.import_id}</p>
                    )}
                    {activeTab === 'inventory' && (
                      <button
                        onClick={() => navigate('/inventory')}
                        className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        View Updated Inventory →
                      </button>
                    )}
                  </div>
                )}

                {/* Confidence and Accuracy Information */}
                {uploadResult && uploadResult.accuracy_assessment && (
                  <ConfidenceIndicator
                    confidence={uploadResult.confidence || 0}
                    accuracyInfo={uploadResult.accuracy_assessment}
                  />
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-800">Errors:</p>
                    <ul className="mt-1 text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                      {uploadResult.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <li>... and {uploadResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import History */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Import History</h2>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {importHistory.length > 0 ? (
                importHistory.map((item) => (
                  <tr key={item.import_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(item.status)}
                        <span className="ml-2 text-sm text-gray-900 capitalize">
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {item.import_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="text-green-600">{item.imported_records}</span>
                      {item.failed_records > 0 && (
                        <span className="text-red-600"> / {item.failed_records} failed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-2 text-sm font-medium text-gray-900">No imports yet</div>
                    <div className="mt-1 text-sm text-gray-500">
                      Upload your first file to get started
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Import;