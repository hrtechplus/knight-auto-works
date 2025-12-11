import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Wrench, Package, FileText, Receipt, 
  Settings, TrendingUp, Shield
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
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
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
    </Router>
  );
}

export default App;
