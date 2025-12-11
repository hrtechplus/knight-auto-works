import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// GLOBAL ERROR INTERCEPTOR
// ============================================

// Store for toast notifications (will be set by app)
let showToast = null;
export const setToastHandler = (handler) => { showToast = handler; };

api.interceptors.response.use(
  response => response,
  error => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    
    // Log for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      error: errorData
    });
    
    // Show toast notification if handler is set
    if (showToast) {
      showToast(message, 'error');
    }
    
    // Return the structured error for handling in components
    return Promise.reject({
      code: errorData?.code || 'UNKNOWN_ERROR',
      message,
      details: errorData?.details || null,
      status: error.response?.status
    });
  }
);

// ============================================
// SYSTEM & HEALTH
// ============================================

export const getHealth = () => api.get('/health');
export const triggerBackup = () => api.post('/backup');
export const getAuditLog = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/audit-log${query ? `?${query}` : ''}`);
};

// ============================================
// DASHBOARD
// ============================================

export const getDashboard = () => api.get('/dashboard');

// ============================================
// SETTINGS
// ============================================

export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

// ============================================
// CUSTOMERS
// ============================================

export const getCustomers = (search = '') => api.get(`/customers${search ? `?search=${search}` : ''}`);
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post('/customers', data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// ============================================
// VEHICLES
// ============================================

export const getVehicles = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/vehicles${query ? `?${query}` : ''}`);
};
export const getVehicle = (id) => api.get(`/vehicles/${id}`);
export const createVehicle = (data) => api.post('/vehicles', data);
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}`, data);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);

// ============================================
// JOBS
// ============================================

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

// ============================================
// INVENTORY
// ============================================

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

// ============================================
// SUPPLIERS
// ============================================

export const getSuppliers = () => api.get('/suppliers');
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);

// ============================================
// INVOICES
// ============================================

export const getInvoices = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/invoices${query ? `?${query}` : ''}`);
};
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const createInvoiceFromJob = (jobId) => api.post(`/invoices/from-job/${jobId}`);
export const addPayment = (invoiceId, data) => api.post(`/invoices/${invoiceId}/payments`, data);
export const getOverdueInvoices = () => api.get('/invoices/overdue');

// ============================================
// EXPENSES
// ============================================

export const getExpenses = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/expenses${query ? `?${query}` : ''}`);
};
export const getExpenseCategories = () => api.get('/expenses/categories');
export const createExpense = (data) => api.post('/expenses', data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

// ============================================
// SERVICE REMINDERS
// ============================================

export const getServiceReminders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/service-reminders${query ? `?${query}` : ''}`);
};
export const getDueReminders = () => api.get('/service-reminders/due');
export const createServiceReminder = (data) => api.post('/service-reminders', data);
export const updateServiceReminder = (id, data) => api.put(`/service-reminders/${id}`, data);
export const deleteServiceReminder = (id) => api.delete(`/service-reminders/${id}`);

// ============================================
// REPORTS
// ============================================

export const getRevenueReport = (period = 'monthly') => api.get(`/reports/revenue?period=${period}`);
export const getSummaryReport = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/reports/summary${query ? `?${query}` : ''}`);
};
export const getTechnicianReport = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/reports/technician${query ? `?${query}` : ''}`);
};

export default api;
