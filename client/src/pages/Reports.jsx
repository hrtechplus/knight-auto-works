import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Wrench, Users } from 'lucide-react';
import { getRevenueReport, getSummaryReport } from '../api';

function Reports() {
  const [revenueData, setRevenueData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    try {
      const [revenueRes, summaryRes] = await Promise.all([
        getRevenueReport(period),
        getSummaryReport()
      ]);
      setRevenueData(revenueRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = Math.max(...revenueData.map(d => d.total), 1);

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Reports & Analytics</h1>
      </header>
      
      <div className="main-body">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon success">
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value currency">
                      <span className="currency-symbol">Rs.</span>
                      {(summary.revenue || 0).toLocaleString()}
                    </div>
                    <div className="stat-label">Revenue This Month</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon danger">
                    <DollarSign size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value currency">
                      <span className="currency-symbol">Rs.</span>
                      {(summary.expenses || 0).toLocaleString()}
                    </div>
                    <div className="stat-label">Expenses This Month</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon primary">
                    <DollarSign size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value currency" style={{ color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      <span className="currency-symbol">Rs.</span>
                      {(summary.profit || 0).toLocaleString()}
                    </div>
                    <div className="stat-label">Net Profit</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon info">
                    <Wrench size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{summary.jobsCompleted || 0}</div>
                    <div className="stat-label">Jobs Completed</div>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue Chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Revenue Trend</h3>
                <div className="tabs">
                  <button className={`tab ${period === 'daily' ? 'active' : ''}`} onClick={() => setPeriod('daily')}>
                    Daily
                  </button>
                  <button className={`tab ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>
                    Weekly
                  </button>
                  <button className={`tab ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>
                    Monthly
                  </button>
                </div>
              </div>
              <div className="card-body">
                {revenueData.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <TrendingUp size={48} />
                    <p>No revenue data yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {revenueData.map((item, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '100px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {item.period}
                        </div>
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', height: '24px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${(item.total / maxRevenue) * 100}%`, 
                              height: '100%', 
                              background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
                              borderRadius: 'var(--radius-sm)',
                              transition: 'width 0.3s ease'
                            }} 
                          />
                        </div>
                        <div className="currency" style={{ width: '120px', textAlign: 'right', fontWeight: '500' }}>
                          Rs. {item.total.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default Reports;
