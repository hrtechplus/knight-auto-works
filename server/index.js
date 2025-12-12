import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import db from './database.js';
import { 
  ErrorCodes, createError, validate, schemas, 
  canTransitionJobStatus 
} from './validation.js';
import { authMiddleware, setupPublicAuthRoutes, setupProtectedAuthRoutes, requireRole } from './auth.js';
import { auditLog } from './audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Limit each IP to 300 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}));
app.use(express.json());

// Request logging middleware
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

// Setup PUBLIC auth routes FIRST (login only) - before middleware
setupPublicAuthRoutes(app);

// Health check (Public)
app.get('/api/health', (req, res) => {
  try {
    // Check database connection
    const dbCheck = db.prepare('SELECT 1 as ok').get();
    const stats = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbCheck?.ok === 1 ? 'connected' : 'error',
      memory: process.memoryUsage(),
      version: '1.0.0'
    };
    res.json(stats);
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});

// Authentication middleware (applied to all /api routes except login and health)
app.use('/api', authMiddleware);

// Setup PROTECTED auth routes (me, password, users) - after middleware
setupProtectedAuthRoutes(app);

// ============================================
// AUDIT LOGGING
// ============================================

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateJobNumber() {
  const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('job_prefix');
  const prefix = settings?.value || 'KAW';
  const year = new Date().getFullYear();
  const lastJob = db.prepare(`
    SELECT job_number FROM jobs 
    WHERE job_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}-${year}-%`);
  
  let nextNum = 1;
  if (lastJob) {
    const parts = lastJob.job_number.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }
  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

function generateInvoiceNumber() {
  const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_prefix');
  const prefix = settings?.value || 'INV';
  const year = new Date().getFullYear();
  const lastInv = db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}-${year}-%`);
  
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

app.get('/api/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = {
      jobsToday: db.prepare(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE DATE(created_at) = DATE('now', 'localtime')
      `).get().count,
      
      jobsInProgress: db.prepare(`
        SELECT COUNT(*) as count FROM jobs WHERE status = 'in_progress'
      `).get().count,
      
      jobsPending: db.prepare(`
        SELECT COUNT(*) as count FROM jobs WHERE status = 'pending'
      `).get().count,
      
      jobsCompleted: db.prepare(`
        SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'
      `).get().count,
      
      totalCustomers: db.prepare(`SELECT COUNT(*) as count FROM customers`).get().count,
      
      totalVehicles: db.prepare(`SELECT COUNT(*) as count FROM vehicles`).get().count,
      
      lowStockItems: db.prepare(`
        SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_stock
      `).get().count,
      
      revenueToday: db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments 
        WHERE DATE(created_at) = DATE('now', 'localtime')
      `).get().total,
      
      revenueThisMonth: db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments 
        WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
      `).get().total,
      
      unpaidInvoices: db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(balance), 0) as total 
        FROM invoices WHERE status != 'paid'
      `).get(),
    };
    
    const recentJobs = db.prepare(`
      SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name
      FROM jobs j
      JOIN vehicles v ON j.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      ORDER BY j.created_at DESC LIMIT 5
    `).all();
    
    const recentPayments = db.prepare(`
      SELECT p.*, i.invoice_number, c.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      ORDER BY p.created_at DESC LIMIT 5
    `).all();
    
    res.json({ stats, recentJobs, recentPayments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SETTINGS ROUTES
// ============================================

app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json(settingsObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', requireRole('admin'), (req, res) => {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const transaction = db.transaction((settings) => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value);
      }
    });
    transaction(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER ROUTES
// ============================================

app.get('/api/customers', (req, res) => {
  try {
    const { search } = req.query;
    let customers;
    if (search) {
      customers = db.prepare(`
        SELECT c.*, COUNT(v.id) as vehicle_count
        FROM customers c
        LEFT JOIN vehicles v ON c.id = v.customer_id
        WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
        GROUP BY c.id
        ORDER BY c.name
      `).all(`%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      customers = db.prepare(`
        SELECT c.*, COUNT(v.id) as vehicle_count
        FROM customers c
        LEFT JOIN vehicles v ON c.id = v.customer_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `).all();
    }
    res.json(customers);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.get('/api/customers/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    }
    
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ?').all(req.params.id);
    const invoices = db.prepare(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC
    `).all(req.params.id);
    
    res.json({ ...customer, vehicles, invoices });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.post('/api/customers', (req, res) => {
  try {
    // Validate input
    const errors = validate(req.body, schemas.customer);
    if (errors) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    }
    
    const { name, phone, email, address, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO customers (name, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, phone, email, address, notes);
    
    const newCustomer = { id: result.lastInsertRowid, ...req.body };
    auditLog('customers', result.lastInsertRowid, 'create', null, newCustomer);
    res.json(newCustomer);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    // Validate input
    const errors = validate(req.body, schemas.customer);
    if (errors) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    }
    
    const oldCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!oldCustomer) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    }
    
    const { name, phone, email, address, notes } = req.body;
    db.prepare(`
      UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, email, address, notes, req.params.id);
    
    const updatedCustomer = { id: req.params.id, ...req.body };
    auditLog('customers', req.params.id, 'update', oldCustomer, updatedCustomer);
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    }
    
    // Check for open jobs (not completed/cancelled/invoiced)
    const openJobs = db.prepare(`
      SELECT COUNT(*) as count FROM jobs j
      JOIN vehicles v ON j.vehicle_id = v.id
      WHERE v.customer_id = ? AND j.status NOT IN ('completed', 'cancelled', 'invoiced')
    `).get(req.params.id);
    
    if (openJobs.count > 0) {
      return res.status(400).json(createError(
        ErrorCodes.BUSINESS_RULE, 
        `Cannot delete customer with ${openJobs.count} open job(s). Complete or cancel jobs first.`
      ));
    }
    
    // Check for unpaid invoices
    const unpaidInvoices = db.prepare(`
      SELECT COUNT(*) as count FROM invoices
      WHERE customer_id = ? AND status != 'paid'
    `).get(req.params.id);
    
    if (unpaidInvoices.count > 0) {
      return res.status(400).json(createError(
        ErrorCodes.BUSINESS_RULE, 
        `Cannot delete customer with ${unpaidInvoices.count} unpaid invoice(s). Collect payments first.`
      ));
    }
    
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    auditLog('customers', req.params.id, 'delete', customer, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// VEHICLE ROUTES
// ============================================

app.get('/api/vehicles', (req, res) => {
  try {
    const { search, customer_id } = req.query;
    let query = `
      SELECT v.*, c.name as customer_name, c.phone as customer_phone
      FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
    `;
    const params = [];
    
    if (customer_id) {
      query += ' WHERE v.customer_id = ?';
      params.push(customer_id);
    } else if (search) {
      query += ` WHERE v.plate_number LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR c.name LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY v.created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.get('/api/vehicles/:id', (req, res) => {
  try {
    const vehicle = db.prepare(`
      SELECT v.*, c.name as customer_name, c.phone as customer_phone
      FROM vehicles v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ?
    `).get(req.params.id);
    if (!vehicle) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    }
    
    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE vehicle_id = ? ORDER BY created_at DESC
    `).all(req.params.id);
    
    // Get service reminders
    const reminders = db.prepare(`
      SELECT * FROM service_reminders WHERE vehicle_id = ? ORDER BY due_date ASC
    `).all(req.params.id);
    
    res.json({ ...vehicle, jobs, reminders });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.post('/api/vehicles', (req, res) => {
  try {
    // Validate input
    const errors = validate(req.body, schemas.vehicle);
    if (errors) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    }
    
    const { customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, notes } = req.body;
    
    // Check customer exists
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Customer not found'));
    }
    
    const result = db.prepare(`
      INSERT INTO vehicles (customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer || 0, notes);
    
    const newVehicle = { id: result.lastInsertRowid, ...req.body };
    auditLog('vehicles', result.lastInsertRowid, 'create', null, newVehicle);
    res.json(newVehicle);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json(createError(ErrorCodes.CONFLICT, 'A vehicle with this plate number already exists'));
    } else {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
});

app.put('/api/vehicles/:id', (req, res) => {
  try {
    // Validate input
    const errors = validate(req.body, schemas.vehicle);
    if (errors) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    }
    
    const oldVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!oldVehicle) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    }
    
    const { customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, notes } = req.body;
    db.prepare(`
      UPDATE vehicles SET customer_id = ?, plate_number = ?, make = ?, model = ?, year = ?, vin = ?, color = ?, 
      engine_type = ?, transmission = ?, odometer = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(customer_id, plate_number, make, model, year, vin, color, engine_type, transmission, odometer, notes, req.params.id);
    
    const updatedVehicle = { id: req.params.id, ...req.body };
    auditLog('vehicles', req.params.id, 'update', oldVehicle, updatedVehicle);
    res.json(updatedVehicle);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json(createError(ErrorCodes.CONFLICT, 'A vehicle with this plate number already exists'));
    } else {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
});

app.delete('/api/vehicles/:id', (req, res) => {
  try {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    }
    
    // Check for open jobs
    const openJobs = db.prepare(`
      SELECT COUNT(*) as count FROM jobs 
      WHERE vehicle_id = ? AND status NOT IN ('completed', 'cancelled', 'invoiced')
    `).get(req.params.id);
    
    if (openJobs.count > 0) {
      return res.status(400).json(createError(
        ErrorCodes.BUSINESS_RULE, 
        `Cannot delete vehicle with ${openJobs.count} open job(s). Complete or cancel jobs first.`
      ));
    }
    
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    auditLog('vehicles', req.params.id, 'delete', vehicle, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// JOB ROUTES
// ============================================

app.get('/api/jobs', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT j.*, v.plate_number, v.make, v.model, c.name as customer_name, c.phone as customer_phone
      FROM jobs j
      JOIN vehicles v ON j.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
    `;
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('j.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push(`(j.job_number LIKE ? OR v.plate_number LIKE ? OR c.name LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY j.created_at DESC';
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = db.prepare(`
      SELECT j.*, v.plate_number, v.make, v.model, v.year, v.color, v.odometer as vehicle_odometer, v.category as vehicle_category,
             c.id as customer_id, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM jobs j
      JOIN vehicles v ON j.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      WHERE j.id = ?
    `).get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const items = db.prepare('SELECT * FROM job_items WHERE job_id = ?').all(req.params.id);
    const parts = db.prepare('SELECT * FROM job_parts WHERE job_id = ?').all(req.params.id);
    const invoice = db.prepare('SELECT * FROM invoices WHERE job_id = ?').get(req.params.id);
    
    res.json({ ...job, items, parts, invoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs', (req, res) => {
  try {
    const { vehicle_id, description, priority, technician, odometer_in, estimated_completion } = req.body;
    const job_number = generateJobNumber();
    
    const result = db.prepare(`
      INSERT INTO jobs (job_number, vehicle_id, description, priority, technician, odometer_in, estimated_completion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(job_number, vehicle_id, description, priority || 'normal', technician, odometer_in, estimated_completion);
    
    res.json({ id: result.lastInsertRowid, job_number, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/jobs/:id', (req, res) => {
  try {
    const { status, description, priority, technician, diagnosis, labor_hours, labor_rate, notes } = req.body;
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const labor_cost = (labor_hours || 0) * (labor_rate || job.labor_rate);
    const parts_cost = db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = ?').get(req.params.id).total;
    const total_cost = labor_cost + parts_cost;
    
    let started_at = job.started_at;
    let completed_at = job.completed_at;
    
    if (status === 'in_progress' && !job.started_at) {
      started_at = new Date().toISOString();
    }
    if (status === 'completed' && !job.completed_at) {
      completed_at = new Date().toISOString();
    }
    
    db.prepare(`
      UPDATE jobs SET status = ?, description = ?, priority = ?, technician = ?, diagnosis = ?,
      labor_hours = ?, labor_rate = ?, labor_cost = ?, parts_cost = ?, total_cost = ?,
      notes = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `).run(status || job.status, description, priority, technician, diagnosis, labor_hours, labor_rate, 
           labor_cost, parts_cost, total_cost, notes, started_at, completed_at, req.params.id);
    
    res.json({ id: req.params.id, ...req.body, labor_cost, parts_cost, total_cost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job Items (Services)
app.post('/api/jobs/:id/items', (req, res) => {
  try {
    const errors = validate(req.body, schemas.jobItem);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));

    const { description, quantity, unit_price, discount, discount_type } = req.body;
    
    // Calculate total: (Qty * Rate) - Discount
    let subtotal = (quantity || 1) * (unit_price || 0);
    let discountAmount = 0;
    
    if (discount && discount > 0) {
      if (discount_type === 'percent') {
        discountAmount = subtotal * (discount / 100);
      } else {
        discountAmount = discount;
      }
    }
    
    const total = Math.max(0, subtotal - discountAmount);
    
    const result = db.prepare(`
      INSERT INTO job_items (job_id, description, quantity, unit_price, total, discount, discount_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, description, quantity || 1, unit_price || 0, total, discount || 0, discount_type || 'fixed');
    
    res.json({ id: result.lastInsertRowid, ...req.body, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:jobId/items/:itemId', (req, res) => {
  try {
    db.prepare('DELETE FROM job_items WHERE id = ? AND job_id = ?').run(req.params.itemId, req.params.jobId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job Parts
app.post('/api/jobs/:id/parts', (req, res) => {
  try {
    const errors = validate(req.body, schemas.jobPart);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));

    const result = db.transaction(() => {
      const { inventory_id, part_name, quantity, unit_price } = req.body;
      const total = (quantity || 1) * (unit_price || 0);
      
      const insertResult = db.prepare(`
        INSERT INTO job_parts (job_id, inventory_id, part_name, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.params.id, inventory_id, part_name, quantity || 1, unit_price || 0, total);
      
      // If from inventory, update stock
      if (inventory_id) {
        db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE id = ?').run(quantity || 1, inventory_id);
        
        db.prepare(`
          INSERT INTO stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes)
          VALUES (?, 'out', ?, 'job', ?, ?)
        `).run(inventory_id, quantity || 1, req.params.id, `Used in Job #${req.params.id}`);
      }
      
      // Update job parts cost
      const parts_cost = db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = ?').get(req.params.id).total;
      const job = db.prepare('SELECT labor_cost FROM jobs WHERE id = ?').get(req.params.id);
      const total_cost = (job?.labor_cost || 0) + parts_cost;
      db.prepare('UPDATE jobs SET parts_cost = ?, total_cost = ? WHERE id = ?').run(parts_cost, total_cost, req.params.id);
      
      return { id: insertResult.lastInsertRowid, ...req.body, total };
    })();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:jobId/parts/:partId', (req, res) => {
  try {
    const part = db.prepare('SELECT * FROM job_parts WHERE id = ? AND job_id = ?').get(req.params.partId, req.params.jobId);
    if (part && part.inventory_id) {
      // Return to inventory
      db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(part.quantity, part.inventory_id);
      db.prepare(`
        INSERT INTO stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, notes)
        VALUES (?, 'in', ?, 'job', ?, 'Returned from job')
      `).run(part.inventory_id, part.quantity, req.params.jobId);
    }
    db.prepare('DELETE FROM job_parts WHERE id = ? AND job_id = ?').run(req.params.partId, req.params.jobId);
    
    // Update job parts cost
    const parts_cost = db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM job_parts WHERE job_id = ?').get(req.params.jobId).total;
    const job = db.prepare('SELECT labor_cost FROM jobs WHERE id = ?').get(req.params.jobId);
    const total_cost = (job?.labor_cost || 0) + parts_cost;
    db.prepare('UPDATE jobs SET parts_cost = ?, total_cost = ? WHERE id = ?').run(parts_cost, total_cost, req.params.jobId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVENTORY ROUTES
// ============================================

app.get('/api/inventory', (req, res) => {
  try {
    const { search, category, low_stock } = req.query;
    let query = `
      SELECT i.*, s.name as supplier_name
      FROM inventory i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
    `;
    const conditions = [];
    const params = [];
    
    if (search) {
      conditions.push(`(i.name LIKE ? OR i.sku LIKE ? OR i.description LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }
    if (low_stock === 'true') {
      conditions.push('i.quantity <= i.min_stock');
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY i.name';
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category != '' ORDER BY category
    `).all();
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/:id', (req, res) => {
  try {
    const item = db.prepare(`
      SELECT i.*, s.name as supplier_name
      FROM inventory i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const movements = db.prepare(`
      SELECT * FROM stock_movements WHERE inventory_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);
    
    res.json({ ...item, movements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const errors = validate(req.body, schemas.inventory);
    if (errors) return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));

    const result = db.transaction(() => {
      const { sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location } = req.body;
      const insertResult = db.prepare(`
        INSERT INTO inventory (sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sku, name, description, category, quantity || 0, min_stock || 5, cost_price || 0, sell_price || 0, supplier_id, location);
      
      if (quantity > 0) {
        db.prepare(`
          INSERT INTO stock_movements (inventory_id, movement_type, quantity, notes)
          VALUES (?, 'in', ?, 'Initial stock')
        `).run(insertResult.lastInsertRowid, quantity);
      }
      return { id: insertResult.lastInsertRowid, ...req.body };
    })();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:id', (req, res) => {
  try {
    const { sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location } = req.body;
    const current = db.prepare('SELECT quantity FROM inventory WHERE id = ?').get(req.params.id);
    
    db.prepare(`
      UPDATE inventory SET sku = ?, name = ?, description = ?, category = ?, quantity = ?, 
      min_stock = ?, cost_price = ?, sell_price = ?, supplier_id = ?, location = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sku, name, description, category, quantity, min_stock, cost_price, sell_price, supplier_id, location, req.params.id);
    
    // Record stock adjustment if quantity changed
    if (current && quantity !== current.quantity) {
      const diff = quantity - current.quantity;
      db.prepare(`
        INSERT INTO stock_movements (inventory_id, movement_type, quantity, notes)
        VALUES (?, ?, ?, 'Manual adjustment')
      `).run(req.params.id, diff > 0 ? 'in' : 'out', Math.abs(diff));
    }
    
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inventory/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock adjustment
app.post('/api/inventory/:id/adjust', (req, res) => {
  try {
    const { quantity, type, notes } = req.body;
    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const newQty = type === 'in' ? item.quantity + quantity : item.quantity - quantity;
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, req.params.id);
    
    db.prepare(`
      INSERT INTO stock_movements (inventory_id, movement_type, quantity, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, type, quantity, notes);
    
    res.json({ ...item, quantity: newQty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUPPLIER ROUTES
// ============================================

app.get('/api/suppliers', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suppliers', (req, res) => {
  try {
    const { name, contact_person, phone, email, address, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, contact_person, phone, email, address, notes);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/suppliers/:id', (req, res) => {
  try {
    const { name, contact_person, phone, email, address, notes } = req.body;
    db.prepare(`
      UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, notes = ?
      WHERE id = ?
    `).run(name, contact_person, phone, email, address, notes, req.params.id);
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVOICE ROUTES
// ============================================

app.get('/api/invoices', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT i.*, c.name as customer_name, j.job_number
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
    `;
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push(`(i.invoice_number LIKE ? OR c.name LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY i.created_at DESC';
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address,
             j.job_number, j.description as job_description
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ?
    `).get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at').all(req.params.id);
    
    let items = [];
    let parts = [];
    if (invoice.job_id) {
      items = db.prepare('SELECT * FROM job_items WHERE job_id = ?').all(invoice.job_id);
      parts = db.prepare('SELECT * FROM job_parts WHERE job_id = ?').all(invoice.job_id);
    }
    
    res.json({ ...invoice, payments, items, parts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', (req, res) => {
  try {
    const { job_id, customer_id, subtotal, tax_rate, discount, due_date, notes } = req.body;
    const invoice_number = generateInvoiceNumber();
    const tax_amount = (subtotal || 0) * ((tax_rate || 0) / 100);
    const total = (subtotal || 0) + tax_amount - (discount || 0);
    
    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, job_id, customer_id, subtotal, tax_rate, tax_amount, discount, total, balance, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoice_number, job_id, customer_id, subtotal || 0, tax_rate || 0, tax_amount, discount || 0, total, total, due_date, notes);
    
    // Update job status to invoiced
    if (job_id) {
      db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('invoiced', job_id);
    }
    
    res.json({ id: result.lastInsertRowid, invoice_number, total, balance: total, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices/from-job/:jobId', (req, res) => {
  try {
    const result = db.transaction(() => {
      const job = db.prepare(`
        SELECT j.*, v.customer_id FROM jobs j
        JOIN vehicles v ON j.vehicle_id = v.id
        WHERE j.id = ?
      `).get(req.params.jobId);
      if (!job) throw new Error('Job not found');
      
      const taxRate = db.prepare('SELECT value FROM settings WHERE key = ?').get('tax_rate')?.value || 0;
      const subtotal = job.total_cost;
      const tax_amount = subtotal * (parseFloat(taxRate) / 100);
      const total = subtotal + tax_amount;
      const invoice_number = generateInvoiceNumber();
      
      const insertResult = db.prepare(`
        INSERT INTO invoices (invoice_number, job_id, customer_id, subtotal, tax_rate, tax_amount, total, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_number, job.id, job.customer_id, subtotal, parseFloat(taxRate), tax_amount, total, total);
      
      db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('invoiced', job.id);
      
      return { id: insertResult.lastInsertRowid, invoice_number, subtotal, total, balance: total };
    })();
    
    res.json(result);
  } catch (error) {
    const status = error.message === 'Job not found' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PDF Invoice Generation - Professional Design with Logo
app.get('/api/invoices/:id/pdf', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, 
             c.email as customer_email, c.address as customer_address,
             j.job_number, j.description as job_description,
             v.plate_number, v.make, v.model
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      WHERE i.id = ?
    `).get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }
    
    // Get job items and parts if linked to a job
    let items = [];
    let parts = [];
    if (invoice.job_id) {
      items = db.prepare('SELECT * FROM job_items WHERE job_id = ?').all(invoice.job_id);
      parts = db.prepare('SELECT * FROM job_parts WHERE job_id = ?').all(invoice.job_id);
    }
    
    // Get settings
    const settings = db.prepare('SELECT * FROM settings').all();
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
    
    const tableTop = 310;
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
    // const lightGray = '#f9fafb'; // Already defined above
    
    // Job Items
    items.forEach(item => {
      const rowHeight = 24; 
      if (itemIndex % 2 === 0) {
        doc.rect(tableLeft, yPos, tableRight - tableLeft, rowHeight).fill('#f9fafb');
      }
      
      doc.font('Helvetica').fontSize(9).fillColor(darkColor);
      
      // Description with Discount text if applicable
      let desc = item.description;
      if (item.discount > 0) {
        const discountText = item.discount_type === 'percent' 
          ? `(${item.discount}% off)` 
          : `(-${currencySymbol}${item.discount})`;
        doc.text(desc, colDesc + 10, yPos + 5, { width: 260, continued: true });
        doc.fillColor('green').fontSize(8).text(` ${discountText}`);
        doc.fillColor(darkColor).fontSize(9); // Reset
      } else {
        doc.text(desc, colDesc + 10, yPos + 5, { width: 260 });
      }

      doc.text(item.quantity.toString(), colQty, yPos + 5, { width: 50, align: 'center' });
      doc.text(`${currencySymbol}${item.unit_price.toFixed(2)}`, colRate, yPos + 5, { width: 60, align: 'right' });
      doc.text(`${currencySymbol}${item.total.toFixed(2)}`, colTotal, yPos + 5, { width: 80, align: 'right' });
      
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
    // const lightGray = '#f9fafb';

    parts.forEach(part => {
      const rowHeight = 20;
      if (rowIndex % 2 === 0) {
        doc.rect(tableLeft, yPos, tableRight - tableLeft, rowHeight).fill(lightGray);
      }
      
      doc.font('Helvetica').fontSize(9).fillColor(darkColor);
      doc.text(part.part_name, colDesc + 10, yPos + 5, { width: 260 });
      doc.text(part.quantity.toString(), colQty, yPos + 5, { width: 50, align: 'center' });
      doc.text(`${currencySymbol}${part.unit_price.toFixed(2)}`, colRate, yPos + 5, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').text(`${currencySymbol}${part.total.toFixed(2)}`, colTotal, yPos + 5, { width: 55, align: 'right' });
      
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
    doc.fillColor(darkColor).text(`${currencySymbol}${invoice.subtotal.toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    yPos += 16;
    
    // Tax
    if (invoice.tax_amount > 0) {
      doc.fillColor(grayColor).text(`Tax (${invoice.tax_rate}%):`, totalsX, yPos);
      doc.fillColor(darkColor).text(`${currencySymbol}${invoice.tax_amount.toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
      yPos += 16;
    }
    
    // Discount
    if (invoice.discount > 0) {
      doc.fillColor(grayColor).text('Discount:', totalsX, yPos);
      doc.fillColor('#22c55e').text(`-${currencySymbol}${invoice.discount.toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
      yPos += 16;
    }
    
    // Total box
    doc.rect(totalsX - 10, yPos, 180, 25).fill(primaryColor);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('white');
    doc.text('TOTAL:', totalsX, yPos + 6);
    doc.text(`${currencySymbol}${invoice.total.toFixed(2)}`, totalsValueX - 10, yPos + 6, { width: 75, align: 'right' });
    yPos += 35;
    
    // Payment info
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text('Amount Paid:', totalsX, yPos);
    doc.fillColor('#22c55e').text(`${currencySymbol}${invoice.amount_paid.toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    yPos += 16;
    
    doc.fillColor(grayColor).text('Balance Due:', totalsX, yPos);
    const balanceColor = invoice.balance > 0 ? '#ef4444' : '#22c55e';
    doc.font('Helvetica-Bold').fillColor(balanceColor);
    doc.text(`${currencySymbol}${invoice.balance.toFixed(2)}`, totalsValueX, yPos, { width: 55, align: 'right' });
    
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
// NOTIFICATION ROUTES
// ============================================

import { sendEmail } from './email.js';

app.post('/api/notifications/email', authMiddleware, async (req, res) => {
  try {
    const { to, type, data } = req.body;
    
    // Log the attempt
    console.log(`📧 Sending ${type} email to ${to}`);
    
    const result = await sendEmail({ to, type, data });
    
    // In dev mode, return the preview URL
    res.json({ 
      success: true, 
      message: 'Email sent successfully', 
      previewUrl: result.previewUrl 
    });
    
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, `Failed to send email: ${error.message}`));
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

app.post('/api/invoices/:id/payments', (req, res) => {
  try {
    const { amount, payment_method, reference, notes } = req.body;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    const result = db.prepare(`
      INSERT INTO payments (invoice_id, amount, payment_method, reference, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, amount, payment_method || 'cash', reference, notes);
    
    const newAmountPaid = invoice.amount_paid + amount;
    const newBalance = invoice.total - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';
    
    db.prepare(`
      UPDATE invoices SET amount_paid = ?, balance = ?, status = ?, paid_at = ?
      WHERE id = ?
    `).run(newAmountPaid, newBalance, newStatus, newStatus === 'paid' ? new Date().toISOString() : null, req.params.id);
    
    res.json({ id: result.lastInsertRowid, ...req.body, new_balance: newBalance, status: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXPENSE ROUTES
// ============================================

app.get('/api/expenses', (req, res) => {
  try {
    const { category, start_date, end_date } = req.query;
    let query = 'SELECT * FROM expenses';
    const conditions = [];
    const params = [];
    
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (start_date) {
      conditions.push('expense_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('expense_date <= ?');
      params.push(end_date);
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY expense_date DESC, created_at DESC';
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/expenses/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category FROM expenses ORDER BY category
    `).all();
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const { category, description, amount, payment_method, reference, expense_date } = req.body;
    const result = db.prepare(`
      INSERT INTO expenses (category, description, amount, payment_method, reference, expense_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(category, description, amount, payment_method || 'cash', reference, expense_date || new Date().toISOString().split('T')[0]);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REPORTS ROUTES
// ============================================

app.get('/api/reports/revenue', requireRole('admin'), (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly
    let groupBy, dateFormat;
    
    switch (period) {
      case 'daily':
        groupBy = "DATE(created_at)";
        dateFormat = "%Y-%m-%d";
        break;
      case 'weekly':
        groupBy = "strftime('%Y-%W', created_at)";
        dateFormat = "%Y-W%W";
        break;
      default:
        groupBy = "strftime('%Y-%m', created_at)";
        dateFormat = "%Y-%m";
    }
    
    const revenue = db.prepare(`
      SELECT ${groupBy} as period, SUM(amount) as total
      FROM payments
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 12
    `).all();
    
    res.json(revenue.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/summary', requireRole('admin'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];
    
    const revenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE DATE(created_at) BETWEEN ? AND ?
    `).get(start, end).total;
    
    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
      WHERE expense_date BETWEEN ? AND ?
    `).get(start, end).total;
    
    const jobsCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM jobs
      WHERE DATE(completed_at) BETWEEN ? AND ?
    `).get(start, end).count;
    
    const newCustomers = db.prepare(`
      SELECT COUNT(*) as count FROM customers
      WHERE DATE(created_at) BETWEEN ? AND ?
    `).get(start, end).count;
    
    res.json({
      period: { start, end },
      revenue,
      expenses,
      profit: revenue - expenses,
      jobsCompleted,
      newCustomers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYSTEM & HEALTH ROUTES
// ============================================



app.post('/api/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    const backupPath = path.join(backupDir, `knight-auto-backup-${timestamp}.db`);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Use SQLite backup API
    db.backup(backupPath);
    
    res.json({ 
      success: true, 
      message: 'Backup created successfully',
      path: backupPath,
      timestamp 
    });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, 'Backup failed', error.message));
  }
});

// ============================================
// OVERDUE INVOICES
// ============================================

app.get('/api/invoices/overdue', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = db.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             julianday('now') - julianday(i.due_date) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status != 'paid' AND i.due_date < ?
      ORDER BY i.due_date ASC
    `).all(today);
    
    res.json(overdueInvoices);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// SERVICE REMINDERS
// ============================================

app.get('/api/service-reminders', (req, res) => {
  try {
    const { status, vehicle_id } = req.query;
    let query = `
      SELECT sr.*, v.plate_number, v.make, v.model, v.odometer as current_odometer,
             c.name as customer_name, c.phone as customer_phone
      FROM service_reminders sr
      JOIN vehicles v ON sr.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
    `;
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('sr.status = ?');
      params.push(status);
    }
    if (vehicle_id) {
      conditions.push('sr.vehicle_id = ?');
      params.push(vehicle_id);
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sr.due_date ASC, sr.due_mileage ASC';
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.get('/api/service-reminders/due', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dueReminders = db.prepare(`
      SELECT sr.*, v.plate_number, v.make, v.model, v.odometer as current_odometer,
             c.name as customer_name, c.phone as customer_phone
      FROM service_reminders sr
      JOIN vehicles v ON sr.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      WHERE sr.status = 'pending' 
        AND (sr.due_date <= ? OR v.odometer >= sr.due_mileage)
      ORDER BY sr.due_date ASC
    `).all(today);
    
    res.json(dueReminders);
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.post('/api/service-reminders', (req, res) => {
  try {
    const errors = validate(req.body, schemas.serviceReminder);
    if (errors) {
      return res.status(400).json(createError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors));
    }
    
    const { vehicle_id, reminder_type, due_mileage, due_date, description } = req.body;
    
    // Check vehicle exists
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicle_id);
    if (!vehicle) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Vehicle not found'));
    }
    
    const result = db.prepare(`
      INSERT INTO service_reminders (vehicle_id, reminder_type, due_mileage, due_date, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(vehicle_id, reminder_type, due_mileage, due_date, description);
    
    auditLog('service_reminders', result.lastInsertRowid, 'create', null, req.body);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.put('/api/service-reminders/:id', (req, res) => {
  try {
    const { status, notified_at } = req.body;
    const reminder = db.prepare('SELECT * FROM service_reminders WHERE id = ?').get(req.params.id);
    if (!reminder) {
      return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'Reminder not found'));
    }
    
    db.prepare(`
      UPDATE service_reminders SET status = ?, notified_at = ? WHERE id = ?
    `).run(status || reminder.status, notified_at, req.params.id);
    
    auditLog('service_reminders', req.params.id, 'update', reminder, req.body);
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

app.delete('/api/service-reminders/:id', (req, res) => {
  try {
    const reminder = db.prepare('SELECT * FROM service_reminders WHERE id = ?').get(req.params.id);
    if (reminder) {
      db.prepare('DELETE FROM service_reminders WHERE id = ?').run(req.params.id);
      auditLog('service_reminders', req.params.id, 'delete', reminder, null);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// TECHNICIAN PERFORMANCE REPORT
// ============================================

app.get('/api/reports/technician', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];
    
    const technicianStats = db.prepare(`
      SELECT 
        technician,
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' OR status = 'invoiced' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(labor_hours) as total_hours,
        SUM(labor_cost) as total_labor_revenue,
        SUM(total_cost) as total_revenue,
        ROUND(AVG(julianday(completed_at) - julianday(created_at)), 1) as avg_completion_days
      FROM jobs
      WHERE technician IS NOT NULL AND technician != ''
        AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY technician
      ORDER BY total_revenue DESC
    `).all(start, end);
    
    res.json({
      period: { start, end },
      technicians: technicianStats
    });
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// AUDIT LOG (Read-only)
// ============================================

app.get('/api/audit-log', (req, res) => {
  try {
    const { table_name, record_id, limit = 100 } = req.query;
    let query = 'SELECT * FROM audit_log';
    const conditions = [];
    const params = [];
    
    if (table_name) {
      conditions.push('table_name = ?');
      params.push(table_name);
    }
    if (record_id) {
      conditions.push('record_id = ?');
      params.push(record_id);
    }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    res.json(db.prepare(query).all(...params));
  } catch (error) {
    res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
  }
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json(createError(
    ErrorCodes.INTERNAL_ERROR, 
    'An unexpected error occurred',
    process.env.NODE_ENV === 'development' ? err.message : undefined
  ));
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json(createError(ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
});

// ============================================
// START SERVER
// ============================================

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message
    }
  });
});

app.listen(PORT, () => {
  console.log(`
🔧 Knight Auto Works Server running!
📍 http://localhost:${PORT}
📊 API endpoints ready
✅ Health check: http://localhost:${PORT}/api/health
  `);
});
