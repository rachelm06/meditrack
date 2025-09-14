import React, { useState, useEffect } from 'react';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Sample inventory data
  const sampleInventory = [
    {
      id: 1,
      item_name: 'Surgical Masks',
      category: 'Medical Supplies',
      current_stock: 45,
      min_stock_level: 100,
      max_stock_level: 500,
      cost_per_unit: 0.50,
      supplier: 'MedSupply Co',
      expiration_risk: 'Low',
      usage_rate: 15
    },
    {
      id: 2,
      item_name: 'Disposable Gloves',
      category: 'Medical Supplies',
      current_stock: 180,
      min_stock_level: 150,
      max_stock_level: 1000,
      cost_per_unit: 0.25,
      supplier: 'SafeHands Inc',
      expiration_risk: 'Low',
      usage_rate: 25
    },
    {
      id: 3,
      item_name: 'Hand Sanitizer',
      category: 'Hygiene',
      current_stock: 12,
      min_stock_level: 50,
      max_stock_level: 200,
      cost_per_unit: 3.50,
      supplier: 'CleanCare Ltd',
      expiration_risk: 'Medium',
      usage_rate: 8
    },
    {
      id: 4,
      item_name: 'Antibiotics - Amoxicillin',
      category: 'Medications',
      current_stock: 75,
      min_stock_level: 30,
      max_stock_level: 150,
      cost_per_unit: 12.50,
      supplier: 'PharmaCorp',
      expiration_risk: 'High',
      usage_rate: 5
    },
    {
      id: 5,
      item_name: 'Digital Thermometer',
      category: 'Equipment',
      current_stock: 8,
      min_stock_level: 10,
      max_stock_level: 25,
      cost_per_unit: 45.00,
      supplier: 'MedTech Solutions',
      expiration_risk: 'Low',
      usage_rate: 2
    }
  ];

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setItems(sampleInventory);
      setLoading(false);
    }, 1000);
  }, []);

  const getStockStatus = (current, min, max) => {
    if (current <= min * 0.5) return 'critical';
    if (current <= min) return 'low';
    if (current >= max * 0.8) return 'high';
    return 'normal';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return 'status-low';
      case 'low': return 'status-high';
      case 'high': return 'status-high';
      default: return 'status-normal';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'critical': return 'Critical';
      case 'low': return 'Low Stock';
      case 'high': return 'Overstocked';
      default: return 'Normal';
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' ||
                           item.category.toLowerCase() === filterCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(items.map(item => item.category))];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="mt-2 text-gray-600">Manage your healthcare inventory items and stock levels</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Items
            </label>
            <input
              type="text"
              id="search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by name, category, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="md:w-48">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Inventory Items ({filteredItems.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Stock Range</th>
                <th>Status</th>
                <th>Cost per Unit</th>
                <th>Usage Rate</th>
                <th>Supplier</th>
                <th>Expiration Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const status = getStockStatus(item.current_stock, item.min_stock_level, item.max_stock_level);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="font-medium text-gray-900">{item.item_name}</td>
                    <td className="text-gray-600">{item.category}</td>
                    <td className="font-medium">{item.current_stock}</td>
                    <td className="text-sm text-gray-500">
                      {item.min_stock_level} - {item.max_stock_level}
                    </td>
                    <td>
                      <span className={`status-indicator ${getStatusColor(status)}`}>
                        {getStatusText(status)}
                      </span>
                    </td>
                    <td className="text-gray-600">${item.cost_per_unit.toFixed(2)}</td>
                    <td className="text-gray-600">{item.usage_rate}/day</td>
                    <td className="text-gray-600">{item.supplier}</td>
                    <td>
                      <span className={`status-indicator ${
                        item.expiration_risk === 'High' ? 'status-low' :
                        item.expiration_risk === 'Medium' ? 'status-high' : 'status-normal'
                      }`}>
                        {item.expiration_risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items found matching your search criteria.
        </div>
      )}
    </div>
  );
};

export default Inventory;