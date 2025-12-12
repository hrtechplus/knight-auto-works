import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class BackupService {
  constructor(options = {}) {
    this.backupDir = options.backupDir || path.join(__dirname, 'backups');
    this.retentionDays = options.retentionDays || 7;
    this.cronSchedule = options.schedule || (24 * 60 * 60 * 1000); // Default: Daily (24h)
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Initializes the backup scheduler
   */
  start() {
    console.log('🛡️  Backup Service started. Schedule: Daily');
    // Perform an immediate backup on startup if none exists for today
    this.checkAndBackup();
    
    // Schedule periodic backups
    setInterval(() => {
      this.checkAndBackup();
    }, this.cronSchedule);
  }

  /**
   * Creates a backup of the current database
   */
  async performBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `knight-auto-${timestamp}.db`;
      const backupPath = path.join(this.backupDir, filename);
      
      console.log(`⏳ Starting backup: ${filename}...`);
      
      // Use better-sqlite3's native backup API for consistency
      await db.backup(backupPath);
      
      console.log(`✅ Backup completed successfully: ${backupPath}`);
      
      // Clean up old backups after successful backup
      this.cleanOldBackups();
      
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('❌ Backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Checks if a backup is needed (e.g., none today) and runs it
   */
  checkAndBackup() {
    const today = new Date().toISOString().split('T')[0];
    const files = fs.readdirSync(this.backupDir);
    
    // Check if we already have a backup for today
    const hasBackupToday = files.some(file => file.includes(today) && file.endsWith('.db'));
    
    if (!hasBackupToday) {
      console.log('ℹ️  No backup found for today. running backup...');
      this.performBackup();
    }
  }

  /**
   * Removes backups older than retentionDays
   */
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const now = Date.now();
      const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
      
      let deletedCount = 0;
      
      files.forEach(file => {
        if (!file.endsWith('.db')) return;
        
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old backup(s)`);
      }
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }
}

// Export a singleton instance
export const backupService = new BackupService();
