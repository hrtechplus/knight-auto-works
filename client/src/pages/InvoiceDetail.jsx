import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Printer, DollarSign } from 'lucide-react';
import { getInvoice, addPayment } from '../api';

function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_method: 'cash', reference: '', notes: '' });

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const res = await getInvoice(id);
      setInvoice(res.data);
      setPaymentForm({ ...paymentForm, amount: res.data.balance });
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await addPayment(id, paymentForm);
      setShowPaymentModal(false);
      loadInvoice();
    } catch (error) {
      alert('Failed to record payment');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!invoice) {
    return (
      <div className="main-body">
        <div className="empty-state">
          <h3>Invoice not found</h3>
          <Link to="/invoices" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/invoices')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{invoice.invoice_number}</h1>
            <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={18} /> Print
          </button>
          {invoice.status !== 'paid' && (
            <button className="btn btn-success" onClick={() => setShowPaymentModal(true)}>
              <DollarSign size={18} /> Record Payment
            </button>
          )}
        </div>
      </header>
      
      <div className="main-body">
        <div className="detail-grid">
          {/* Invoice Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Invoice Details</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Customer</div>
                  <div className="info-value">
                    <Link to={`/customers/${invoice.customer_id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>
                      {invoice.customer_name}
                    </Link>
                  </div>
                </div>
                <div className="info-group">
                  <div className="info-label">Phone</div>
                  <div className="info-value">{invoice.customer_phone || '-'}</div>
                </div>
              </div>
              {invoice.customer_address && (
                <div className="info-group">
                  <div className="info-label">Address</div>
                  <div className="info-value">{invoice.customer_address}</div>
                </div>
              )}
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Invoice Date</div>
                  <div className="info-value">{new Date(invoice.created_at).toLocaleDateString()}</div>
                </div>
                {invoice.due_date && (
                  <div className="info-group">
                    <div className="info-label">Due Date</div>
                    <div className="info-value">{new Date(invoice.due_date).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
              {invoice.job_number && (
                <div className="info-group">
                  <div className="info-label">Related Job</div>
                  <div className="info-value">
                    <Link to={`/jobs/${invoice.job_id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>
                      {invoice.job_number}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amount Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Amount</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span>Subtotal</span>
                <span className="currency">Rs. {invoice.subtotal.toLocaleString()}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span className="currency">Rs. {invoice.tax_amount.toLocaleString()}</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'var(--success)' }}>
                  <span>Discount</span>
                  <span className="currency">- Rs. {invoice.discount.toLocaleString()}</span>
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '700' }}>
                <span>Total</span>
                <span className="currency">Rs. {invoice.total.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', color: 'var(--success)' }}>
                <span>Paid</span>
                <span className="currency">Rs. {invoice.amount_paid.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '1.1rem', fontWeight: '600', color: invoice.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                <span>Balance Due</span>
                <span className="currency">Rs. {invoice.balance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        {(invoice.items?.length > 0 || invoice.parts?.length > 0) && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Line Items</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map(item => (
                    <tr key={`item-${item.id}`}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td className="currency">Rs. {item.unit_price.toLocaleString()}</td>
                      <td className="currency">Rs. {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {invoice.parts?.map(part => (
                    <tr key={`part-${part.id}`}>
                      <td>{part.part_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Part)</span></td>
                      <td>{part.quantity}</td>
                      <td className="currency">Rs. {part.unit_price.toLocaleString()}</td>
                      <td className="currency">Rs. {part.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment History */}
        {invoice.payments?.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Payment History</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.created_at).toLocaleString()}</td>
                      <td style={{ textTransform: 'capitalize' }}>{payment.payment_method}</td>
                      <td>{payment.reference || '-'}</td>
                      <td className="currency" style={{ color: 'var(--success)' }}>Rs. {payment.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Payment</h2>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem' }}>Balance due: <strong className="currency">Rs. {invoice.balance.toLocaleString()}</strong></p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (Rs.) *</label>
                    <input type="number" className="form-control" value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
                      max={invoice.balance} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select className="form-control" value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input type="text" className="form-control" value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({...paymentForm, reference: e.target.value})}
                    placeholder="Transaction ID, cheque number, etc." />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input type="text" className="form-control" value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default InvoiceDetail;
