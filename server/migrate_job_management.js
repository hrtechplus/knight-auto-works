// Migration script to add new columns for job management fixes
// Run this once on existing databases

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('🔄 Running migration for job management fixes...');
  
  const client = await pool.connect();
  
  try {
    // Add fuel_charge and cleaning_charge to jobs table
    console.log('Adding fuel_charge to jobs...');
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fuel_charge NUMERIC(10,2) DEFAULT 0
    `);
    
    console.log('Adding cleaning_charge to jobs...');
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cleaning_charge NUMERIC(10,2) DEFAULT 0
    `);
    
    // Add discount, discount_type, cost_price to job_parts table
    console.log('Adding discount to job_parts...');
    await client.query(`
      ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0
    `);
    
    console.log('Adding discount_type to job_parts...');
    await client.query(`
      ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'fixed'
    `);
    
    console.log('Adding cost_price to job_parts...');
    await client.query(`
      ALTER TABLE job_parts ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0
    `);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
