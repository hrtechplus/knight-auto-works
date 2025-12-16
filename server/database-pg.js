import pg from 'pg';
const { Pool } = pg;

// Connection string from environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create connection pool
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

// Helper function for queries
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${duration}ms - ${text.substring(0, 50)}...`);
    }
    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}

// Get single row
export async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Get all rows
export async function queryAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

// Transaction helper
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Initialize database schema
export async function initializeDatabase() {
  console.log('📦 Initializing PostgreSQL database...');
  
  await query(`
    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Vehicles table
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      plate_number TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      vin TEXT,
      color TEXT,
      engine_type TEXT,
      transmission TEXT,
      odometer INTEGER DEFAULT 0,
      category TEXT DEFAULT 'Asian',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Inventory/Parts table
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      cost_price NUMERIC(10,2) DEFAULT 0,
      sell_price NUMERIC(10,2) DEFAULT 0,
      supplier_id INTEGER REFERENCES suppliers(id),
      location TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Jobs/Work Orders table
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT UNIQUE NOT NULL,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      description TEXT,
      diagnosis TEXT,
      technician TEXT,
      odometer_in INTEGER,
      estimated_completion TIMESTAMP,
      labor_hours NUMERIC(10,2) DEFAULT 0,
      labor_rate NUMERIC(10,2) DEFAULT 1500,
      labor_cost NUMERIC(10,2) DEFAULT 0,
      parts_cost NUMERIC(10,2) DEFAULT 0,
      total_cost NUMERIC(10,2) DEFAULT 0,
      warranty_until DATE,
      warranty_notes TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    );

    -- Job Items (Services performed)
    CREATE TABLE IF NOT EXISTS job_items (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity NUMERIC(10,2) DEFAULT 1,
      unit_price NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      discount NUMERIC(10,2) DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed'
    );

    -- Job Parts (Parts used in job)
    CREATE TABLE IF NOT EXISTS job_parts (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      inventory_id INTEGER REFERENCES inventory(id),
      part_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0
    );

    -- Stock movements for tracking
    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL REFERENCES inventory(id),
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      job_id INTEGER REFERENCES jobs(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      subtotal NUMERIC(10,2) DEFAULT 0,
      tax_rate NUMERIC(5,2) DEFAULT 0,
      tax_amount NUMERIC(10,2) DEFAULT 0,
      discount NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      amount_paid NUMERIC(10,2) DEFAULT 0,
      balance NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      due_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    );

    -- Payments table
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      amount NUMERIC(10,2) NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT,
      amount NUMERIC(10,2) NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference TEXT,
      expense_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit log table
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_data JSONB,
      new_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Service reminders
    CREATE TABLE IF NOT EXISTS service_reminders (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL,
      due_mileage INTEGER,
      due_date DATE,
      description TEXT,
      status TEXT DEFAULT 'pending',
      notified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Users table for authentication
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    );
  `);

  // Insert default settings if not exist
  await query(`
    INSERT INTO settings (key, value) VALUES
      ('business_name', 'Knight Auto Works'),
      ('currency', 'LKR'),
      ('currency_symbol', 'Rs.'),
      ('tax_rate', '0'),
      ('labor_rate', '1500'),
      ('job_prefix', 'KAW'),
      ('invoice_prefix', 'INV'),
      ('labor_rate_asian', '1500'),
      ('labor_rate_european', '2500'),
      ('labor_rate_american', '2000'),
      ('labor_rate_indian', '1200')
    ON CONFLICT (key) DO NOTHING
  `);

  // Create default admin user if not exists
  const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.count) === 0) {
    const bcrypt = await import('bcryptjs');
    const defaultPassword = bcrypt.default.hashSync('admin123', 10);
    await query(
      'INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4)',
      ['admin', defaultPassword, 'Administrator', 'admin']
    );
    console.log('✅ Default admin user created (username: admin, password: admin123)');
  }

  console.log('✅ PostgreSQL database initialized successfully');
}

// Create indexes for performance
export async function createIndexes() {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
    CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_number ON jobs(job_number);
    CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
    CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON service_reminders(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
}

export default { query, queryOne, queryAll, transaction, initializeDatabase, createIndexes, pool };
