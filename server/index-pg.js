import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import db, { query, queryOne, queryAll, transaction, initializeDatabase, createIndexes } from './database-pg.js';
import { 
  ErrorCodes, createError, validate, schemas, 
  canTransitionJobStatus 
} from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database on startup
async function init() {
  await initializeDatabase();
  await createIndexes();
}

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for SPA
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ============================================
// AUTHENTICATION (Simplified for PostgreSQL)
// ============================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'knight-auto-works-secret-key-change-in-production';

// Auth middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Access denied'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await queryOne('SELECT id, username, name, role, is_active FROM users WHERE id = $1', [decoded.userId]);
    if (!user || !user.is_active) {
      return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'User not found or inactive'));
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Invalid token'));
  }
};

// Login (Public)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE username = $1', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials'));
    }
    if (!user.is_active) {
      return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Account is disabled'));
    }
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// Health check (Public)
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await queryOne('SELECT 1 as ok');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbCheck?.ok === 1 ? 'connected' : 'error',
      version: '2.0.0-pg'
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Protected routes middleware
app.use('/api', authMiddleware);

// Get current user
app.get('/api/auth/me', async (req, res) => {
  res.json(req.user);
});

// ============================================
// ROLE-BASED ACCESS CONTROL
// ============================================

// Role middleware - checks if user has one of the specified roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(createError('FORBIDDEN', 'Insufficient permissions'));
    }
    next();
  };
}

// Convenience middleware for admin or above
function requireAdminOrAbove(req, res, next) {
  if (!req.user) {
    return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Authentication required'));
  }
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json(createError('FORBIDDEN', 'Admin access required'));
  }
  next();
}

// ============================================
// USER MANAGEMENT (super_admin only)
// ============================================

