import React, { useState, useEffect, useMemo, useCallback } from 'react';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    item_name: '',
    category: '',
    current_stock: 0,
    min_stock_level: 0,
    max_stock_level: 0,
    cost_per_unit: 0,
    supplier: '',
    expiration_risk: 'Low'
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Sample inventory data
  const sampleInventory = useMemo(() => [
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
  ], []);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/inventory`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setItems(data.inventory);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError(err.message);
      // Fallback to sample data if API fails
      setItems(sampleInventory);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, sampleInventory]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Listen for window focus to refresh data when user returns
  useEffect(() => {
    const handleFocus = () => {
      fetchInventory();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchInventory]);

  // Listen for custom events from successful imports
  useEffect(() => {
    const handleInventoryUpdate = () => {
      fetchInventory();
    };

    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    return () => window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
  }, [fetchInventory]);

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

  const handleEdit = (item, field) => {
    setEditingItem(item.id);
    setEditingField(field);
  };

  const handleSave = async (item, field, value) => {
    try {
      // Update backend API
      const response = await fetch(`${API_BASE_URL}/inventory/${encodeURIComponent(item.item_name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: parseFloat(value) || value }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      const updatedItems = items.map(i =>
        i.id === item.id ? { ...i, [field]: parseFloat(value) || value } : i
      );
      setItems(updatedItems);
      setEditingItem(null);
      setEditingField(null);
    } catch (error) {
      console.error('Error updating item:', error);
      // Reset editing state on error
      setEditingItem(null);
      setEditingField(null);
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setEditingField(null);
  };

  const handleAddNew = async () => {
    try {
      // Send to backend API
      const response = await fetch(`${API_BASE_URL}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh inventory data
      await fetchInventory();

      // Reset form
      setNewItem({
        item_name: '',
        category: '',
        current_stock: 0,
        min_stock_level: 0,
        max_stock_level: 0,
        cost_per_unit: 0,
        supplier: '',
        expiration_risk: 'Low'
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const EditableCell = ({ item, field, type = 'text' }) => {
    const isEditing = editingItem === item.id && editingField === field;
    const value = item[field];

    if (isEditing) {
      return (
        <input
          type={type}
          defaultValue={value}
          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
          onBlur={(e) => handleSave(item, field, e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSave(item, field, e.target.value);
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
        />
      );
    }

    return (
      <div
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onClick={() => handleEdit(item, field)}
        title="Click to edit"
      >
        {type === 'number' && field.includes('cost') ? `$${parseFloat(value).toFixed(2)}` : value}
      </div>
    );
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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="mt-2 text-gray-600">Manage your healthcare inventory items and stock levels - click any value to edit</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchInventory}
              className="px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add New Item
            </button>
          </div>
        </div>
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
                    <td className="font-medium text-gray-900">
                      <EditableCell item={item} field="item_name" />
                    </td>
                    <td className="text-gray-600">
                      <EditableCell item={item} field="category" />
                    </td>
                    <td className="font-medium">
                      <EditableCell item={item} field="current_stock" type="number" />
                    </td>
                    <td className="text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <EditableCell item={item} field="min_stock_level" type="number" />
                        <span>-</span>
                        <EditableCell item={item} field="max_stock_level" type="number" />
                      </div>
                    </td>
                    <td>
                      <span className={`status-indicator ${getStatusColor(status)}`}>
                        {getStatusText(status)}
                      </span>
                    </td>
                    <td className="text-gray-600">
                      <EditableCell item={item} field="cost_per_unit" type="number" />
                    </td>
                    <td className="text-gray-600">{item.usage_rate}/day</td>
                    <td className="text-gray-600">
                      <EditableCell item={item} field="supplier" />
                    </td>
                    <td>
                      <select
                        value={item.expiration_risk}
                        onChange={(e) => handleSave(item, 'expiration_risk', e.target.value)}
                        className="border-none bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
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

      {/* Add New Item Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Inventory Item</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter category"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={newItem.current_stock}
                    onChange={(e) => setNewItem({...newItem, current_stock: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                  <input
                    type="number"
                    value={newItem.min_stock_level}
                    onChange={(e) => setNewItem({...newItem, min_stock_level: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock</label>
                  <input
                    type="number"
                    value={newItem.max_stock_level}
                    onChange={(e) => setNewItem({...newItem, max_stock_level: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.cost_per_unit}
                  onChange={(e) => setNewItem({...newItem, cost_per_unit: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={newItem.supplier}
                  onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Risk</label>
                <select
                  value={newItem.expiration_risk}
                  onChange={(e) => setNewItem({...newItem, expiration_risk: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;