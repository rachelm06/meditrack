import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapIcon,
  ExclamationTriangleIcon,
  ShareIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ClockIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  BellIcon
} from '@heroicons/react/24/outline';

const HospitalNetwork = () => {
  const [hospitals, setHospitals] = useState([]);
  const [networkMap, setNetworkMap] = useState(null);
  const [selectedItem, setSelectedItem] = useState('N95 Masks');
  const [searchRadius, setSearchRadius] = useState(50);
  const [currentLocation, setCurrentLocation] = useState({ lat: 40.7128, lng: -74.0060 }); // Default to NYC
  const [networkStatus, setNetworkStatus] = useState(null);
  const [supplyOffers, setSupplyOffers] = useState([]);
  const [emergencyRequest, setEmergencyRequest] = useState({
    item_name: '',
    quantity_needed: '',
    urgency_level: 'medium',
    medical_reason: '',
    deadline: '',
    contact_info: ''
  });
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [networkForecast, setNetworkForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const googleMapRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Common medical inventory items
  const inventoryItems = [
    'N95 Masks', 'Surgical Gloves', 'Hand Sanitizer', 'Acetaminophen',
    'Ibuprofen', 'Syringes', 'Bandages', 'IV Bags', 'Ventilators',
    'Surgical Masks', 'Face Shields', 'Gowns', 'Thermometers'
  ];

  // Load Google Maps API
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'demo'}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps API loaded');
      };
      script.onerror = () => {
        console.warn('Failed to load Google Maps API - using fallback display');
      };
      document.head.appendChild(script);
    }
  }, []);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Could not get current location:', error);
          // Keep default location
        }
      );
    }
  }, []);

  // Load network data when location or parameters change
  useEffect(() => {
    if (currentLocation.lat && currentLocation.lng) {
      loadNetworkData();
    }
  }, [currentLocation, selectedItem, searchRadius]);

  const loadNetworkData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load multiple data sources in parallel
      const [hospitalsRes, networkStatusRes, networkMapRes] = await Promise.all([
        fetch(`${API_BASE_URL}/network/discover-hospitals?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius_km=${searchRadius}`),
        fetch(`${API_BASE_URL}/network/network-status/${selectedItem}?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius_km=${searchRadius}`),
        fetch(`${API_BASE_URL}/network/network-map?center_lat=${currentLocation.lat}&center_lng=${currentLocation.lng}&radius_km=${searchRadius}&item_name=${selectedItem}`)
      ]);

      if (hospitalsRes.ok) {
        const hospitalsData = await hospitalsRes.json();
        setHospitals(hospitalsData);
      }

      if (networkStatusRes.ok) {
        const statusData = await networkStatusRes.json();
        setNetworkStatus(statusData);
      }

      if (networkMapRes.ok) {
        const mapData = await networkMapRes.json();
        setNetworkMap(mapData);
        initializeMap(mapData);
      }

    } catch (err) {
      console.error('Error loading network data:', err);
      setError('Failed to load hospital network data');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = (mapData) => {
    if (!mapRef.current) return;

    // Check if Google Maps is available
    if (window.google && window.google.maps) {
      // Initialize Google Maps
      const map = new window.google.maps.Map(mapRef.current, {
        center: currentLocation,
        zoom: 10,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: 'poi.medical',
            elementType: 'geometry',
            stylers: [{ color: '#ffeaa7' }]
          }
        ]
      });

      googleMapRef.current = map;

      // Add markers for hospitals
      if (mapData && mapData.hospitals) {
        mapData.hospitals.forEach((hospital, index) => {
          const marker = new window.google.maps.Marker({
            position: { lat: hospital.latitude, lng: hospital.longitude },
            map: map,
            title: hospital.name,
            icon: getHospitalMarkerIcon(hospital)
          });

          // Add info window
          const infoWindow = new window.google.maps.InfoWindow({
            content: createHospitalInfoContent(hospital)
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
        });
      }

      // Add current location marker
      new window.google.maps.Marker({
        position: currentLocation,
        map: map,
        title: 'Your Location',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        }
      });
    } else {
      // Fallback display when Google Maps is not loaded
      mapRef.current.innerHTML = `
        <div class="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
          <div class="text-center">
            <div class="h-12 w-12 text-gray-400 mx-auto mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-600">Hospital Network Map</p>
            <p class="text-sm text-gray-500 mt-1">
              ${mapData ? `Showing ${mapData.hospitals?.length || 0} hospitals` : 'Loading map data...'}
            </p>
            <div class="mt-4 space-y-2">
              ${mapData && mapData.hospitals ? mapData.hospitals.slice(0, 5).map(h => `
                <div class="text-left p-2 bg-white rounded border">
                  <div class="font-medium text-sm">${h.name}</div>
                  <div class="text-xs text-gray-500">${h.address}</div>
                </div>
              `).join('') : ''}
            </div>
          </div>
        </div>
      `;
    }
  };

  const getHospitalMarkerIcon = (hospital) => {
    // Determine marker color based on hospital status
    let color = 'green'; // default

    if (hospital.shortage_status === 'critical') {
      color = 'red';
    } else if (hospital.shortage_status === 'low') {
      color = 'orange';
    } else if (hospital.surplus_available) {
      color = 'blue';
    }

    return {
      url: `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
      scaledSize: new window.google.maps.Size(32, 32)
    };
  };

  const createHospitalInfoContent = (hospital) => {
    return `
      <div class="p-3 max-w-sm">
        <h3 class="font-semibold text-lg mb-2">${hospital.name}</h3>
        <p class="text-sm text-gray-600 mb-2">${hospital.address}</p>
        ${hospital.phone ? `<p class="text-sm mb-2">📞 ${hospital.phone}</p>` : ''}
        ${hospital.inventory_status ? `
          <div class="mt-2">
            <p class="text-xs font-medium text-gray-700">Current Status:</p>
            <div class="mt-1">
              ${hospital.inventory_status[selectedItem] ? `
                <div class="text-sm">
                  <span class="font-medium">${selectedItem}:</span>
                  ${hospital.inventory_status[selectedItem].current_stock} units
                  ${hospital.inventory_status[selectedItem].status === 'shortage' ?
                    '<span class="text-red-600 ml-1">(Low)</span>' :
                    hospital.inventory_status[selectedItem].status === 'surplus' ?
                    '<span class="text-blue-600 ml-1">(Surplus Available)</span>' : ''
                  }
                </div>
              ` : `<div class="text-sm text-gray-500">No data for ${selectedItem}</div>`}
            </div>
          </div>
        ` : ''}
        <div class="mt-3 flex space-x-2">
          <button onclick="contactHospital('${hospital.id}')"
                  class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            Contact
          </button>
          ${hospital.surplus_available ? `
            <button onclick="requestSupplies('${hospital.id}')"
                    class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
              Request Supplies
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  const loadSupplyOffers = async (itemName, quantity) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/network/supply-sources/${itemName}?quantity_needed=${quantity}&lat=${currentLocation.lat}&lng=${currentLocation.lng}&max_distance_km=${searchRadius}`
      );

      if (response.ok) {
        const offers = await response.json();
        setSupplyOffers(offers);
        return offers;
      }
    } catch (err) {
      console.error('Error loading supply offers:', err);
    }
    return [];
  };

  const submitEmergencyRequest = async () => {
    if (!emergencyRequest.item_name || !emergencyRequest.quantity_needed || !emergencyRequest.medical_reason) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        ...emergencyRequest,
        quantity_needed: parseInt(emergencyRequest.quantity_needed),
        deadline: emergencyRequest.deadline ? new Date(emergencyRequest.deadline).toISOString() : new Date(Date.now() + 24*60*60*1000).toISOString(),
        requester_location: {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        }
      };

      const response = await fetch(`${API_BASE_URL}/network/emergency-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();

        // Enhanced success handling with different messages based on urgency
        let successMessage = `Emergency request submitted successfully!\nRequest ID: ${result.request_id}`;

        if (result.auto_matches && result.auto_matches.length > 0) {
          successMessage += `\n\n🚨 CRITICAL REQUEST - Supplies Auto-Reserved:\n`;
          result.auto_matches.forEach((match, index) => {
            successMessage += `${index + 1}. ${match.hospital_name}: ${match.quantity_reserved} units (${match.distance_km} km away)\n   Pickup by: ${new Date(match.estimated_pickup_time).toLocaleTimeString()}\n   Contact: ${match.contact_phone}\n`;
          });
          successMessage += `\nReservations expire in 6 hours. Please confirm pickup ASAP.`;
        } else if (result.offers && result.offers.length > 0) {
          successMessage += `\n\nTop suppliers found:\n`;
          result.offers.slice(0, 3).forEach((offer, index) => {
            successMessage += `${index + 1}. ${offer.hospital_name}: ${offer.quantity_available} units (${offer.distance_km} km away)\n`;
          });
          successMessage += `\nEstimated fulfillment: ${new Date(result.estimated_fulfillment_time).toLocaleString()}`;
        }

        if (result.emergency_protocols_activated) {
          successMessage += `\n\n⚠️ Emergency protocols are now ACTIVE for this request.`;
        }

        alert(successMessage);
        setShowEmergencyForm(false);
        setEmergencyRequest({
          item_name: '',
          quantity_needed: '',
          urgency_level: 'medium',
          medical_reason: '',
          deadline: '',
          contact_info: ''
        });

        // Show supply offers if available
        if (result.offers && result.offers.length > 0) {
          setSupplyOffers(result.offers);
        }

        // Refresh network data
        loadNetworkData();
      } else {
        throw new Error('Failed to submit emergency request');
      }
    } catch (err) {
      console.error('Error submitting emergency request:', err);
      alert('Failed to submit emergency request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadNetworkForecast = async (itemName, daysAhead = 30) => {
    try {
      const response = await fetch(`${API_BASE_URL}/network/network-forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          item_name: itemName,
          days_ahead: daysAhead,
          include_network_analysis: true
        })
      });

      if (response.ok) {
        const forecast = await response.json();
        setNetworkForecast(forecast);
      }
    } catch (err) {
      console.error('Error loading network forecast:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'shortage': return 'text-red-600 bg-red-50 border-red-200';
      case 'surplus': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  // Make contact and request functions available globally for the map info windows
  useEffect(() => {
    window.contactHospital = (hospitalId) => {
      const hospital = hospitals.find(h => h.id === hospitalId);
      if (hospital && hospital.phone) {
        window.open(`tel:${hospital.phone}`);
      } else {
        alert(`Contact information not available for hospital ${hospitalId}`);
      }
    };

    window.requestSupplies = (hospitalId) => {
      setEmergencyRequest(prev => ({
        ...prev,
        item_name: selectedItem
      }));
      setShowEmergencyForm(true);
    };

    return () => {
      delete window.contactHospital;
      delete window.requestSupplies;
    };
  }, [hospitals, selectedItem]);

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <MapIcon className="h-8 w-8 text-blue-600 mr-3" />
              Hospital Network
            </h1>
            <p className="mt-2 text-gray-600">
              Collaborate with nearby hospitals for supply sharing and demand forecasting
            </p>
          </div>
          <button
            onClick={() => setShowEmergencyForm(true)}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            Emergency Request
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inventory Item
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {inventoryItems.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius (km)
            </label>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={75}>75 km</option>
              <option value={100}>100 km</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => loadNetworkForecast(selectedItem)}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={loading}
            >
              <ChartBarIcon className="h-5 w-5 inline mr-2" />
              {loading ? 'Loading...' : 'Network Forecast'}
            </button>
          </div>
        </div>
      </div>

      {/* Network Status Overview */}
      {networkStatus && (
        <div className="mb-6 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Network Status: {selectedItem}
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {networkStatus.hospitals_in_network}
                </div>
                <div className="text-sm text-gray-600">Hospitals in Network</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {networkStatus.total_network_stock?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Total Network Stock</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {networkStatus.hospitals_with_shortages}
                </div>
                <div className="text-sm text-gray-600">Shortage Alerts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {networkStatus.hospitals_with_surplus}
                </div>
                <div className="text-sm text-gray-600">Surplus Available</div>
              </div>
            </div>

            {/* Shortage Alerts */}
            {networkStatus.shortage_alerts && networkStatus.shortage_alerts.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  <BellIcon className="h-5 w-5 text-red-500 mr-2" />
                  Critical Shortage Alerts
                </h4>
                <div className="space-y-2">
                  {networkStatus.shortage_alerts.slice(0, 3).map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md">
                      <div>
                        <span className="font-medium text-red-900">{alert.hospital}</span>
                        <span className="text-red-700 ml-2">
                          Stock: {alert.current_stock}/{alert.min_stock} (Critical)
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(alert.urgency)}`}>
                        {alert.urgency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Network Forecast */}
      {networkForecast && (
        <div className="mb-6 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Network-Enhanced Forecast: {networkForecast.item_name}
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Predicted Demand</h4>
                <div className="text-3xl font-bold text-blue-600">
                  {networkForecast.predicted_demand.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  units over {networkForecast.forecast_period_days} days
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Range: {networkForecast.confidence_lower.toLocaleString()} - {networkForecast.confidence_upper.toLocaleString()}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Network Health</h4>
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  networkForecast.network_insights.supply_chain_health === 'good' ? 'bg-green-100 text-green-800' :
                  networkForecast.network_insights.supply_chain_health === 'concerning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {networkForecast.network_insights.supply_chain_health}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  Network Status: {networkForecast.network_insights.network_status}
                </div>
                <div className="text-sm text-gray-600">
                  Shortage Risk: {networkForecast.network_insights.shortage_risk}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Risk Factors</h4>
                {networkForecast.risk_factors.length > 0 ? (
                  <ul className="text-sm text-gray-600 space-y-1">
                    {networkForecast.risk_factors.slice(0, 3).map((risk, index) => (
                      <li key={index} className="flex items-start">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-green-600">No significant risk factors detected</div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {networkForecast.supply_recommendations.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Recommendations</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {networkForecast.supply_recommendations.map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hospital Network Map Placeholder */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Network Map</h3>
        </div>
        <div className="p-6">
          <div ref={mapRef} className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Hospital Network Map</p>
              <p className="text-sm text-gray-500">
                {networkMap ? `Showing ${networkMap.hospitals?.length || 0} hospitals` : 'Loading map data...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Request Modal */}
      {showEmergencyForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Emergency Supply Request</h3>
              <button
                onClick={() => setShowEmergencyForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Needed *</label>
                <select
                  value={emergencyRequest.item_name}
                  onChange={(e) => setEmergencyRequest({...emergencyRequest, item_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select item...</option>
                  {inventoryItems.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    value={emergencyRequest.quantity_needed}
                    onChange={(e) => setEmergencyRequest({...emergencyRequest, quantity_needed: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select
                    value={emergencyRequest.urgency_level}
                    onChange={(e) => setEmergencyRequest({...emergencyRequest, urgency_level: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical Reason *</label>
                <textarea
                  value={emergencyRequest.medical_reason}
                  onChange={(e) => setEmergencyRequest({...emergencyRequest, medical_reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe the medical need..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={emergencyRequest.deadline}
                  onChange={(e) => setEmergencyRequest({...emergencyRequest, deadline: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information *</label>
                <input
                  type="text"
                  value={emergencyRequest.contact_info}
                  onChange={(e) => setEmergencyRequest({...emergencyRequest, contact_info: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Phone or email for coordination"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEmergencyForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitEmergencyRequest}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalNetwork;