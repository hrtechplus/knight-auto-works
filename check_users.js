
import db from './server/database.js';

const users = db.prepare('SELECT * FROM users').all();
console.log('Users found:', users);
