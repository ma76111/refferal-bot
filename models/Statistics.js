import db from '../database.js';
import { logInfo, logSuccess, logError } from '../utils/logger.js';

export default class Statistics {
  // إحصائيات المستخدمين
  static async getUserStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting user statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_banned = 1 THEN 1 END) as banned_users,
          COUNT(CASE WHEN is_banned = 0 THEN 1 END) as active_users,
          SUM(balance) as total_balance
        FROM users
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get user stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `User stats retrieved: ${row.total_users} total users`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات المهام
  static async getTaskStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting task statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tasks,
          COUNT(CASE WHEN type = 'paid' THEN 1 END) as paid_tasks,
          COUNT(CASE WHEN type = 'exchange' THEN 1 END) as exchange_tasks,
          SUM(CASE WHEN type = 'paid' THEN reward * required_count ELSE 0 END) as total_rewards
        FROM tasks
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get task stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `Task stats retrieved: ${row.total_tasks} total tasks`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات الإثباتات
  static async getSubmissionStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting submission statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_submissions,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_submissions,
          COUNT(CASE WHEN status = 'rejected_final' THEN 1 END) as final_rejected_submissions
        FROM submissions
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get submission stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `Submission stats retrieved: ${row.total_submissions} total`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات الإيداعات
  static async getDepositStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting deposit statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_deposits,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_deposits,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_deposits,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_deposits,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_deposited
        FROM deposits
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get deposit stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `Deposit stats retrieved: ${row.total_deposits} total`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات السحوبات
  static async getWithdrawalStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting withdrawal statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_withdrawals,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_withdrawals,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_withdrawals,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_withdrawals,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_withdrawn
        FROM withdrawals
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get withdrawal stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `Withdrawal stats retrieved: ${row.total_withdrawals} total`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات المخالفات
  static async getViolationStats() {
    return new Promise((resolve, reject) => {
      logInfo('STATS', 'Getting violation statistics');
      
      db.get(`
        SELECT 
          COUNT(*) as total_violations,
          COUNT(DISTINCT user_id) as users_with_violations,
          SUM(points) as total_points
        FROM violations
        WHERE created_at > datetime('now', '-30 days')
      `, (err, row) => {
        if (err) {
          logError('STATS', 'Failed to get violation stats', err);
          reject(err);
        } else {
          logSuccess('STATS', `Violation stats retrieved: ${row.total_violations} violations`);
          resolve(row);
        }
      });
    });
  }

  // إحصائيات شاملة
  static async getAllStats() {
    try {
      logInfo('STATS', 'Getting all statistics');
      
      const [users, tasks, submissions, deposits, withdrawals, violations] = await Promise.all([
        this.getUserStats(),
        this.getTaskStats(),
        this.getSubmissionStats(),
        this.getDepositStats(),
        this.getWithdrawalStats(),
        this.getViolationStats()
      ]);

      logSuccess('STATS', 'All statistics retrieved successfully');
      
      return {
        users,
        tasks,
        submissions,
        deposits,
        withdrawals,
        violations
      };
    } catch (error) {
      logError('STATS', 'Failed to get all stats', error);
      throw error;
    }
  }

  // أفضل المستخدمين (الأكثر نشاطاً)
  static async getTopUsers(limit = 10) {
    return new Promise((resolve, reject) => {
      logInfo('STATS', `Getting top ${limit} users`);
      
      db.all(`
        SELECT 
          u.telegram_id,
          u.username,
          u.balance,
          COUNT(DISTINCT s.id) as completed_tasks,
          COUNT(DISTINCT t.id) as created_tasks,
          COALESCE(AVG(r.rating), 0) as avg_rating
        FROM users u
        LEFT JOIN submissions s ON u.id = s.user_id AND s.status = 'approved'
        LEFT JOIN tasks t ON u.id = t.owner_id
        LEFT JOIN ratings r ON u.id = r.rated_user_id
        WHERE u.is_banned = 0
        GROUP BY u.id
        ORDER BY completed_tasks DESC, created_tasks DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          logError('STATS', 'Failed to get top users', err);
          reject(err);
        } else {
          logSuccess('STATS', `Top ${rows.length} users retrieved`);
          resolve(rows);
        }
      });
    });
  }
}
