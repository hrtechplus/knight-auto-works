import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2, Package, FileText, Check, Play, Clock } from 'lucide-react';
import { getJob, updateJob, addJobItem, deleteJobItem, addJobPart, deleteJobPart, getInventory, createInvoiceFromJob } from '../api';

function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit_price: 0 });
  const [partForm, setPartForm] = useState({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0 });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [jobRes, invRes] = await Promise.all([
        getJob(id),
        getInventory()
      ]);
      setJob(jobRes.data);
      setInventory(invRes.data);
      setEditForm({
        status: jobRes.data.status,
        technician: jobRes.data.technician || '',
        diagnosis: jobRes.data.diagnosis || '',
        labor_hours: jobRes.data.labor_hours || 0,
        labor_rate: jobRes.data.labor_rate || 1500,
        notes: jobRes.data.notes || ''
      });
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await addJobItem(id, itemForm);
      setShowItemModal(false);
      setItemForm({ description: '', quantity: 1, unit_price: 0 });
      loadData();
    } catch (error) {
      alert('Failed to add service');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm('Remove this service?')) {
      await deleteJobItem(id, itemId);
      loadData();
    }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      await addJobPart(id, partForm);
      setShowPartModal(false);
      setPartForm({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0 });
      loadData();
    } catch (error) {
      alert('Failed to add part');
    }
  };

  const handleDeletePart = async (partId) => {
    if (window.confirm('Remove this part? Stock will be returned.')) {
      await deleteJobPart(id, partId);
      loadData();
    }
  };

  const handleInventorySelect = (invId) => {
    const inv = inventory.find(i => i.id === parseInt(invId));
    if (inv) {
      setPartForm({
        ...partForm,
        inventory_id: inv.id,
        part_name: inv.name,
        unit_price: inv.sell_price
      });
    } else {
      setPartForm({ ...partForm, inventory_id: '' });
    }
  };

  const handleUpdateJob = async () => {
    try {
      await updateJob(id, editForm);
      setEditMode(false);
      loadData();
    } catch (error) {
      alert('Failed to update job');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateJob(id, { ...editForm, status: newStatus });
      loadData();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const res = await createInvoiceFromJob(id);
      navigate(`/invoices/${res.data.id}`);
    } catch (error) {
      alert('Failed to create invoice');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!job) {
    return (
      <div className="main-body">
        <div className="empty-state">
          <h3>Job not found</h3>
          <Link to="/jobs" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  const laborTotal = (editForm.labor_hours || 0) * (editForm.labor_rate || 0);
  const itemsTotal = job.items?.reduce((sum, i) => sum + i.total, 0) || 0;
  const partsTotal = job.parts?.reduce((sum, p) => sum + p.total, 0) || 0;
  const grandTotal = laborTotal + itemsTotal + partsTotal;

  return (
    <>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/jobs')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{job.job_number}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {job.plate_number} - {job.make} {job.model}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {job.status === 'pending' && (
            <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')}>
              <Play size={18} /> Start Job
            </button>
          )}
          {job.status === 'in_progress' && (
            <button className="btn btn-success" onClick={() => handleStatusChange('completed')}>
              <Check size={18} /> Complete
            </button>
          )}
          {job.status === 'completed' && !job.invoice && (
            <button className="btn btn-primary" onClick={handleCreateInvoice}>
              <FileText size={18} /> Create Invoice
            </button>
          )}
          {job.invoice && (
            <Link to={`/invoices/${job.invoice.id}`} className="btn btn-secondary">
              <FileText size={18} /> View Invoice
            </Link>
          )}
        </div>
      </header>
      
      <div className="main-body">
        <div className="detail-grid">
          {/* Job Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Job Details</h3>
              <span className={`badge badge-${job.status}`}>{job.status.replace('_', ' ')}</span>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Customer</div>
                  <div className="info-value">
                    <Link to={`/customers/${job.customer_id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>
                      {job.customer_name}
                    </Link>
                  </div>
                </div>
                <div className="info-group">
                  <div className="info-label">Phone</div>
                  <div className="info-value">{job.customer_phone || '-'}</div>
                </div>
              </div>
              <div className="info-group">
                <div className="info-label">Description</div>
                <div className="info-value">{job.description || '-'}</div>
              </div>
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Priority</div>
                  <span className={`badge badge-${job.priority}`}>{job.priority}</span>
                </div>
                <div className="info-group">
                  <div className="info-label">Created</div>
                  <div className="info-value">{new Date(job.created_at).toLocaleString()}</div>
                </div>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Technician</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.technician}
                    onChange={(e) => setEditForm({...editForm, technician: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Labor Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control"
                    value={editForm.labor_hours}
                    onChange={(e) => setEditForm({...editForm, labor_hours: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate (Rs./hr)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.labor_rate}
                    onChange={(e) => setEditForm({...editForm, labor_rate: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Diagnosis / Notes</label>
                <textarea
                  className="form-control"
                  value={editForm.diagnosis}
                  onChange={(e) => setEditForm({...editForm, diagnosis: e.target.value})}
                  rows={3}
                />
              </div>
              <button className="btn btn-primary" onClick={handleUpdateJob}>
                Save Changes
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Cost Summary</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span>Labor ({editForm.labor_hours}h × Rs.{editForm.labor_rate})</span>
                <span className="currency">Rs. {laborTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span>Services</span>
                <span className="currency">Rs. {itemsTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span>Parts</span>
                <span className="currency">Rs. {partsTotal.toLocaleString()}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '700' }}>
                <span>Total</span>
                <span className="currency" style={{ color: 'var(--success)' }}>Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Services</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowItemModal(true)}>
              <Plus size={16} /> Add Service
            </button>
          </div>
          {job.items?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {job.items.map(item => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td className="currency">Rs. {item.unit_price.toLocaleString()}</td>
                      <td className="currency">Rs. {item.total.toLocaleString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No services added yet
            </div>
          )}
        </div>

        {/* Parts */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Parts Used</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPartModal(true)}>
              <Plus size={16} /> Add Part
            </button>
          </div>
          {job.parts?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Part Name</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {job.parts.map(part => (
                    <tr key={part.id}>
                      <td>
                        {part.part_name}
                        {part.inventory_id && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(from stock)</span>}
                      </td>
                      <td>{part.quantity}</td>
                      <td className="currency">Rs. {part.unit_price.toLocaleString()}</td>
                      <td className="currency">Rs. {part.total.toLocaleString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePart(part.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No parts added yet
            </div>
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Service</h2>
              <button className="modal-close" onClick={() => setShowItemModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={itemForm.description}
                    onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                    required
                    placeholder="e.g. Oil Change, Brake Service"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({...itemForm, quantity: parseFloat(e.target.value) || 1})}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Price (Rs.)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={itemForm.unit_price}
                      onChange={(e) => setItemForm({...itemForm, unit_price: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Service</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Part Modal */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Part</h2>
              <button className="modal-close" onClick={() => setShowPartModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddPart}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select from Inventory</label>
                  <select
                    className="form-control"
                    value={partForm.inventory_id}
                    onChange={(e) => handleInventorySelect(e.target.value)}
                  >
                    <option value="">-- Custom Part --</option>
                    {inventory.filter(i => i.quantity > 0).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Stock: {i.quantity}) - Rs. {i.sell_price}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Part Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={partForm.part_name}
                    onChange={(e) => setPartForm({...partForm, part_name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={partForm.quantity}
                      onChange={(e) => setPartForm({...partForm, quantity: parseInt(e.target.value) || 1})}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Price (Rs.)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={partForm.unit_price}
                      onChange={(e) => setPartForm({...partForm, unit_price: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Part</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default JobDetail;
