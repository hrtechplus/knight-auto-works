import db from './database.js';

const email = 'rawart.media@gmail.com';

try {
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(email);
  
  if (existing) {
    console.log(`User ${email} already exists.`);
  } else {
    // Create user with 'super_admin' role
    // Password hash is dummy because they use Google Auth
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, name, role, is_active) 
      VALUES (?, ?, ?, ?, ?)
    `).run(email, 'google-auth-placeholder', 'Admin User', 'super_admin', 1);
    
    console.log(`✅ User ${email} created successfully with ID: ${result.lastInsertRowid}`);
  }
} catch (error) {
  console.error('Error creating user:', error);
}
