
import db from './database.js';

const users = db.prepare('SELECT id, username, name, role FROM users').all();
console.log('Users:', JSON.stringify(users, null, 2));
