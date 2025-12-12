import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function performBackup() {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `knight-auto-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  console.log(`📦 Starting database backup: ${backupName}...`);

  try {
    // Use better-sqlite3's native backup API
    await db.backup(backupPath);
    console.log(`✅ Backup completed successfully: ${backupName}`);
    
    // Cleanup old backups
    cleanOldBackups();
    
    return { success: true, path: backupPath };
  } catch (error) {
    console.error('❌ Backup failed:', error);
    return { success: false, error: error.message };
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    files.forEach(file => {
      if (!file.endsWith('.db')) return;
      
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      
      // Delete if older than 7 days
      if (now - stat.mtimeMs > SEVEN_DAYS) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old backup file(s)`);
    }
  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
}

export function scheduleBackups() {
  // Run immediately on start if no backup exists from today
  const today = new Date().toISOString().split('T')[0];
  const files = fs.readdirSync(BACKUP_DIR);
  const hasTodayBackup = files.some(f => f.includes(today));
  
  if (!hasTodayBackup) {
    console.log('NOTICE: No backup found for today. Performing initial backup...');
    performBackup();
  }

  // Schedule daily backup at midnight
  // Using a simple interval check every hour
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0) {
      // It's midnight hour, check if we already backed up today to avoid duplicates
      // (This is a simplified logic, a real cron lib is better but this avoids dependencies)
      const currentToday = new Date().toISOString().split('T')[0];
      const currentFiles = fs.readdirSync(BACKUP_DIR);
      if (!currentFiles.some(f => f.includes(currentToday))) {
        performBackup();
      }
    }
  }, 60 * 60 * 1000); // Check every hour
  
  console.log('CLOCK: Automated backup scheduler active');
}
