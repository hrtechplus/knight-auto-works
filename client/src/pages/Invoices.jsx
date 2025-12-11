import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText } from 'lucide-react';
import { getInvoices } from '../api';

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadInvoices();
  }, [searchTerm, statusFilter]);

  const loadInvoices = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      const res = await getInvoices(params);
      setInvoices(res.data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const statuses = ['unpaid', 'partial', 'paid'];

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Invoices</h1>
      </header>
      
      <div className="main-body">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            <button 
              className={`tab ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              All
            </button>
            {statuses.map(status => (
              <button 
                key={status}
                className={`tab ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <FileText size={64} />
              <h3>No invoices found</h3>
              <p>Invoices are created from completed jobs</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Job</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td>
                        <Link to={`/invoices/${invoice.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '600' }}>
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td>{invoice.customer_name}</td>
                      <td>
                        {invoice.job_number ? (
                          <Link to={`/jobs/${invoice.job_id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                            {invoice.job_number}
                          </Link>
                        ) : '-'}
                      </td>
                      <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                      <td className="currency">Rs. {invoice.total.toLocaleString()}</td>
                      <td className="currency" style={{ color: invoice.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        Rs. {invoice.balance.toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Invoices;
