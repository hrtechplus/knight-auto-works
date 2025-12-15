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
    const user = await queryOne('SELECT id, username, name, role FROM users WHERE id = $1', [decoded.userId]);
    if (!user) {
      return res.status(401).json(createError(ErrorCodes.UNAUTHORIZED, 'Invalid token'));
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

app.put('/api/settings', async (req, res) => {
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

app.delete('/api/customers/:id', async (req, res) => {
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

app.delete('/api/vehicles/:id', async (req, res) => {
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

app.delete('/api/jobs/:id', async (req, res) => {
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

app.delete('/api/inventory/:id', async (req, res) => {
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

app.delete('/api/expenses/:id', async (req, res) => {
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

app.get('/api/reports/revenue', async (req, res) => {
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
