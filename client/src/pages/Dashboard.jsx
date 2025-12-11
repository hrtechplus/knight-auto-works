import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, Car, Users, Package, AlertTriangle, TrendingUp, DollarSign,
  Clock, CheckCircle, FileText, ArrowRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboard } from '../api';
import { SkeletonStatCard, SkeletonCard } from '../components/Skeleton';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await getDashboard();
      setData(res.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock revenue data for the chart (since backend might not provide it yet)
  const revenueData = [
    { name: 'Mon', revenue: 12000 },
    { name: 'Tue', revenue: 19000 },
    { name: 'Wed', revenue: 15000 },
    { name: 'Thu', revenue: 22000 },
    { name: 'Fri', revenue: 28000 },
    { name: 'Sat', revenue: 32000 },
    { name: 'Sun', revenue: 25000 },
  ];

  if (loading) {
    return (
      <>
        <header className="main-header">
          <h1 className="page-title">Dashboard</h1>
        </header>
        <div className="main-body">
          <div className="stats-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          <div className="detail-grid">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </>
    );
  }

  const { stats, recentJobs, recentPayments } = data || {};

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/jobs" className="btn btn-primary">
            <Wrench size={18} />
            New Job
          </Link>
        </div>
      </header>
      
      <div className="main-body">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.jobsPending || 0}</div>
              <div className="stat-label">Pending Jobs</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon info">
              <Wrench size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.jobsInProgress || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.jobsCompleted || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.lowStockItems || 0}</div>
              <div className="stat-label">Low Stock Items</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value currency">
                <span className="currency-symbol">Rs.</span>
                {(stats?.revenueToday || 0).toLocaleString()}
              </div>
              <div className="stat-label">Today's Revenue</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon primary">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value currency">
                <span className="currency-symbol">Rs.</span>
                {(stats?.revenueThisMonth || 0).toLocaleString()}
              </div>
              <div className="stat-label">This Month</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon info">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.totalCustomers || 0}</div>
              <div className="stat-label">Total Customers</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon primary">
              <Car size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.totalVehicles || 0}</div>
              <div className="stat-label">Vehicles Registered</div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title">Revenue Trends</h3>
          </div>
          <div className="card-body" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `₹${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Content Grid */}
        <div className="detail-grid">
          {/* Recent Jobs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Jobs</h3>
              <Link to="/jobs" className="btn btn-ghost btn-sm">
                View All <ArrowRight size={16} />
              </Link>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Vehicle</th>
                    <th>Customer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs?.length > 0 ? recentJobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>
                          {job.job_number}
                        </Link>
                      </td>
                      <td>{job.plate_number} - {job.make} {job.model}</td>
                      <td>{job.customer_name}</td>
                      <td>
                        <span className={`badge badge-${job.status}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No jobs yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unpaid Invoices */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Outstanding Payments</h3>
              <Link to="/invoices" className="btn btn-ghost btn-sm">
                View All <ArrowRight size={16} />
              </Link>
            </div>
            <div className="card-body">
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>
                  <span className="currency-symbol">Rs.</span>
                  {(stats?.unpaidInvoices?.total || 0).toLocaleString()}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  {stats?.unpaidInvoices?.count || 0} unpaid invoices
                </div>
              </div>
              
              {recentPayments?.length > 0 && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    Recent Payments
                  </h4>
                  {recentPayments.map(payment => (
                    <div key={payment.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{payment.customer_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {payment.invoice_number}
                        </div>
                      </div>
                      <div className="currency" style={{ color: 'var(--success)', fontWeight: '600' }}>
                        Rs. {payment.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
