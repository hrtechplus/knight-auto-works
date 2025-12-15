import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Wrench, Package, FileText, Receipt, 
  Settings, TrendingUp, Shield, LogOut, User, Truck, UserCog
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import UsersPage from './pages/Users';
import Login from './pages/Login';
import { getStoredUser, logout, setUnauthorizedHandler } from './api';
import ProtectedRoute from './components/ProtectedRoute';
import ConfirmDialog from './components/ConfirmDialog';
import './index.css';

function AppContent({ user, onLogout }) {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Handle 401 responses by logging out
    setUnauthorizedHandler(() => {
      onLogout();
      navigate('/');
    });
  }, [onLogout, navigate]);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    onLogout();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon" style={{ overflow: 'hidden' }}>
              <img 
                src="/logoknight.jpg" 
                alt="Knight Auto" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div>
              <div className="logo-text">Knight Auto</div>
              <div className="logo-subtext">Works</div>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Main</div>
            <NavLink to="/" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={20} />
              Dashboard
            </NavLink>
          </div>
          
          <div className="nav-section">
            <div className="nav-section-title">Management</div>
            <NavLink to="/customers" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              Customers
            </NavLink>
            <NavLink to="/vehicles" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Car size={20} />
              Vehicles
            </NavLink>
            <NavLink to="/jobs" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wrench size={20} />
              Jobs
            </NavLink>
          </div>
          
          <div className="nav-section">
            <div className="nav-section-title">Inventory</div>
            <NavLink to="/inventory" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Package size={20} />
              Parts & Stock
            </NavLink>
            <NavLink to="/suppliers" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Truck size={20} />
              Suppliers
            </NavLink>
          </div>
          
          <div className="nav-section">
            <div className="nav-section-title">Finance</div>
            <NavLink to="/invoices" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <FileText size={20} />
              Invoices
            </NavLink>
            <NavLink to="/expenses" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Receipt size={20} />
              Expenses
            </NavLink>
                        {['admin', 'super_admin'].includes(user?.role) && (
              <NavLink to="/reports" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <TrendingUp size={20} />
                Reports
              </NavLink>
            )}
          </div>
          
                    {['admin', 'super_admin'].includes(user?.role) && (
            <div className="nav-section">
              <div className="nav-section-title">System</div>
              <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Settings size={20} />
                Settings
              </NavLink>
              {user?.role === 'super_admin' && (
                <NavLink to="/users" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                  <UserCog size={20} />
                  Manage Users
                </NavLink>
              )}
            </div>
          )}
        </nav>

        {/* User info and logout */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          marginTop: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.75rem'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: 'var(--bg-tertiary)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role || 'staff'}</div>
            </div>
          </div>
          <button
            onClick={handleLogoutClick}
            className="btn btn-ghost"
            style={{
              width: '100%',
              justifyContent: 'center',
              color: 'var(--danger)'
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
          
          {/* Developer Credit */}
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <a 
              href="https://hasidu.live/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                fontSize: '0.7rem', 
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
            >
              Developed by <span style={{ fontWeight: '500' }}>Hasindu</span>
            </a>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={
            <ProtectedRoute roles={['admin', 'super_admin']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute roles={['admin', 'super_admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute roles={['super_admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out? You'll need to log in again to access the system."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(getStoredUser);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppContent user={user} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
