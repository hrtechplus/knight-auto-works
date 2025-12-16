import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createSuperAdmin() {
  const username = 'hasindu@apig.com';
  const password = 'gkr11388tm';
  const name = 'Hasindu (Super Admin)';
  const role = 'admin';

  try {
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (existing.rows.length > 0) {
      console.log('❌ User already exists:', username);
      process.exit(1);
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, passwordHash, name, role]
    );

    console.log('✅ Super Admin created successfully!');
    console.log('   Username:', username);
    console.log('   Role:', role);
    console.log('   User ID:', result.rows[0].id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
