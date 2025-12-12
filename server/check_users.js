
import db from './database.js';

const users = db.prepare('SELECT * FROM users').all();
console.log('Users found:', users);
