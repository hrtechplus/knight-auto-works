import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function upgradeToSuperAdmin() {
  try {
    const result = await pool.query(
      `UPDATE users SET role = 'super_admin' WHERE username = $1 RETURNING id, username, role`,
      ['hasindu@apig.com']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ User upgraded to super_admin:');
      console.log('   ID:', result.rows[0].id);
      console.log('   Username:', result.rows[0].username);
      console.log('   Role:', result.rows[0].role);
    } else {
      console.log('❌ User not found: hasindu@apig.com');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

upgradeToSuperAdmin();
