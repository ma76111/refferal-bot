import db from './database.js';
import { logInfo, logSuccess, logError } from './utils/logger.js';

/**
 * سكريبت لإضافة 6 نقاط تبادل لجميع المستخدمين الحاليين
 * 
 * الاستخدام:
 * node add_exchange_points.js
 */

async function addExchangePointsToAllUsers() {
  return new Promise((resolve, reject) => {
    logInfo('SCRIPT', 'Starting to add 6 exchange points to all users...');
    
    db.run(`
      UPDATE users 
      SET exchange_points = exchange_points + 6
      WHERE ban_status = 'none'
    `, function(err) {
      if (err) {
        logError('SCRIPT', 'Failed to add exchange points', err);
        reject(err);
      } else {
        logSuccess('SCRIPT', `Added 6 exchange points to ${this.changes} users`);
        resolve(this.changes);
      }
    });
  });
}

async function showResults() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        COUNT(*) as total_users,
        SUM(exchange_points) as total_points,
        AVG(exchange_points) as avg_points,
        MIN(exchange_points) as min_points,
        MAX(exchange_points) as max_points
      FROM users
      WHERE ban_status = 'none'
    `, (err, rows) => {
      if (err) {
        logError('SCRIPT', 'Failed to get results', err);
        reject(err);
      } else {
        const stats = rows[0];
        logInfo('RESULTS', '='.repeat(50));
        logInfo('RESULTS', 'Exchange Points Statistics:');
        logInfo('RESULTS', `Total Users: ${stats.total_users}`);
        logInfo('RESULTS', `Total Points: ${stats.total_points}`);
        logInfo('RESULTS', `Average Points: ${stats.avg_points.toFixed(2)}`);
        logInfo('RESULTS', `Min Points: ${stats.min_points}`);
        logInfo('RESULTS', `Max Points: ${stats.max_points}`);
        logInfo('RESULTS', '='.repeat(50));
        resolve(stats);
      }
    });
  });
}

// تشغيل السكريبت
(async () => {
  try {
    console.log('\n🚀 Starting Exchange Points Addition Script...\n');
    
    const affectedUsers = await addExchangePointsToAllUsers();
    
    console.log(`\n✅ Successfully added 6 exchange points to ${affectedUsers} users!\n`);
    
    await showResults();
    
    console.log('\n✨ Script completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();
