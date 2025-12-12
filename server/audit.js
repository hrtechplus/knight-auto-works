import db from './database.js';

export function auditLog(tableName, recordId, action, oldData = null, newData = null) {
  try {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      tableName, 
      recordId, 
      action, 
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}
