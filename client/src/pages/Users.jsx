import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Shield, User, UserCog, Search, AlertTriangle, CheckCircle, RefreshCw, Key } from 'lucide-react';
import { getUsers, createUser, updateUser } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, user: null, action: null });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'staff'
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  // Auto-clear messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!editingUser && !formData.password) errors.password = 'Password is required';
    if (formData.password && formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      if (editingUser && !formData.password) {
        delete dataToSend.password;
      }
      
      if (editingUser) {
        await updateUser(editingUser.id, dataToSend);
        setSuccess(`User "${formData.name}" updated successfully`);
      } else {
        await createUser(dataToSend);
        setSuccess(`User "${formData.name}" created successfully`);
      }
      closeModal();
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ username: '', password: '', name: '', role: 'staff' });
    setFormErrors({});
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleToggleActive = (user) => {
    const action = user.is_active ? 'disable' : 'enable';
    setConfirmDialog({
      show: true,
      user,
      action,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      message: `Are you sure you want to ${action} "${user.name}"? ${action === 'disable' ? 'They will not be able to log in.' : ''}`
    });
  };

  const confirmToggleActive = async () => {
    const { user } = confirmDialog;
    try {
      await updateUser(user.id, { is_active: user.is_active ? 0 : 1 });
      setSuccess(`User "${user.name}" ${user.is_active ? 'disabled' : 'enabled'} successfully`);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user status');
    }
    setConfirmDialog({ show: false, user: null, action: null });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super_admin': return <Shield size={16} style={{ color: 'var(--danger)' }} />;
      case 'admin': return <UserCog size={16} style={{ color: 'var(--primary)' }} />;
      default: return <User size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_admin': return 'badge badge-danger';
      case 'admin': return 'badge badge-primary';
      default: return 'badge badge-secondary';
    }
  };

  const getRoleLabel = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter users by search term
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => ['admin', 'super_admin'].includes(u.role)).length,
    staff: users.filter(u => u.role === 'staff').length
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p className="text-muted">Create and manage user accounts and permissions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <UserPlus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon"><User size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--success)' }}><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--primary)' }}><Shield size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.admins}</div>
            <div className="stat-label">Admins</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--text-muted)' }}><UserCog size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.staff}</div>
            <div className="stat-label">Staff</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="search-box" style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p className="text-muted">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <User size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p className="text-muted">{searchTerm ? 'No users match your search' : 'No users found'}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email / Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: user.role === 'super_admin' ? 'var(--danger)' : user.role === 'admin' ? 'var(--primary)' : 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: user.role !== 'staff' ? 'white' : 'var(--text-muted)',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{user.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Created {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{user.username}</td>
                  <td>
                    <span className={getRoleBadgeClass(user.role)}>
                      {getRoleIcon(user.role)}
                      <span style={{ marginLeft: '0.25rem' }}>{getRoleLabel(user.role)}</span>
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => handleEdit(user)}
                        title="Edit user"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => handleEdit(user)}
                        title="Reset password"
                      >
                        <Key size={16} />
                      </button>
                      <button 
                        className={`btn btn-sm ${user.is_active ? 'btn-ghost' : 'btn-success'}`}
                        onClick={() => handleToggleActive(user)}
                        style={{ minWidth: '70px' }}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button className="btn btn-ghost" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Name */}
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Smith"
                  />
                  {formErrors.name && <div className="invalid-feedback">{formErrors.name}</div>}
                </div>

                {/* Username/Email */}
                <div className="form-group">
                  <label className="form-label">Email (Username) *</label>
                  <input
                    type="email"
                    className={`form-control ${formErrors.username ? 'is-invalid' : ''}`}
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. john@knightauto.com"
                    disabled={!!editingUser}
                  />
                  {formErrors.username && <div className="invalid-feedback">{formErrors.username}</div>}
                  {editingUser && <small className="text-muted">Username cannot be changed</small>}
                </div>

                {/* Password */}
                <div className="form-group">
                  <label className="form-label">
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    className={`form-control ${formErrors.password ? 'is-invalid' : ''}`}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Minimum 8 characters'}
                  />
                  {formErrors.password && <div className="invalid-feedback">{formErrors.password}</div>}
                </div>

                {/* Role */}
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    className="form-control"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="staff">Staff - Basic access, no admin features</option>
                    <option value="admin">Admin - Full access except user management</option>
                    <option value="super_admin">Super Admin - Complete system access</option>
                  </select>
                  <small className="text-muted" style={{ marginTop: '0.25rem', display: 'block' }}>
                    {formData.role === 'staff' && 'Staff can view and edit data but cannot delete or access settings.'}
                    {formData.role === 'admin' && 'Admins have full access to all features except user management.'}
                    {formData.role === 'super_admin' && 'Super Admins have complete control including user management.'}
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                      Saving...
                    </>
                  ) : (
                    <>{editingUser ? 'Update User' : 'Create User'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmToggleActive}
        onCancel={() => setConfirmDialog({ show: false, user: null, action: null })}
        confirmText={confirmDialog.action === 'disable' ? 'Disable User' : 'Enable User'}
        confirmVariant={confirmDialog.action === 'disable' ? 'danger' : 'success'}
      />
    </div>
  );
}