// Get all users
app.get('/api/users', requireRole('super_admin'), async (req, res) => {
  try {
    const users = await queryAll('SELECT id, username, name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// Create user
app.post('/api/users', requireRole('super_admin'), async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Username, password, and name are required'));
    }
    
    if (password.length < 8) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Password must be at least 8 characters'));
    }
    
    const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) {
      return res.status(400).json(createError(ErrorCodes.CONFLICT, 'Username already exists'));
    }
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const targetRole = role || 'staff';
    
    const result = await query(
      'INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, passwordHash, name, targetRole]
    );
    
    const newUser = { id: result.rows[0].id, username, name, role: targetRole };
    await auditLog('users', result.rows[0].id, 'create', null, newUser);
    
    res.json(newUser);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// Update user
app.put('/api/users/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const { name, role, is_active, password } = req.body;
    const userId = req.params.id;
    
    const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'User not found'));
    }
    
    if (password) {
      const newHash = bcrypt.hashSync(password, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    }
    
    const targetRole = role || user.role;
    const targetActive = is_active !== undefined ? is_active : user.is_active;
    
    await query(
      'UPDATE users SET name = $1, role = $2, is_active = $3 WHERE id = $4',
      [name || user.name, targetRole, targetActive, userId]
    );
    
    const updatedUser = { id: userId, name: name || user.name, role: targetRole, is_active: targetActive };
    await auditLog('users', userId, 'update', user, updatedUser);
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// Change password (for current user)
app.put('/api/auth/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Current and new password are required'));
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'New password must be at least 8 characters'));
    }
    
    const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
    
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Current password is incorrect'));
    }
    
    const newHash = bcrypt.hashSync(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// AUDIT LOGGING
// ============================================

async function auditLog(tableName, recordId, action, oldData = null, newData = null) {
  try {
    await query(
      'INSERT INTO audit_log (table_name, record_id, action, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      [tableName, recordId, action, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function generateJobNumber() {
  const settings = await queryOne("SELECT value FROM settings WHERE key = 'job_prefix'");
  const prefix = settings?.value || 'KAW';
  const year = new Date().getFullYear();
  const lastJob = await queryOne(
    'SELECT job_number FROM jobs WHERE job_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [`${prefix}-${year}-%`]
  );
  let nextNum = 1;
  if (lastJob) {
    const parts = lastJob.job_number.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }
  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

async function generateInvoiceNumber() {
  const settings = await queryOne("SELECT value FROM settings WHERE key = 'invoice_prefix'");
  const prefix = settings?.value || 'INV';
  const year = new Date().getFullYear();
  const lastInv = await queryOne(
    'SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [`${prefix}-${year}-%`]
  );
  let nextNum = 1;
  if (lastInv) {
    const parts = lastInv.invoice_number.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }
  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

// ============================================
// DASHBOARD ROUTES
// ============================================

app.get('/api/dashboard', async (req, res) => {
  try {
    const [
      jobsToday, jobsInProgress, jobsPending, jobsCompleted,
      totalCustomers, totalVehicles, lowStockItems,
      revenueToday, revenueThisMonth, unpaidInvoices,
      recentJobs, recentPayments
    ] = await Promise.all([
      queryOne("SELECT COUNT(*) as count FROM jobs WHERE DATE(created_at) = CURRENT_DATE"),
      queryOne("SELECT COUNT(*) as count FROM jobs WHERE status = 'in_progress'"),
      queryOne("SELECT COUNT(*) as count FROM jobs WHERE status = 'pending'"),
      queryOne("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'"),
      queryOne("SELECT COUNT(*) as count FROM customers"),
      queryOne("SELECT COUNT(*) as count FROM vehicles"),
      queryOne("SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_stock"),
      queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = CURRENT_DATE"),
      queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)"),
      queryOne("SELECT COUNT(*) as count, COALESCE(SUM(balance), 0) as total FROM invoices WHERE status != 'paid'"),
      queryAll(`
        SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name
        FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
        ORDER BY j.created_at DESC LIMIT 5
      `),
      queryAll(`
        SELECT p.*, i.invoice_number, c.name as customer_name
        FROM payments p JOIN invoices i ON p.invoice_id = i.id JOIN customers c ON i.customer_id = c.id
        ORDER BY p.created_at DESC LIMIT 5
      `)
    ]);

    res.json({
      stats: {
        jobsToday: parseInt(jobsToday.count),
        jobsInProgress: parseInt(jobsInProgress.count),
        jobsPending: parseInt(jobsPending.count),
        jobsCompleted: parseInt(jobsCompleted.count),
        totalCustomers: parseInt(totalCustomers.count),
        totalVehicles: parseInt(totalVehicles.count),
        lowStockItems: parseInt(lowStockItems.count),
        revenueToday: parseFloat(revenueToday.total),
        revenueThisMonth: parseFloat(revenueThisMonth.total),
        unpaidInvoices
      },
      recentJobs,
      recentPayments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SETTINGS ROUTES
// ============================================

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await queryAll('SELECT * FROM settings');
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json(settingsObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', requireAdminOrAbove, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER ROUTES
// ============================================

app.get('/api/customers', async (req, res) => {
  try {
    const { search } = req.query;
    let customers;
    if (search) {
      customers = await queryAll(`
        SELECT c.*, COUNT(v.id) as vehicle_count FROM customers c
        LEFT JOIN vehicles v ON c.id = v.customer_id
        WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1
        GROUP BY c.id ORDER BY c.name
      `, [`%${search}%`]);
    } else {
      customers = await queryAll(`
        SELECT c.*, COUNT(v.id) as vehicle_count FROM customers c
        LEFT JOIN vehicles v ON c.id = v.customer_id
        GROUP BY c.id ORDER BY c.created_at DESC
      `);
    }
    res.json(customers);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!customer) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    
    const vehicles = await queryAll('SELECT * FROM vehicles WHERE customer_id = $1', [req.params.id]);
    const invoices = await queryAll('SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.id]);
    
    res.json({ ...customer, vehicles, invoices });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const errors = validate(req.body, schemas.customer);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    
    const { name, phone, email, address, notes } = req.body;
    const result = await query(
      'INSERT INTO customers (name, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, phone, email, address, notes]
    );
    
    const newCustomer = { id: result.rows[0].id, ...req.body };
    await auditLog('customers', result.rows[0].id, 'create', null, newCustomer);
    res.json(newCustomer);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const errors = validate(req.body, schemas.customer);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    
    const oldCustomer = await queryOne('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!oldCustomer) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    
    const { name, phone, email, address, notes } = req.body;
    await query(
      'UPDATE customers SET name = $1, phone = $2, email = $3, address = $4, notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [name, phone, email, address, notes, req.params.id]
    );
    
    const updatedCustomer = { id: parseInt(req.params.id), ...req.body };
    await auditLog('customers', req.params.id, 'update', oldCustomer, updatedCustomer);
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.delete('/api/customers/:id', requireAdminOrAbove, async (req, res) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!customer) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    
    const openJobs = await queryOne(`
      SELECT COUNT(*) as count FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id
      WHERE v.customer_id = $1 AND j.status NOT IN ('completed', 'cancelled', 'invoiced')
    `, [req.params.id]);
    
    if (parseInt(openJobs.count) > 0) {
      return res.status(400).json(createError(ErrorCodes.BUSINESS_RULE, `Cannot delete customer with ${openJobs.count} open job(s)`));
    }
    
    await query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    await auditLog('customers', req.params.id, 'delete', customer, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// VEHICLE ROUTES
// ============================================

app.get('/api/vehicles', async (req, res) => {
  try {
    const { search, customer_id } = req.query;
    let vehicles;
    
    if (customer_id) {
      vehicles = await queryAll(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v JOIN customers c ON v.customer_id = c.id
        WHERE v.customer_id = $1 ORDER BY v.created_at DESC
      `, [customer_id]);
    } else if (search) {
      vehicles = await queryAll(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v JOIN customers c ON v.customer_id = c.id
        WHERE v.plate_number ILIKE $1 OR v.make ILIKE $1 OR v.model ILIKE $1 OR c.name ILIKE $1
        ORDER BY v.created_at DESC
      `, [`%${search}%`]);
    } else {
      vehicles = await queryAll(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v JOIN customers c ON v.customer_id = c.id ORDER BY v.created_at DESC
      `);
    }
    res.json(vehicles);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await queryOne(`
      SELECT v.*, c.name as customer_name, c.phone as customer_phone
      FROM vehicles v JOIN customers c ON v.customer_id = c.id WHERE v.id = $1
    `, [req.params.id]);
    if (!vehicle) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    
    const jobs = await queryAll('SELECT * FROM jobs WHERE vehicle_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const reminders = await queryAll('SELECT * FROM service_reminders WHERE vehicle_id = $1 ORDER BY due_date ASC', [req.params.id]);
    
    res.json({ ...vehicle, jobs, reminders });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const errors = validate(req.body, schemas.vehicle);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    
    const { customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, category, notes } = req.body;
    
    const customer = await queryOne('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (!customer) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    
    const result = await query(
      'INSERT INTO vehicles (customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, category, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
      [customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer || 0, category || 'Asian', notes]
    );
    
    const newVehicle = { id: result.rows[0].id, ...req.body };
    await auditLog('vehicles', result.rows[0].id, 'create', null, newVehicle);
    res.json(newVehicle);
  } catch (error) {
    if (error.message.includes('unique') || error.code === '23505') {
      res.status(400).json(createError(ErrorCodes.CONFLICT, 'A vehicle with this plate number already exists'));
    } else {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const errors = validate(req.body, schemas.vehicle);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    
    const oldVehicle = await queryOne('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (!oldVehicle) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    
    const { customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, category, notes } = req.body;
    await query(
      'UPDATE vehicles SET customer_id = $1, plate_number = $2, make = $3, model = $4, year = $5, vin = $6, color = $7, engine_type = $8, transmission = $9, odometer = $10, category = $11, notes = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13',
      [customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, category, notes, req.params.id]
    );
    
    const updatedVehicle = { id: parseInt(req.params.id), ...req.body };
    await auditLog('vehicles', req.params.id, 'update', oldVehicle, updatedVehicle);
    res.json(updatedVehicle);
  } catch (error) {
    if (error.message.includes('unique') || error.code === '23505') {
      res.status(400).json(createError(ErrorCodes.CONFLICT, 'A vehicle with this plate number already exists'));
    } else {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
});

app.delete('/api/vehicles/:id', requireAdminOrAbove, async (req, res) => {
  try {
    const vehicle = await queryOne('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (!vehicle) return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    
    const openJobs = await queryOne(`
      SELECT COUNT(*) as count FROM jobs WHERE vehicle_id = $1 AND status NOT IN ('completed', 'cancelled', 'invoiced')
    `, [req.params.id]);
    
    if (parseInt(openJobs.count) > 0) {
      return res.status(400).json(createError(ErrorCodes.BUSINESS_RULE, `Cannot delete vehicle with ${openJobs.count} open job(s)`));
    }
    
    await query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    await auditLog('vehicles', req.params.id, 'delete', vehicle, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// JOB ROUTES
// ============================================

app.get('/api/jobs', async (req, res) => {
  try {
    const { status, search } = req.query;
    let jobs;
    
    if (status && search) {
      jobs = await queryAll(`
        SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
        FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
        WHERE j.status = $1 AND (j.job_number ILIKE $2 OR v.plate_number ILIKE $2 OR c.name ILIKE $2)
        ORDER BY j.created_at DESC
      `, [status, `%${search}%`]);
    } else if (status) {
      jobs = await queryAll(`
        SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
        FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
        WHERE j.status = $1 ORDER BY j.created_at DESC
      `, [status]);
    } else if (search) {
      jobs = await queryAll(`
        SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
        FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
        WHERE j.job_number ILIKE $1 OR v.plate_number ILIKE $1 OR c.name ILIKE $1
        ORDER BY j.created_at DESC
      `, [`%${search}%`]);
    } else {
      jobs = await queryAll(`
        SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
        FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
        ORDER BY j.created_at DESC
      `);
    }
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await queryOne(`
      SELECT j.*, v.plate_number, v.make, v.model, v.year, v.color, v.odometer as vehicle_odometer, v.category as vehicle_category,
             c.id as customer_id, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM jobs j JOIN vehicles v ON j.vehicle_id = v.id JOIN customers c ON v.customer_id = c.id
      WHERE j.id = $1
    `, [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const items = await queryAll('SELECT * FROM job_items WHERE job_id = $1', [req.params.id]);
    const parts = await queryAll('SELECT * FROM job_parts WHERE job_id = $1', [req.params.id]);
    const invoice = await queryOne('SELECT * FROM invoices WHERE job_id = $1', [req.params.id]);
    
    res.json({ ...job, items, parts, invoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const { vehicle_id, description, priority, technician, odometer_in, estimated_completion } = req.body;
    const job_number = await generateJobNumber();
    
    const result = await query(
      'INSERT INTO jobs (job_number, vehicle_id, description, priority, technician, odometer_in, estimated_completion) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [job_number, vehicle_id, description, priority || 'normal', technician, odometer_in, estimated_completion]
    );
    
    res.json({ id: result.rows[0].id, job_number, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const { status, description, priority, technician, diagnosis, labor_hours, labor_rate, notes } = req.body;
    const job = await queryOne('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const labor_cost = (labor_hours || 0) * (labor_rate || job.labor_rate);
    const partsResult = await queryOne('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = $1', [req.params.id]);
    const parts_cost = parseFloat(partsResult.total);
    const total_cost = labor_cost + parts_cost;
    
    let started_at = job.started_at;
    let completed_at = job.completed_at;
    
    if (status === 'in_progress' && !job.started_at) started_at = new Date().toISOString();
    if (status === 'completed' && !job.completed_at) completed_at = new Date().toISOString();
    
    await query(`
      UPDATE jobs SET status = $1, description = $2, priority = $3, technician = $4, diagnosis = $5,
      labor_hours = $6, labor_rate = $7, labor_cost = $8, parts_cost = $9, total_cost = $10,
      notes = $11, started_at = $12, completed_at = $13 WHERE id = $14
    `, [status || job.status, description, priority, technician, diagnosis, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, notes, started_at, completed_at, req.params.id]);
    
    res.json({ id: parseInt(req.params.id), ...req.body, labor_cost, parts_cost, total_cost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:id', requireAdminOrAbove, async (req, res) => {
  try {
    await query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job Items
app.post('/api/jobs/:id/items', async (req, res) => {
  try {
    const { description, quantity, unit_price, discount, discount_type } = req.body;
    let subtotal = (quantity || 1) * (unit_price || 0);
    let discountAmount = 0;
    if (discount && discount > 0) {
      discountAmount = discount_type === 'percent' ? subtotal * (discount / 100) : discount;
    }
    const total = Math.max(0, subtotal - discountAmount);
    
    const result = await query(
      'INSERT INTO job_items (job_id, description, quantity, unit_price, total, discount, discount_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [req.params.id, description, quantity || 1, unit_price || 0, total, discount || 0, discount_type || 'fixed']
    );
    
    res.json({ id: result.rows[0].id, ...req.body, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:jobId/items/:itemId', async (req, res) => {
  try {
    await query('DELETE FROM job_items WHERE id = $1 AND job_id = $2', [req.params.itemId, req.params.jobId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job Parts
app.post('/api/jobs/:id/parts', async (req, res) => {
  try {
    const { inventory_id, part_name, quantity, unit_price } = req.body;
    const total = (quantity || 1) * (unit_price || 0);
    
    const result = await transaction(async (client) => {
      const insertResult = await client.query(
        'INSERT INTO job_parts (job_id, inventory_id, part_name, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [req.params.id, inventory_id, part_name, quantity || 1, unit_price || 0, total]
      );
      
      if (inventory_id) {
        await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [quantity || 1, inventory_id]);
        await client.query(
          'INSERT INTO stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [inventory_id, 'out', quantity || 1, 'job', req.params.id, `Used in Job #${req.params.id}`]
        );
      }
      
      // Update job costs
      const partsResult = await client.query('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = $1', [req.params.id]);
      const parts_cost = parseFloat(partsResult.rows[0].total);
      const jobResult = await client.query('SELECT labor_cost FROM jobs WHERE id = $1', [req.params.id]);
      const total_cost = (parseFloat(jobResult.rows[0]?.labor_cost) || 0) + parts_cost;
      await client.query('UPDATE jobs SET parts_cost = $1, total_cost = $2 WHERE id = $3', [parts_cost, total_cost, req.params.id]);
      
      return { id: insertResult.rows[0].id, ...req.body, total };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:jobId/parts/:partId', async (req, res) => {
  try {
    await transaction(async (client) => {
      const partResult = await client.query('SELECT * FROM job_parts WHERE id = $1 AND job_id = $2', [req.params.partId, req.params.jobId]);
      const part = partResult.rows[0];
      
      if (part && part.inventory_id) {
        await client.query('UPDATE inventory SET quantity = quantity + $1 WHERE id = $2', [part.quantity, part.inventory_id]);
        await client.query(
          'INSERT INTO stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [part.inventory_id, 'in', part.quantity, 'job', req.params.jobId, 'Returned from job']
        );
      }
      
      await client.query('DELETE FROM job_parts WHERE id = $1 AND job_id = $2', [req.params.partId, req.params.jobId]);
      
      // Update job costs
      const partsResult = await client.query('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = $1', [req.params.jobId]);
      const parts_cost = parseFloat(partsResult.rows[0].total);
      const jobResult = await client.query('SELECT labor_cost FROM jobs WHERE id = $1', [req.params.jobId]);
      const total_cost = (parseFloat(jobResult.rows[0]?.labor_cost) || 0) + parts_cost;
      await client.query('UPDATE jobs SET parts_cost = $1, total_cost = $2 WHERE id = $3', [parts_cost, total_cost, req.params.jobId]);
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVENTORY ROUTES
// ============================================

app.get('/api/inventory', async (req, res) => {
  try {
    const { search, category, low_stock } = req.query;
    let queryStr = 'SELECT i.*, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id';
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(i.name ILIKE $${paramIndex} OR i.sku ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (category) {
      conditions.push(`i.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (low_stock === 'true') {
      conditions.push('i.quantity <= i.min_stock');
    }
    
    if (conditions.length) queryStr += ' WHERE ' + conditions.join(' AND ');
    queryStr += ' ORDER BY i.name';
    
    const items = await queryAll(queryStr, params);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/categories', async (req, res) => {
  try {
    const categories = await queryAll("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category != '' ORDER BY category");
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    const item = await queryOne('SELECT i.*, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE i.id = $1', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const movements = await queryAll('SELECT * FROM stock_movements WHERE inventory_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json({ ...item, movements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location } = req.body;
    const result = await query(
      'INSERT INTO inventory (sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [sku, name, description, category, quantity || 0, min_stock || 5, cost_price || 0, sell_price || 0, supplier_id, location]
    );
    res.json({ id: result.rows[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const { sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location } = req.body;
    await query(
      'UPDATE inventory SET sku = $1, name = $2, description = $3, category = $4, quantity = $5, min_stock = $6, cost_price = $7, sell_price = $8, supplier_id = $9, location = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11',
      [sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location, req.params.id]
    );
    res.json({ id: parseInt(req.params.id), ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inventory/:id', requireAdminOrAbove, async (req, res) => {
  try {
    await query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock adjustment
app.post('/api/inventory/:id/adjust', async (req, res) => {
  try {
    const { adjustment, reason } = req.body;
    await transaction(async (client) => {
      await client.query('UPDATE inventory SET quantity = quantity + $1 WHERE id = $2', [adjustment, req.params.id]);
      await client.query(
        'INSERT INTO stock_movements (inventory_id, movement_type, quantity, notes) VALUES ($1, $2, $3, $4)',
        [req.params.id, adjustment > 0 ? 'in' : 'out', Math.abs(adjustment), reason || 'Manual adjustment']
      );
    });
    const item = await queryOne('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUPPLIER ROUTES
// ============================================

app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await queryAll('SELECT * FROM suppliers ORDER BY name');
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await queryOne('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, notes } = req.body;
    const result = await query(
      'INSERT INTO suppliers (name, contact_person, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, contact_person, phone, email, address, notes]
    );
    res.json({ id: result.rows[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, notes } = req.body;
    await query(
      'UPDATE suppliers SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, notes = $6 WHERE id = $7',
      [name, contact_person, phone, email, address, notes, req.params.id]
    );
    res.json({ id: parseInt(req.params.id), ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    await query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVOICE ROUTES
// ============================================

app.get('/api/invoices', async (req, res) => {
  try {
    const { status, search } = req.query;
    let invoices;
    
    if (status && search) {
      invoices = await queryAll(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i JOIN customers c ON i.customer_id = c.id
        WHERE i.status = $1 AND (i.invoice_number ILIKE $2 OR c.name ILIKE $2)
        ORDER BY i.created_at DESC
      `, [status, `%${search}%`]);
    } else if (status) {
      invoices = await queryAll(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i JOIN customers c ON i.customer_id = c.id
        WHERE i.status = $1 ORDER BY i.created_at DESC
      `, [status]);
    } else if (search) {
      invoices = await queryAll(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i JOIN customers c ON i.customer_id = c.id
        WHERE i.invoice_number ILIKE $1 OR c.name ILIKE $1
        ORDER BY i.created_at DESC
      `, [`%${search}%`]);
    } else {
      invoices = await queryAll(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM invoices i JOIN customers c ON i.customer_id = c.id ORDER BY i.created_at DESC
      `);
    }
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await queryOne(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
      FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = $1
    `, [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    const payments = await queryAll('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC', [req.params.id]);
    
    let job = null, items = [], parts = [];
    if (invoice.job_id) {
      job = await queryOne(`
        SELECT j.*, v.plate_number, v.make, v.model FROM jobs j
        JOIN vehicles v ON j.vehicle_id = v.id WHERE j.id = $1
      `, [invoice.job_id]);
      items = await queryAll('SELECT * FROM job_items WHERE job_id = $1', [invoice.job_id]);
      parts = await queryAll('SELECT * FROM job_parts WHERE job_id = $1', [invoice.job_id]);
    }
    
    res.json({ ...invoice, payments, job, items, parts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { job_id, customer_id, subtotal, tax_rate, tax_amount, discount, total, due_date, notes } = req.body;
    const invoice_number = await generateInvoiceNumber();
    const balance = total;
    
    const result = await query(
      'INSERT INTO invoices (invoice_number, job_id, customer_id, subtotal, tax_rate, tax_amount, discount, total, balance, due_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [invoice_number, job_id, customer_id, subtotal, tax_rate || 0, tax_amount || 0, discount || 0, total, balance, due_date, notes]
    );
    
    if (job_id) {
      await query("UPDATE jobs SET status = 'invoiced' WHERE id = $1", [job_id]);
    }
    
    res.json({ id: result.rows[0].id, invoice_number, ...req.body, balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create invoice from job
app.post('/api/invoices/from-job/:jobId', async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      // Get job with customer info
      const jobResult = await client.query(`
        SELECT j.*, v.customer_id FROM jobs j
        JOIN vehicles v ON j.vehicle_id = v.id
        WHERE j.id = $1
      `, [req.params.jobId]);
      
      if (jobResult.rows.length === 0) {
        throw new Error('Job not found');
      }
      const job = jobResult.rows[0];
      
      // Get tax rate from settings
      const taxResult = await client.query("SELECT value FROM settings WHERE key = 'tax_rate'");
      const taxRate = parseFloat(taxResult.rows[0]?.value || 0);
      
      const subtotal = parseFloat(job.total_cost) || 0;
      const tax_amount = subtotal * (taxRate / 100);
      const total = subtotal + tax_amount;
      const invoice_number = await generateInvoiceNumber();
      
      // Create invoice
      const insertResult = await client.query(
        'INSERT INTO invoices (invoice_number, job_id, customer_id, subtotal, tax_rate, tax_amount, total, balance) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [invoice_number, job.id, job.customer_id, subtotal, taxRate, tax_amount, total, total]
      );
      
      // Update job status to invoiced
      await client.query("UPDATE jobs SET status = 'invoiced' WHERE id = $1", [job.id]);
      
      return { id: insertResult.rows[0].id, invoice_number, subtotal, total, balance: total };
    });
    
    res.json(result);
  } catch (error) {
    const status = error.message === 'Job not found' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PDF Invoice Generation - Professional Design with Logo
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = await queryOne(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, 
             c.email as customer_email, c.address as customer_address,
             j.job_number, j.description as job_description,
             v.plate_number, v.make, v.model
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE i.id = $1
    `, [req.params.id]);
    
    if (!invoice) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }
    
    // Get job items and parts if linked to a job
    let items = [];
    let parts = [];
    if (invoice.job_id) {
      items = await queryAll('SELECT * FROM job_items WHERE job_id = $1', [invoice.job_id]);
      parts = await queryAll('SELECT * FROM job_parts WHERE job_id = $1', [invoice.job_id]);
    }
    
    // Get settings
    const settings = await queryAll('SELECT * FROM settings');
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.key] = s.value);
    
    const businessName = settingsMap.business_name || 'Knight Auto Works';
    const currencySymbol = settingsMap.currency_symbol || 'Rs.';
    
    // Create PDF with custom margins
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=invoice-${invoice.invoice_number}.pdf`);
    
    doc.pipe(res);
    
    // Colors
    const primaryColor = '#f97316'; // Orange
    const darkColor = '#1a1a1a';
    const grayColor = '#666666';
    const lightGray = '#f5f5f5';
    
    // ========== HEADER WITH LOGO ==========
    const logoPath = path.join(__dirname, 'assets', 'logo.jpg');
    try {
      doc.image(logoPath, 50, 40, { width: 70 });
    } catch (e) {
      // Logo not found, skip
    }
    
    // Business name next to logo
    doc.font('Helvetica-Bold').fontSize(22).fillColor(primaryColor);
    doc.text(businessName, 130, 50);
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text('Professional Auto Care Services', 130, 75);
    
    // Invoice title on the right
    doc.font('Helvetica-Bold').fontSize(28).fillColor(darkColor);
    doc.text('INVOICE', 400, 50, { align: 'right' });
    
    // Invoice number badge
    doc.fontSize(11).fillColor(grayColor);
    doc.text(`#${invoice.invoice_number}`, 400, 82, { align: 'right' });
    
    // Horizontal line
    doc.strokeColor(primaryColor).lineWidth(2);
    doc.moveTo(50, 115).lineTo(545, 115).stroke();
    
    // ========== INVOICE DETAILS & CUSTOMER ==========
    let yPos = 135;
    
    // Left side - Bill To
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor);
    doc.text('BILL TO', 50, yPos);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkColor);
    doc.text(invoice.customer_name, 50, yPos + 15);
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    let customerY = yPos + 30;
    if (invoice.customer_phone) {
      doc.text(`Phone: ${invoice.customer_phone}`, 50, customerY);
      customerY += 12;
    }
    if (invoice.customer_email) {
      doc.text(`Email: ${invoice.customer_email}`, 50, customerY);
      customerY += 12;
    }
    if (invoice.customer_address) {
      doc.text(invoice.customer_address, 50, customerY, { width: 200 });
    }
    
    // Right side - Invoice Details
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor);
    doc.text('INVOICE DETAILS', 350, yPos);
    
    const detailsX = 350;
    const valuesX = 450;
    let detailY = yPos + 15;
    
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text('Date:', detailsX, detailY);
    doc.fillColor(darkColor).text(new Date(invoice.created_at).toLocaleDateString(), valuesX, detailY);
    detailY += 14;
    
    if (invoice.due_date) {
      doc.fillColor(grayColor).text('Due Date:', detailsX, detailY);
      doc.fillColor(darkColor).text(new Date(invoice.due_date).toLocaleDateString(), valuesX, detailY);
      detailY += 14;
    }
    
    doc.fillColor(grayColor).text('Status:', detailsX, detailY);
    const statusColor = invoice.status === 'paid' ? '#22c55e' : '#ef4444';
    doc.fillColor(statusColor).font('Helvetica-Bold').text(invoice.status.toUpperCase(), valuesX, detailY);
    detailY += 14;
    
    if (invoice.job_number) {
      doc.font('Helvetica').fillColor(grayColor).text('Job Ref:', detailsX, detailY);
      doc.fillColor(darkColor).text(invoice.job_number, valuesX, detailY);
      detailY += 14;
    }
    
    if (invoice.plate_number) {
      doc.fillColor(grayColor).text('Vehicle:', detailsX, detailY);
      doc.fillColor(darkColor).text(`${invoice.plate_number} - ${invoice.make} ${invoice.model}`, valuesX, detailY);
    }
    
    // Line Items Table
    yPos = 310;
    
    const tableLeft = 50;
    const tableRight = 550;
    const colDesc = 50;
    const colQty = 320;
    const colRate = 380;
    const colTotal = 460;
    
    // Header
    doc.fillColor(primaryColor).rect(tableLeft, yPos, tableRight - tableLeft, 20).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION', colDesc + 10, yPos + 5);
    doc.text('QTY', colQty, yPos + 5, { width: 50, align: 'center' });
    doc.text('RATE', colRate, yPos + 5, { width: 60, align: 'right' });
    doc.text('TOTAL', colTotal, yPos + 5, { width: 80, align: 'right' });
    
    yPos += 20;
    let itemIndex = 0;
    
    // Job Items
    items.forEach(item => {
      const rowHeight = 24; 
      if (itemIndex % 2 === 0) {
        doc.rect(tableLeft, yPos, tableRight - tableLeft, rowHeight).fill('#f9fafb');
      }
      
      doc.font('Helvetica').fontSize(9).fillColor(darkColor);
      doc.text(item.description, colDesc + 10, yPos + 5, { width: 260 });
      doc.text(parseFloat(item.quantity).toString(), colQty, yPos + 5, { width: 50, align: 'center' });
      doc.text(`${currencySymbol}${parseFloat(item.unit_price).toFixed(2)}`, colRate, yPos + 5, { width: 60, align: 'right' });
      doc.text(`${currencySymbol}${parseFloat(item.total).toFixed(2)}`, colTotal, yPos + 5, { width: 80, align: 'right' });
      
      yPos += rowHeight;
      itemIndex++;
    });

    // Add parts with "Parts:" label
    if (parts.length > 0) {
      doc.rect(tableLeft, yPos, tableRight - tableLeft, 18).fill('#fff7ed');
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor);
      doc.text('PARTS & MATERIALS', colDesc + 10, yPos + 5);
      yPos += 18;
    }
    
    let rowIndex = 0;
    parts.forEach(part => {
      const rowHeight = 20;
      if (rowIndex % 2 === 0) {
        doc.rect(tableLeft, yPos, tableRight - tableLeft, rowHeight).fill(lightGray);
      }
      
      doc.font('Helvetica').fontSize(9).fillColor(darkColor);
      doc.text(part.part_name, colDesc + 10, yPos + 5, { width: 260 });
      doc.text(parseFloat(part.quantity).toString(), colQty, yPos + 5, { width: 50, align: 'center' });
      doc.text(`${currencySymbol}${parseFloat(part.unit_price).toFixed(2)}`, colRate, yPos + 5, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').text(`${currencySymbol}${parseFloat(part.total).toFixed(2)}`, colTotal, yPos + 5, { width: 55, align: 'right' });
      
      yPos += rowHeight;
      rowIndex++;
    });
    
    // Table bottom border
    doc.strokeColor('#dddddd').lineWidth(1);
    doc.moveTo(tableLeft, yPos).lineTo(tableRight, yPos).stroke();
    
    // ========== TOTALS SECTION ==========
    yPos += 20;
    const totalsX = 380;
    const totalsValueX = 480;
    
    // Subtotal
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text('Subtotal:', totalsX, yPos);
    doc.fillColor(darkColor).text(`${currencySymbol}${parseFloat(invoice.subtotal).toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    yPos += 16;
    
    // Tax
    if (parseFloat(invoice.tax_amount) > 0) {
      doc.fillColor(grayColor).text(`Tax (${invoice.tax_rate}%):`, totalsX, yPos);
      doc.fillColor(darkColor).text(`${currencySymbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
      yPos += 16;
    }
    
    // Discount
    if (parseFloat(invoice.discount) > 0) {
      doc.fillColor(grayColor).text('Discount:', totalsX, yPos);
      doc.fillColor('#22c55e').text(`-${currencySymbol}${parseFloat(invoice.discount).toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
      yPos += 16;
    }
    
    // Total box
    doc.rect(totalsX - 10, yPos, 180, 25).fill(primaryColor);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('white');
    doc.text('TOTAL:', totalsX, yPos + 6);
    doc.text(`${currencySymbol}${parseFloat(invoice.total).toFixed(2)}`, totalsValueX - 10, yPos + 6, { width: 75, align: 'right' });
    yPos += 35;
    
    // Payment info
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text('Amount Paid:', totalsX, yPos);
    doc.fillColor('#22c55e').text(`${currencySymbol}${parseFloat(invoice.amount_paid).toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    yPos += 16;
    
    doc.fillColor(grayColor).text('Balance Due:', totalsX, yPos);
    const balanceColor = parseFloat(invoice.balance) > 0 ? '#ef4444' : '#22c55e';
    doc.font('Helvetica-Bold').fillColor(balanceColor);
    doc.text(`${currencySymbol}${parseFloat(invoice.balance).toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    
    // ========== FOOTER ==========
    const footerY = 750;
    
    // Divider line
    doc.strokeColor('#dddddd').lineWidth(1);
    doc.moveTo(50, footerY - 20).lineTo(545, footerY - 20).stroke();
    
    // Thank you message
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
    doc.text('Thank you for your business!', 50, footerY, { align: 'center', width: 495 });
    
    doc.font('Helvetica').fontSize(8).fillColor(grayColor);
    doc.text('For any questions about this invoice, please contact us.', 50, footerY + 18, { align: 'center', width: 495 });
    doc.text(`Generated by ${businessName} • ${new Date().toLocaleDateString()}`, 50, footerY + 35, { align: 'center', width: 495 });
    
    doc.end();
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

app.post('/api/invoices/:id/payments', async (req, res) => {
  try {
    const { amount, payment_method, reference, notes } = req.body;
    
    const result = await transaction(async (client) => {
      const paymentResult = await client.query(
        'INSERT INTO payments (invoice_id, amount, payment_method, reference, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [req.params.id, amount, payment_method || 'cash', reference, notes]
      );
      
      // Update invoice
      const invoiceResult = await client.query('SELECT total, amount_paid FROM invoices WHERE id = $1', [req.params.id]);
      const invoice = invoiceResult.rows[0];
      const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
      const newBalance = parseFloat(invoice.total) - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      
      await client.query(
        'UPDATE invoices SET amount_paid = $1, balance = $2, status = $3, paid_at = CASE WHEN $3 = $4 THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = $5',
        [newAmountPaid, Math.max(0, newBalance), newStatus, 'paid', req.params.id]
      );
      
      return { id: paymentResult.rows[0].id, ...req.body };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXPENSE ROUTES
// ============================================

app.get('/api/expenses', async (req, res) => {
  try {
    const { category, start_date, end_date } = req.query;
    let queryStr = 'SELECT * FROM expenses';
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (start_date) {
      conditions.push(`expense_date >= $${paramIndex}`);
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      conditions.push(`expense_date <= $${paramIndex}`);
      params.push(end_date);
      paramIndex++;
    }
    
    if (conditions.length) queryStr += ' WHERE ' + conditions.join(' AND ');
    queryStr += ' ORDER BY expense_date DESC';
    
    const expenses = await queryAll(queryStr, params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { category, description, amount, payment_method, reference, expense_date } = req.body;
    const result = await query(
      'INSERT INTO expenses (category, description, amount, payment_method, reference, expense_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [category, description, amount, payment_method || 'cash', reference, expense_date || new Date().toISOString().split('T')[0]]
    );
    res.json({ id: result.rows[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', requireAdminOrAbove, async (req, res) => {
  try {
    await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REPORTS
// ============================================

app.get('/api/reports/revenue', requireAdminOrAbove, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];
    
    const [revenue, expenses, dailyRevenue] = await Promise.all([
      queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) BETWEEN $1 AND $2', [start, end]),
      queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date BETWEEN $1 AND $2', [start, end]),
      queryAll(`
        SELECT DATE(created_at) as date, SUM(amount) as total
        FROM payments WHERE DATE(created_at) BETWEEN $1 AND $2
        GROUP BY DATE(created_at) ORDER BY date
      `, [start, end])
    ]);
    
    res.json({
      period: { start, end },
      revenue: parseFloat(revenue.total),
      expenses: parseFloat(expenses.total),
      profit: parseFloat(revenue.total) - parseFloat(expenses.total),
      daily: dailyRevenue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reports Summary
app.get('/api/reports/summary', requireAdminOrAbove, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];
    
    const [revenue, expenses, jobsCompleted, newCustomers] = await Promise.all([
      queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) BETWEEN $1 AND $2', [start, end]),
      queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date BETWEEN $1 AND $2', [start, end]),
      queryOne('SELECT COUNT(*) as count FROM jobs WHERE DATE(completed_at) BETWEEN $1 AND $2', [start, end]),
      queryOne('SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) BETWEEN $1 AND $2', [start, end])
    ]);
    
    res.json({
      period: { start, end },
      revenue: parseFloat(revenue.total),
      expenses: parseFloat(expenses.total),
      profit: parseFloat(revenue.total) - parseFloat(expenses.total),
      jobsCompleted: parseInt(jobsCompleted.count),
      newCustomers: parseInt(newCustomers.count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Technician Performance Report
app.get('/api/reports/technician', requireAdminOrAbove, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];
    
    const technicianStats = await queryAll(`
      SELECT 
        technician,
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' OR status = 'invoiced' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(labor_hours) as total_hours,
        SUM(labor_cost) as total_labor_revenue,
        SUM(total_cost) as total_revenue,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400)::numeric, 1) as avg_completion_days
      FROM jobs
      WHERE technician IS NOT NULL AND technician != ''
        AND DATE(created_at) BETWEEN $1 AND $2
      GROUP BY technician
      ORDER BY total_revenue DESC
    `, [start, end]);
    
    res.json(technicianStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SERVICE REMINDERS
// ============================================

app.get('/api/service-reminders', async (req, res) => {
  try {
    const reminders = await queryAll(`
      SELECT r.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
      FROM service_reminders r
      JOIN vehicles v ON r.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      ORDER BY r.due_date ASC
    `);
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/service-reminders/due', async (req, res) => {
  try {
    const reminders = await queryAll(`
      SELECT r.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
      FROM service_reminders r
      JOIN vehicles v ON r.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      WHERE r.status = 'pending' AND r.due_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY r.due_date ASC
    `);
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/service-reminders', async (req, res) => {
  try {
    const { vehicle_id, reminder_type, due_mileage, due_date, description } = req.body;
    
    const vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (!vehicle) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    }
    
    const result = await query(
      'INSERT INTO service_reminders (vehicle_id, reminder_type, due_mileage, due_date, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [vehicle_id, reminder_type, due_mileage, due_date, description]
    );
    
    res.json({ id: result.rows[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/service-reminders/:id', async (req, res) => {
  try {
    const { status, notified_at } = req.body;
    const reminder = await queryOne('SELECT * FROM service_reminders WHERE id = $1', [req.params.id]);
    if (!reminder) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Reminder not found'));
    }
    
    await query(
      'UPDATE service_reminders SET status = $1, notified_at = $2 WHERE id = $3',
      [status || reminder.status, notified_at, req.params.id]
    );
    
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/service-reminders/:id', requireAdminOrAbove, async (req, res) => {
  try {
    await query('DELETE FROM service_reminders WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATIC FILES & SPA HANDLER
// ============================================

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.all('/api/*', (req, res) => {
  res.status(404).json(createError(ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
});

app.get('*', (req, res) => {
  if (fs.existsSync(path.join(publicPath, 'index.html'))) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Frontend not built'));
  }
});

// ============================================
// START SERVER
// ============================================

init().then(() => {
  app.listen(PORT, () => {
    console.log(`
🔧 Knight Auto Works Server (PostgreSQL) running!
📍 http://localhost:${PORT}
📊 API endpoints ready
✅ Health check: http://localhost:${PORT}/api/health
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
