import { useState, useEffect } from 'react';
import { Plus, Search, X, Trash2, Receipt } from 'lucide-react';
import { getExpenses, createExpense, deleteExpense } from '../api';
import Select from '../components/Select';

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    category: '', description: '', amount: 0, payment_method: 'cash', reference: '', expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadExpenses();
  }, [categoryFilter]);

  const loadExpenses = async () => {
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      const res = await getExpenses(params);
      setExpenses(res.data);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createExpense(formData);
      setShowModal(false);
      setFormData({
        category: '', description: '', amount: 0, payment_method: 'cash', reference: '', expense_date: new Date().toISOString().split('T')[0]
      });
      loadExpenses();
    } catch (error) {
      alert('Failed to add expense');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense?')) {
      await deleteExpense(id);
      loadExpenses();
    }
  };

  const categories = ['Rent', 'Utilities', 'Supplies', 'Equipment', 'Salaries', 'Insurance', 'Marketing', 'Maintenance', 'Other'];
  const uniqueCategories = [...new Set([...categories, ...expenses.map(e => e.category)])];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Expenses</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Expense
        </button>
      </header>
      
      <div className="main-body">
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-icon danger">
              <Receipt size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value currency">
                <span className="currency-symbol">Rs.</span>
                {totalExpenses.toLocaleString()}
              </div>
              <div className="stat-label">Total Expenses</div>
            </div>
          </div>
        </div>

        <div className="search-bar">
          <div style={{ width: '200px' }}>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              name="categoryFilter"
              placeholder="All Categories"
              options={[
                { value: '', label: 'All Categories' },
                ...uniqueCategories.map(cat => ({ value: cat, label: cat }))
              ]}
            />
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : expenses.length === 0 ? (
            <div className="empty-state">
              <Receipt size={64} />
              <h3>No expenses recorded</h3>
              <p>Track your business expenses here</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> Add Expense
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id}>
                      <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                      <td>
                        <span className="badge badge-normal">{expense.category}</span>
                      </td>
                      <td>{expense.description || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{expense.payment_method}</td>
                      <td className="currency" style={{ color: 'var(--danger)' }}>
                        Rs. {expense.amount.toLocaleString()}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(expense.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Expense</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <Select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      name="category"
                      required
                      placeholder="Select Category"
                      options={categories.map(cat => ({ value: cat, label: cat }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-control" value={formData.expense_date}
                      onChange={(e) => setFormData({...formData, expense_date: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="form-control" value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="What was this expense for?" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (Rs.) *</label>
                    <input type="number" className="form-control" value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <Select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                      name="payment_method"
                      placeholder="Select Method"
                      options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'card', label: 'Card' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'cheque', label: 'Cheque' }
                      ]}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input type="text" className="form-control" value={formData.reference}
                    onChange={(e) => setFormData({...formData, reference: e.target.value})}
                    placeholder="Receipt number, invoice number, etc." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Expenses;
