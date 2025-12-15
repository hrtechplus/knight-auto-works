import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Shield, User, UserCog } from 'lucide-react';
import { getUsers, createUser, updateUser } from '../api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'staff'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData);
      } else {
        await createUser(formData);
      }
      setShowModal(false);
      setEditingUser(null);
      setFormData({ username: '', password: '', name: '', role: 'staff' });
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role
    });
    setShowModal(true);
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { is_active: user.is_active ? 0 : 1 });
      loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
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

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p className="text-muted">Create and manage user accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getRoleIcon(user.role)}
                    {user.name}
                  </div>
                </td>
                <td>{user.username}</td>
                <td>
                  <span className={getRoleBadgeClass(user.role)}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(user)}>
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className={`btn btn-ghost btn-sm ${user.is_active ? '' : 'text-success'}`}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username (Email)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={!!editingUser}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    minLength={8}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-control"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
