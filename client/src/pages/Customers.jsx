import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Phone, Mail, MapPin } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', notes: ''
  });

  useEffect(() => {
    loadCustomers();
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

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteCustomer(id);
        loadCustomers();
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
  };

  const openNewModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

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
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : customers.length === 0 ? (
            <div className="empty-state">
              <Users size={64} />
              <h3>No customers yet</h3>
              <p>Add your first customer to get started</p>
              <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> Add Customer
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Vehicles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id}>
                      <td>
                        <Link to={`/customers/${customer.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '500' }}>
                          {customer.name}
                        </Link>
                      </td>
                      <td>
                        {customer.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Phone size={14} /> {customer.phone}
                          </span>
                        )}
                      </td>
                      <td>
                        {customer.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={14} /> {customer.email}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-normal">{customer.vehicle_count} vehicles</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(customer)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(customer.id)} style={{ color: 'var(--danger)' }}>
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

      {/* Modal */}
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
                    required
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
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
    </>
  );
}

const Users = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export default Customers;
