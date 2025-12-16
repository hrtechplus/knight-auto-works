import axios from 'axios';

// Use relative URL in production, localhost in development
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// AUTH TOKEN MANAGEMENT
// ============================================

const TOKEN_KEY = 'knight_auto_token';
const REFRESH_TOKEN_KEY = 'knight_auto_refresh_token';
const USER_KEY = 'knight_auto_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const setRefreshToken = (token) => localStorage.setItem(REFRESH_TOKEN_KEY, token);
export const removeRefreshToken = () => localStorage.removeItem(REFRESH_TOKEN_KEY);

export const getStoredUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};
export const setStoredUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem(USER_KEY);

// Clear all auth data
const clearAuth = () => {
  removeToken();
  removeRefreshToken();
  removeStoredUser();
};

// Add auth token to all requests
api.interceptors.request.use(
  config => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// ============================================
// GLOBAL ERROR INTERCEPTOR WITH AUTO-REFRESH
// ============================================

let showToast = null;
export const setToastHandler = (handler) => { showToast = handler; };

let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => refreshSubscribers.push(cb);
const onTokenRefreshed = (token) => refreshSubscribers.forEach(cb => cb(token));

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    const errorData = error.response?.data?.error;
    const errorCode = errorData?.code || error.response?.data?.code;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    
    // Handle expired token - try to refresh
    if (error.response?.status === 401 && errorCode === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the current refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken, user } = response.data;
        
        setToken(accessToken);
        setRefreshToken(newRefreshToken);
        setStoredUser(user);
        
        isRefreshing = false;
        onTokenRefreshed(accessToken);
        refreshSubscribers = [];
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        clearAuth();
        if (onUnauthorized) {
          onUnauthorized();
        }
        return Promise.reject(refreshError);
      }
    }
    
    // Handle 401 - redirect to login
    if (error.response?.status === 401) {
      clearAuth();
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    
    // Log for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      error: errorData
    });
    
    // Show toast notification if handler is set (skip for 401)
    if (showToast && error.response?.status !== 401) {
      showToast(message, 'error');
    }
    
    return Promise.reject({
      code: errorData?.code || 'UNKNOWN_ERROR',
      message,
      details: errorData?.details || null,
      status: error.response?.status
    });
  }
);

// ============================================
// AUTHENTICATION
// ============================================

export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  setToken(response.data.accessToken);
  setRefreshToken(response.data.refreshToken);
  setStoredUser(response.data.user);
  return response.data;
};

export const logout = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (e) {
    // Ignore logout errors
  }
  clearAuth();
};

export const refreshAuthToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  
  try {
    const response = await api.post('/auth/refresh', { refreshToken });
    setToken(response.data.accessToken);
    setRefreshToken(response.data.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  } catch (e) {
    clearAuth();
    return null;
  }
};

export const getCurrentUser = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) => 
  api.put('/auth/password', { currentPassword, newPassword });

// ============================================
// USER MANAGEMENT (admin only)
// ============================================

export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);

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
export const downloadInvoicePdf = (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });

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

export const sendEmailNotification = (data) => api.post('/notifications/email', data);

export default api;
