import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_Js8u3AGrYRCx@ep-dry-lab-a1rskxgm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function promoteAdmin() {
  try {
    console.log('Connecting to DB...');
    const result = await pool.query("UPDATE users SET role = 'super_admin' WHERE username = 'admin' RETURNING *");
    if (result.rows.length > 0) {
        console.log('✅ Success! User "admin" is now "super_admin".');
        console.log(result.rows[0]);
    } else {
        console.log('⚠️ User "admin" not found.');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

promoteAdmin();
