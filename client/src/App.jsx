import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Wrench, Package, FileText, Receipt, 
  Settings, TrendingUp, Shield, LogOut, User, Search
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
import QuickSearch from './components/QuickSearch';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { getStoredUser, logout, setUnauthorizedHandler } from './api';
import './index.css';

function AppContent({ user, onLogout }) {
  const navigate = useNavigate();
  const [showQuickSearch, setShowQuickSearch] = useState(false);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': () => setShowQuickSearch(true),
    'escape': () => setShowQuickSearch(false)
  });

  useEffect(() => {
    // Handle 401 responses by logging out
    setUnauthorizedHandler(() => {
      onLogout();
      navigate('/');
    });
  }, [onLogout, navigate]);

  return (
    <div className="app-container">
      {/* Quick Search Modal */}
      <QuickSearch 
        isOpen={showQuickSearch} 
        onClose={() => setShowQuickSearch(false)} 
      />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Shield size={28} />
            </div>
            <div>
              <div className="logo-text">Knight Auto</div>
              <div className="logo-subtext">Workshop</div>
            </div>
          </div>
        </div>

        {/* Quick Search Trigger */}
        <div style={{ padding: '0 1rem', marginBottom: '0.5rem' }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => setShowQuickSearch(true)}
            style={{ 
              width: '100%', 
              justifyContent: 'flex-start',
              color: 'var(--text-muted)',
              fontSize: '0.875rem'
            }}
          >
            <Search size={16} />
            Quick Search
            <span className="shortcut-hint" style={{ marginLeft: 'auto' }}>
              <kbd>⌘</kbd><kbd>K</kbd>
            </span>
          </button>
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
            <NavLink to="/reports" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={20} />
              Reports
            </NavLink>
          </div>
          
          <div className="nav-section">
            <div className="nav-section-title">System</div>
            <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              Settings
            </NavLink>
          </div>
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
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
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
