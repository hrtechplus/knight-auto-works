import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dashboard
export const getDashboard = () => api.get('/dashboard');

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

// Customers
export const getCustomers = (search = '') => api.get(`/customers${search ? `?search=${search}` : ''}`);
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post('/customers', data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// Vehicles
export const getVehicles = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/vehicles${query ? `?${query}` : ''}`);
};
export const getVehicle = (id) => api.get(`/vehicles/${id}`);
export const createVehicle = (data) => api.post('/vehicles', data);
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}`, data);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);

// Jobs
export const getJobs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/jobs${query ? `?${query}` : ''}`);
};
export const getJob = (id) => api.get(`/jobs/${id}`);
export const createJob = (data) => api.post('/jobs', data);
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data);
export const deleteJob = (id) => api.delete(`/jobs/${id}`);
export const addJobItem = (jobId, data) => api.post(`/jobs/${jobId}/items`, data);
export const deleteJobItem = (jobId, itemId) => api.delete(`/jobs/${jobId}/items/${itemId}`);
export const addJobPart = (jobId, data) => api.post(`/jobs/${jobId}/parts`, data);
export const deleteJobPart = (jobId, partId) => api.delete(`/jobs/${jobId}/parts/${partId}`);

// Inventory
export const getInventory = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/inventory${query ? `?${query}` : ''}`);
};
export const getInventoryCategories = () => api.get('/inventory/categories');
export const getInventoryItem = (id) => api.get(`/inventory/${id}`);
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);
export const adjustStock = (id, data) => api.post(`/inventory/${id}/adjust`, data);

// Suppliers
export const getSuppliers = () => api.get('/suppliers');
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);

// Invoices
export const getInvoices = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/invoices${query ? `?${query}` : ''}`);
};
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const createInvoiceFromJob = (jobId) => api.post(`/invoices/from-job/${jobId}`);
export const addPayment = (invoiceId, data) => api.post(`/invoices/${invoiceId}/payments`, data);

// Expenses
export const getExpenses = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/expenses${query ? `?${query}` : ''}`);
};
export const getExpenseCategories = () => api.get('/expenses/categories');
export const createExpense = (data) => api.post('/expenses', data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

// Reports
export const getRevenueReport = (period = 'monthly') => api.get(`/reports/revenue?period=${period}`);
export const getSummaryReport = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/reports/summary${query ? `?${query}` : ''}`);
};

export default api;
