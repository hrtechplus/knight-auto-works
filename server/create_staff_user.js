import db from './database.js';
import bcrypt from 'bcryptjs';

const passwordHash = bcrypt.hashSync('staff123', 10);

try {
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `).run('staff', passwordHash, 'Staff Member', 'staff');
  
  console.log('Staff user created with ID:', result.lastInsertRowid);
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    console.log('Staff user already exists');
  } else {
    console.error('Error creating staff user:', error);
  }
}
