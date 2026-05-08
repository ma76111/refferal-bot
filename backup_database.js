import fs from 'fs';
import path from 'path';
import { logInfo, logSuccess, logError } from './utils/logger.js';

/**
 * سكريبت للنسخ الاحتياطي لقاعدة البيانات
 * 
 * الاستخدام:
 * node backup_database.js
 * 
 * يتم حفظ النسخة الاحتياطية في مجلد backups مع التاريخ والوقت
 */

const DB_FILE = 'bot.db';
const BACKUP_DIR = 'backups';

function createBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logSuccess('BACKUP', `Created backup directory: ${BACKUP_DIR}`);
  }
}

function getBackupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `bot_backup_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.db`;
}

function getBackupFilePath() {
  return path.join(BACKUP_DIR, getBackupFileName());
}

function backupDatabase() {
  return new Promise((resolve, reject) => {
    logInfo('BACKUP', 'Starting database backup...');
    
    if (!fs.existsSync(DB_FILE)) {
      const error = new Error(`Database file not found: ${DB_FILE}`);
      logError('BACKUP', 'Database file not found', error);
      reject(error);
      return;
    }
    
    const backupPath = getBackupFilePath();
    
    try {
      // نسخ الملف
      fs.copyFileSync(DB_FILE, backupPath);
      
      // التحقق من حجم الملف
      const originalSize = fs.statSync(DB_FILE).size;
      const backupSize = fs.statSync(backupPath).size;
      
      if (originalSize !== backupSize) {
        throw new Error('Backup file size mismatch');
      }
      
      logSuccess('BACKUP', `Database backed up successfully to: ${backupPath}`);
      logInfo('BACKUP', `Backup size: ${(backupSize / 1024).toFixed(2)} KB`);
      
      resolve({
        path: backupPath,
        size: backupSize,
        timestamp: new Date()
      });
    } catch (error) {
      logError('BACKUP', 'Failed to backup database', error);
      reject(error);
    }
  });
}

function cleanOldBackups(keepCount = 10) {
  return new Promise((resolve, reject) => {
    try {
      logInfo('CLEANUP', `Cleaning old backups (keeping last ${keepCount})...`);
      
      if (!fs.existsSync(BACKUP_DIR)) {
        logInfo('CLEANUP', 'No backup directory found, skipping cleanup');
        resolve(0);
        return;
      }
      
      // الحصول على جميع ملفات النسخ الاحتياطي
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('bot_backup_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(BACKUP_DIR, file),
          time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // ترتيب من الأحدث للأقدم
      
      if (files.length <= keepCount) {
        logInfo('CLEANUP', `Found ${files.length} backups, no cleanup needed`);
        resolve(0);
        return;
      }
      
      // حذف الملفات القديمة
      const filesToDelete = files.slice(keepCount);
      let deletedCount = 0;
      
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          deletedCount++;
          logInfo('CLEANUP', `Deleted old backup: ${file.name}`);
        } catch (error) {
          logError('CLEANUP', `Failed to delete ${file.name}`, error);
        }
      }
      
      logSuccess('CLEANUP', `Cleaned up ${deletedCount} old backups`);
      resolve(deletedCount);
    } catch (error) {
      logError('CLEANUP', 'Failed to clean old backups', error);
      reject(error);
    }
  });
}

function listBackups() {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        logInfo('LIST', 'No backup directory found');
        resolve([]);
        return;
      }
      
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.startsWith('bot_backup_') && file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime());
      
      logInfo('LIST', '='.repeat(70));
      logInfo('LIST', 'Available Backups:');
      logInfo('LIST', '='.repeat(70));
      
      if (files.length === 0) {
        logInfo('LIST', 'No backups found');
      } else {
        files.forEach((file, index) => {
          logInfo('LIST', `${index + 1}. ${file.name}`);
          logInfo('LIST', `   Size: ${(file.size / 1024).toFixed(2)} KB`);
          logInfo('LIST', `   Date: ${file.created.toLocaleString('ar-SA')}`);
          logInfo('LIST', '-'.repeat(70));
        });
      }
      
      logInfo('LIST', '='.repeat(70));
      
      resolve(files);
    } catch (error) {
      logError('LIST', 'Failed to list backups', error);
      reject(error);
    }
  });
}

// تشغيل السكريبت
(async () => {
  try {
    console.log('\n🚀 Starting Database Backup Script...\n');
    
    // إنشاء مجلد النسخ الاحتياطي
    createBackupDir();
    
    // عمل نسخة احتياطية
    const backup = await backupDatabase();
    
    console.log(`\n✅ Backup created successfully!`);
    console.log(`📁 Location: ${backup.path}`);
    console.log(`📊 Size: ${(backup.size / 1024).toFixed(2)} KB`);
    console.log(`🕐 Time: ${backup.timestamp.toLocaleString('ar-SA')}\n`);
    
    // تنظيف النسخ القديمة (الاحتفاظ بآخر 10)
    const deletedCount = await cleanOldBackups(10);
    
    if (deletedCount > 0) {
      console.log(`\n🗑️  Cleaned up ${deletedCount} old backups\n`);
    }
    
    // عرض قائمة النسخ الاحتياطية
    await listBackups();
    
    console.log('\n✨ Backup completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  }
})();
