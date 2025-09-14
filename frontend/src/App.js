import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import EnhancedDashboard from './pages/EnhancedDashboard';
import Inventory from './pages/Inventory';
import Predictions from './pages/Predictions';
import Import from './pages/Import';
import HospitalNetwork from './pages/HospitalNetwork';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                {/* MEDITRACK Logo */}
                <div className="flex items-center">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 120 120"
                    className="flex-shrink-0"
                  >
                    {/* Logo SVG - recreated from the uploaded image */}
                    <defs>
                      <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#1E40AF" />
                      </linearGradient>
                    </defs>

                    {/* Main heart shape */}
                    <path
                      d="M60 25C45 10, 15 10, 15 40C15 70, 60 105, 60 105C60 105, 105 70, 105 40C105 10, 75 10, 60 25Z"
                      fill="url(#heartGradient)"
                    />

                    {/* Medical cross */}
                    <rect x="52" y="30" width="16" height="8" fill="white" rx="2"/>
                    <rect x="56" y="26" width="8" height="16" fill="white" rx="2"/>

                    {/* Pulse line */}
                    <path
                      d="M15 55 L25 55 L30 45 L35 65 L40 35 L45 75 L50 55 L105 55"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>

                {/* Brand name */}
                <h1 className="text-2xl font-bold text-blue-600">
                  MEDITRACK
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Dashboard</span>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <Link
                to="/"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </Link>
              <Link
                to="/inventory"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('inventory')}
              >
                Inventory
              </Link>
              <Link
                to="/predictions"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'predictions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('predictions')}
              >
                Analytics and Predictions
              </Link>
              <Link
                to="/import"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'import'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('import')}
              >
                Import Data
              </Link>
              <Link
                to="/network"
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'network'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('network')}
              >
                Hospital Network
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/import" element={<Import />} />
            <Route path="/network" element={<HospitalNetwork />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;