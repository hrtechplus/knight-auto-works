import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Wrench, Package, FileText, Receipt, 
  Settings, TrendingUp, Shield, LogOut, User
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import { getStoredUser, logout, setUnauthorizedHandler } from './api';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function AppContent({ user, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle 401 responses by logging out
    setUnauthorizedHandler(() => {
      onLogout();
      navigate('/');
    });
  }, [onLogout, navigate]);

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
            {user?.role === 'admin' && (
              <NavLink to="/reports" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <TrendingUp size={20} />
                Reports
              </NavLink>
            )}
          </div>
          
          {user?.role === 'admin' && (
            <div className="nav-section">
              <div className="nav-section-title">System</div>
              <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Settings size={20} />
                Settings
              </NavLink>
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
            onClick={onLogout}
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
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={
            <ProtectedRoute roles={['admin']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute roles={['admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
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
