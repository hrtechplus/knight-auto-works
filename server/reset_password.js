
import db from './database.js';
import bcrypt from 'bcryptjs';

const username = 'hasindu@gmail.com';
const newPassword = 'admin123';
const hashedPassword = bcrypt.hashSync(newPassword, 10);

const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hashedPassword, username);

console.log(`Updated password for ${username}. Changes: ${result.changes}`);
