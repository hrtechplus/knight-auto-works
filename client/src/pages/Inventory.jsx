import { useState, useEffect } from 'react';
import { Plus, Search, X, Package, AlertTriangle } from 'lucide-react';
import { getInventory, getSuppliers, createInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock, createSupplier } from '../api';
import Select from '../components/Select';

function Inventory() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [formData, setFormData] = useState({
    sku: '', name: '', description: '', category: '', quantity: 0,
    min_stock: 5, cost_price: 0, sell_price: 0, supplier_id: '', location: ''
  });
  const [adjustForm, setAdjustForm] = useState({ quantity: 0, type: 'in', notes: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });

  useEffect(() => {
    loadData();
  }, [searchTerm, showLowStock]);

  const loadData = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (showLowStock) params.low_stock = 'true';
      
      const [itemsRes, suppliersRes] = await Promise.all([
        getInventory(params),
        getSuppliers()
      ]);
      setItems(itemsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, formData);
      } else {
        await createInventoryItem(formData);
      }
      closeModal();
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save item');
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await adjustStock(adjustItem.id, adjustForm);
      setShowAdjustModal(false);
      setAdjustItem(null);
      loadData();
    } catch (error) {
      alert('Failed to adjust stock');
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      await createSupplier(supplierForm);
      setShowSupplierModal(false);
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
      loadData();
    } catch (error) {
      alert('Failed to add supplier');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku || '',
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      quantity: item.quantity,
      min_stock: item.min_stock,
      cost_price: item.cost_price,
      sell_price: item.sell_price,
      supplier_id: item.supplier_id || '',
      location: item.location || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this item?')) {
      await deleteInventoryItem(id);
      loadData();
    }
  };

  const openAdjustModal = (item) => {
    setAdjustItem(item);
    setAdjustForm({ quantity: 0, type: 'in', notes: '' });
    setShowAdjustModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      sku: '', name: '', description: '', category: '', quantity: 0,
      min_stock: 5, cost_price: 0, sell_price: 0, supplier_id: '', location: ''
    });
  };

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Inventory</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowSupplierModal(true)}>
            Add Supplier
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Add Item
          </button>
        </div>
      </header>
      
      <div className="main-body">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search parts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className={`btn ${showLowStock ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setShowLowStock(!showLowStock)}
          >
            <AlertTriangle size={18} /> Low Stock
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Package size={64} />
              <h3>No items found</h3>
              <p>Add parts to your inventory</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> Add Item
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Cost</th>
                    <th>Sell Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.sku || '-'}</td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{item.name}</div>
                        {item.supplier_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Supplier: {item.supplier_name}
                          </div>
                        )}
                      </td>
                      <td>{item.category || '-'}</td>
                      <td>
                        <span className={item.quantity <= item.min_stock ? 'badge badge-low' : ''}>
                          {item.quantity}
                        </span>
                        {item.quantity <= item.min_stock && (
                          <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </td>
                      <td className="currency">Rs. {item.cost_price.toLocaleString()}</td>
                      <td className="currency">Rs. {item.sell_price.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openAdjustModal(item)}>
                            Adjust
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(item)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} style={{ color: 'var(--danger)' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Item Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingItem ? 'Edit Item' : 'Add Item'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input type="text" className="form-control" value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})} placeholder="e.g. OIL-5W30" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input type="text" className="form-control" value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input type="text" className="form-control" value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      placeholder="e.g. Engine Oil, Filters" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier</label>
                    <Select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                      name="supplier_id"
                      placeholder="Select Supplier"
                      options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum Stock</label>
                    <input type="number" className="form-control" value={formData.min_stock}
                      onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input type="text" className="form-control" value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="e.g. Shelf A-3" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cost Price (Rs.)</label>
                    <input type="number" className="form-control" value={formData.cost_price}
                      onChange={(e) => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sell Price (Rs.)</label>
                    <input type="number" className="form-control" value={formData.sell_price}
                      onChange={(e) => setFormData({...formData, sell_price: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Update' : 'Add'} Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustItem && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Adjust Stock: {adjustItem.name}</h2>
              <button className="modal-close" onClick={() => setShowAdjustModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjust}>
              <div className="modal-body">
                <p>Current stock: <strong>{adjustItem.quantity}</strong></p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <Select
                      value={adjustForm.type}
                      onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                      name="type"
                      options={[
                        { value: 'in', label: 'Add Stock' },
                        { value: 'out', label: 'Remove Stock' }
                      ]}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" value={adjustForm.quantity} min="1"
                      onChange={(e) => setAdjustForm({...adjustForm, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input type="text" className="form-control" value={adjustForm.notes}
                    onChange={(e) => setAdjustForm({...adjustForm, notes: e.target.value})}
                    placeholder="Reason for adjustment" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Adjust Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Supplier</h2>
              <button className="modal-close" onClick={() => setShowSupplierModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input type="text" className="form-control" value={supplierForm.name}
                    onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input type="text" className="form-control" value={supplierForm.contact_person}
                      onChange={(e) => setSupplierForm({...supplierForm, contact_person: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="tel" className="form-control" value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={supplierForm.email}
                    onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Inventory;
