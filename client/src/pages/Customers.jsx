import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Phone, Mail, Edit2, Trash2, MoreVertical } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', notes: ''
  });
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    customerId: null,
    customerName: ''
  });
  
  // Action menu state
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    loadCustomers();
  }, []);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== '') {
        setSearching(true);
        loadCustomers().finally(() => setSearching(false));
      } else {
        loadCustomers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadCustomers = async () => {
    try {
      const res = await getCustomers(searchTerm);
      setCustomers(res.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
      } else {
        await createCustomer(formData);
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
      loadCustomers();
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };

  const handleEdit = (customer) => {
    setOpenMenuId(null);
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = (customer) => {
    setOpenMenuId(null);
    setConfirmDialog({
      isOpen: true,
      customerId: customer.id,
      customerName: customer.name
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteCustomer(confirmDialog.customerId);
      loadCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const openNewModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Customers</h1>
        <button className="btn btn-primary" onClick={openNewModal}>
          <Plus size={18} />
          Add Customer
        </button>
      </header>
      
      <div className="main-body">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search customers by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searching && (
              <div className="search-loading">
                <div className="spinner"></div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <SkeletonTable rows={5} columns={5} />
          ) : customers.length === 0 ? (
            <EmptyState 
              type={searchTerm ? 'search' : 'customers'} 
              onAction={openNewModal}
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Vehicles</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar name={customer.name} size={36} />
                          <Link 
                            to={`/customers/${customer.id}`} 
                            style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}
                          >
                            {customer.name}
                          </Link>
                        </div>
                      </td>
                      <td>
                        {customer.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Phone size={14} style={{ color: 'var(--text-muted)' }} /> 
                            {customer.phone}
                          </span>
                        )}
                      </td>
                      <td>
                        {customer.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={14} style={{ color: 'var(--text-muted)' }} /> 
                            {customer.email}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-normal">{customer.vehicle_count} vehicles</span>
                      </td>
                      <td>
                        <div className="action-menu-wrapper">
                          <button 
                            className="action-menu-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === customer.id ? null : customer.id);
                            }}
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === customer.id && (
                            <div className="action-menu" onClick={e => e.stopPropagation()}>
                              <button 
                                className="action-menu-item"
                                onClick={() => handleEdit(customer)}
                              >
                                <Edit2 size={16} /> Edit
                              </button>
                              <button 
                                className="action-menu-item danger"
                                onClick={() => handleDeleteClick(customer)}
                              >
                                <Trash2 size={16} /> Delete
                              </button>
                            </div>
                          )}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter customer name"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="e.g., 077 123 4567"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="e.g., john@example.com"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Street address, city, postal code"
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any additional notes about this customer"
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, customerId: null, customerName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to delete "${confirmDialog.customerName}"? This action cannot be undone and will also remove all associated vehicles.`}
        confirmText="Delete Customer"
        variant="danger"
      />
    </>
  );
}

export default Customers;

