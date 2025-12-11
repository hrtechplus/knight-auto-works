import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2, Package, FileText, Check, Play, Clock, MessageSquare, Mail } from 'lucide-react';
import { getJob, updateJob, addJobItem, deleteJobItem, addJobPart, deleteJobPart, getInventory, createInvoiceFromJob, sendEmailNotification } from '../api';
import Breadcrumb from '../components/Breadcrumb';
import { SkeletonCard } from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';

function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [showNotifyMenu, setShowNotifyMenu] = useState(false);
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit_price: 0 });
  const [partForm, setPartForm] = useState({ inventory_id: '', part_name: '', quantity: 1, unit_price: 0 });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: '', // 'item' or 'part'
    id: null,
    message: ''
  });

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
    setConfirmDialog({
      isOpen: true,
      type: 'item',
      id: itemId,
      message: 'Are you sure you want to remove this service?'
    });
  };

  const handleConfirmDelete = async () => {
    if (confirmDialog.type === 'item') {
      await deleteJobItem(id, confirmDialog.id);
    } else if (confirmDialog.type === 'part') {
      await deleteJobPart(id, confirmDialog.id);
    }
    loadData();
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
    setConfirmDialog({
      isOpen: true,
      type: 'part',
      id: partId,
      message: 'Remove this part? Stock will be returned to inventory.'
    });
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

  const [statusConfirm, setStatusConfirm] = useState({ isOpen: false, action: '', status: '' });

  // Handle status change with confirmation for critical actions
  const requestStatusChange = (newStatus, action) => {
    const criticalActions = ['cancelled', 'completed'];
    if (criticalActions.includes(newStatus)) {
      setStatusConfirm({ isOpen: true, action, status: newStatus });
    } else {
      handleStatusChange(newStatus);
    }
  };

  const confirmStatusChange = async () => {
    await handleStatusChange(statusConfirm.status);
    setStatusConfirm({ isOpen: false, action: '', status: '' });
  };

  const handleWhatsApp = () => {
    if (!job.customer_phone) return alert('No customer phone number');
    
    // Format phone: remove spaces/dashes, ensure country code (default to local if missing)
    let phone = job.customer_phone.replace(/\D/g, '');
    // Simple logic: if length is 9 or 10, assume local and add default country code (e.g., 94 for Sri Lanka/India area)
    // For now we just use what's there if it looks like a full number
    
    let message = '';
    if (job.status === 'completed') {
      message = `Hi ${job.customer_name}, your vehicle (${job.vehicle_plate}) is ready for pickup at Knight Auto Works. Total: Rs. ${job.total_cost}`;
    } else {
      message = `Hi ${job.customer_name}, update on your vehicle (${job.vehicle_plate}): Status is now ${job.status.replace('_', ' ')}. - Knight Auto Works`;
    }
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setShowNotifyMenu(false);
  };

  const handleEmail = async () => {
    if (!job.customer_email) return alert('No customer email address');
    
    setNotificationLoading(true);
    try {
      await sendEmailNotification({
        to: job.customer_email,
        type: 'jobReady',
        data: {
          customerName: job.customer_name,
          vehicleCheck: `${job.vehicle_make} ${job.vehicle_model} (${job.vehicle_plate})`,
          jobRef: job.job_number
        }
      });
      alert('Email notification sent successfully!');
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email notification');
    } finally {
      setNotificationLoading(false);
      setShowNotifyMenu(false);
    }
  };

  if (loading) {
    return (
      <div className="main-body">
        <div className="detail-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
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

  // Status action button configurations
  const statusActions = {
    pending: [
      { label: 'Start Work', icon: Play, status: 'in_progress', variant: 'primary' },
      { label: 'Cancel Job', icon: X, status: 'cancelled', variant: 'danger' }
    ],
    in_progress: [
      { label: 'Put on Hold', icon: Clock, status: 'pending', variant: 'secondary' },
      { label: 'Complete', icon: Check, status: 'completed', variant: 'success' },
      { label: 'Cancel Job', icon: X, status: 'cancelled', variant: 'danger' }
    ],
    completed: [
      { label: 'Reopen Job', icon: Play, status: 'in_progress', variant: 'secondary' },
      { label: 'Create Invoice', icon: FileText, status: null, variant: 'primary', action: 'invoice' }
    ],
    invoiced: [],
    cancelled: [
      { label: 'Reactivate', icon: Play, status: 'pending', variant: 'primary' }
    ]
  };

  const currentActions = statusActions[job.status] || [];

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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Status Badge */}
          <span className={`badge badge-${job.status}`} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            {job.status.replace('_', ' ').toUpperCase()}
          </span>

          {/* Notification Menu */}
          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowNotifyMenu(!showNotifyMenu)}
              disabled={notificationLoading}
            >
              <MessageSquare size={18} /> Notify
            </button>
            
            {showNotifyMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 50,
                width: '200px',
                overflow: 'hidden'
              }}>
                <button 
                  onClick={handleWhatsApp}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    width: '100%', padding: '0.75rem 1rem',
                    textAlign: 'left', background: 'none', border: 'none',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)'
                  }}
                  onMouseOver={e => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseOut={e => e.target.style.background = 'none'}
                >
                  <MessageSquare size={16} color="#22c55e" /> WhatsApp
                </button>
                <button 
                  onClick={handleEmail}
                  disabled={!job.customer_email}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    width: '100%', padding: '0.75rem 1rem',
                    textAlign: 'left', background: 'none', border: 'none',
                    color: job.customer_email ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: job.customer_email ? 'pointer' : 'not-allowed'
                  }}
                  onMouseOver={e => job.customer_email && (e.target.style.background = 'var(--bg-secondary)')}
                  onMouseOut={e => e.target.style.background = 'none'}
                >
                  <Mail size={16} color="#3b82f6" /> Email {job.customer_email ? '' : '(N/A)'}
                </button>
              </div>
            )}
          </div>
          
          {/* Action Buttons based on current status */}
          {currentActions.map((action, idx) => {
            if (action.action === 'invoice') {
              return job.invoice ? (
                <Link key={idx} to={`/invoices/${job.invoice.id}`} className="btn btn-secondary">
                  <FileText size={18} /> View Invoice
                </Link>
              ) : (
                <button key={idx} className="btn btn-primary" onClick={handleCreateInvoice}>
                  <FileText size={18} /> Create Invoice
                </button>
              );
            }
            
            const Icon = action.icon;
            return (
              <button
                key={idx}
                className={`btn btn-${action.variant}`}
                onClick={() => requestStatusChange(action.status, action.label)}
              >
                <Icon size={18} /> {action.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Status Change Confirmation Dialog */}
      {statusConfirm.isOpen && (
        <div className="modal-overlay" onClick={() => setStatusConfirm({ isOpen: false, action: '', status: '' })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Action</h2>
              <button className="modal-close" onClick={() => setStatusConfirm({ isOpen: false, action: '', status: '' })}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to <strong>{statusConfirm.action}</strong> this job?</p>
              {statusConfirm.status === 'cancelled' && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid var(--danger)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.75rem',
                  marginTop: '1rem'
                }}>
                  ⚠️ This will mark the job as cancelled. You can reactivate it later if needed.
                </div>
              )}
              {statusConfirm.status === 'completed' && (
                <div style={{ 
                  background: 'rgba(34, 197, 94, 0.1)', 
                  border: '1px solid var(--success)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.75rem',
                  marginTop: '1rem'
                }}>
                  ✓ Job will be marked as completed. You can then create an invoice for the customer.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStatusConfirm({ isOpen: false, action: '', status: '' })}>
                Cancel
              </button>
              <button 
                className={`btn ${statusConfirm.status === 'cancelled' ? 'btn-danger' : 'btn-success'}`} 
                onClick={confirmStatusChange}
              >
                Yes, {statusConfirm.action}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="main-body">
        <Breadcrumb items={[
          { label: 'Jobs', to: '/jobs' },
          { label: job.job_number }
        ]} />
        
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, type: '', id: null, message: '' })}
        onConfirm={handleConfirmDelete}
        title={confirmDialog.type === 'item' ? 'Remove Service' : 'Remove Part'}
        message={confirmDialog.message}
        confirmText="Remove"
        variant="danger"
      />
    </>
  );
}

export default JobDetail;
