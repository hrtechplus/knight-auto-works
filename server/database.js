import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'knight-auto.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Customers table
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Vehicles table
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    vin TEXT,
    color TEXT,
    engine_type TEXT,
    transmission TEXT,
    odometer INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  -- Suppliers table
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Inventory/Parts table
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    cost_price REAL DEFAULT 0,
    sell_price REAL DEFAULT 0,
    supplier_id INTEGER,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Jobs/Work Orders table
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_number TEXT UNIQUE NOT NULL,
    vehicle_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    description TEXT,
    diagnosis TEXT,
    technician TEXT,
    odometer_in INTEGER,
    estimated_completion DATETIME,
    labor_hours REAL DEFAULT 0,
    labor_rate REAL DEFAULT 1500,
    labor_cost REAL DEFAULT 0,
    parts_cost REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT
  );

  -- Job Items (Services performed)
  CREATE TABLE IF NOT EXISTS job_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total REAL DEFAULT 0,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  -- Job Parts (Parts used in job)
  CREATE TABLE IF NOT EXISTS job_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    inventory_id INTEGER,
    part_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total REAL DEFAULT 0,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
  );

  -- Stock movements for tracking
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
  );

  -- Invoices table
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    job_id INTEGER,
    customer_id INTEGER NOT NULL,
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    due_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- Payments table
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  -- Expenses table
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    reference TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert default settings
  INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('business_name', 'Knight Auto Works'),
    ('currency', 'LKR'),
    ('currency_symbol', 'Rs.'),
    ('tax_rate', '0'),
    ('labor_rate', '1500'),
    ('job_prefix', 'KAW'),
    ('invoice_prefix', 'INV');

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
  CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
  CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_number ON jobs(job_number);
  CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
  CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);

  -- Audit log table for tracking all changes
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Service reminders for vehicle maintenance scheduling
  CREATE TABLE IF NOT EXISTS service_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    reminder_type TEXT NOT NULL,
    due_mileage INTEGER,
    due_date DATE,
    description TEXT,
    status TEXT DEFAULT 'pending',
    notified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
  );

  -- Indexes for new tables
  CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
  CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON service_reminders(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_status ON service_reminders(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

  -- Users table for authentication
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`);

// Add warranty columns to jobs table if not exists
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN warranty_until DATE`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN warranty_notes TEXT`);
} catch (e) { /* Column already exists */ }

// Smart Pricing Migrations
try {
  db.exec(`ALTER TABLE vehicles ADD COLUMN category TEXT DEFAULT 'Asian'`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE job_items ADD COLUMN discount REAL DEFAULT 0`);
  db.exec(`ALTER TABLE job_items ADD COLUMN discount_type TEXT DEFAULT 'fixed'`); // 'fixed' or 'percent'
} catch (e) { /* Column already exists */ }

// Seed default category rates if not exist
const settings = db.prepare('SELECT key FROM settings').all().map(s => s.key);
if (!settings.includes('labor_rate_asian')) {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insert.run('labor_rate_asian', '1500');
  insert.run('labor_rate_european', '2500');
  insert.run('labor_rate_american', '2000');
  insert.run('labor_rate_indian', '1200');
}

// Create default super admin user if no users exist

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const defaultPassword = bcrypt.hashSync('gkr11388tm', 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `).run('hasindu@gmail.com', defaultPassword, 'Hasindu (Super Admin)', 'super_admin');
  console.log('✅ Super admin user created');
}

console.log('✅ Database initialized successfully at:', dbPath);

export default db;
