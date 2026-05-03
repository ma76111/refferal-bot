import db from '../database.js';
import logger from '../utils/logger.js';

export default class Report {
  // إنشاء إبلاغ جديد
  static create(reportData) {
    return new Promise((resolve, reject) => {
      const { reporterId, reportedUserId, taskId, submissionId, reason } = reportData;
      
      logger.database(`Creating report: reporter=${reporterId}, reported=${reportedUserId}, task=${taskId}`);
      
      db.run(
        `INSERT INTO reports (reporter_id, reported_user_id, task_id, submission_id, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [reporterId, reportedUserId, taskId, submissionId, reason],
        function(err) {
          if (err) {
            logger.error(`Failed to create report: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Report created with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // عدد الإبلاغات على مستخدم معين
  static getReportCount(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting report count for user ${userId}`);
      
      db.get(
        `SELECT COUNT(DISTINCT reporter_id) as count 
         FROM reports 
         WHERE reported_user_id = ? AND status = 'pending'`,
        [userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get report count: ${err.message}`);
            reject(err);
          } else {
            const count = row?.count || 0;
            logger.info(`User ${userId} has ${count} unique reports`);
            resolve(count);
          }
        }
      );
    });
  }

  // عدد الإبلاغات التي قام بها مستخدم معين (للتحقق من السبام)
  static getRecentReportsByUser(userId, minutes = 5) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting recent reports by user ${userId} in last ${minutes} minutes`);
      
      db.get(
        `SELECT COUNT(*) as count 
         FROM reports 
         WHERE reporter_id = ? 
         AND datetime(created_at) > datetime('now', '-${minutes} minutes')`,
        [userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get recent reports: ${err.message}`);
            reject(err);
          } else {
            const count = row?.count || 0;
            logger.info(`User ${userId} made ${count} reports in last ${minutes} minutes`);
            resolve(count);
          }
        }
      );
    });
  }

  // التحقق من وجود إبلاغ سابق من نفس المستخدم على نفس الشخص
  static hasReported(reporterId, reportedUserId, submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking if user ${reporterId} already reported user ${reportedUserId} for submission ${submissionId}`);
      
      db.get(
        `SELECT id FROM reports 
         WHERE reporter_id = ? AND reported_user_id = ? AND submission_id = ?`,
        [reporterId, reportedUserId, submissionId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to check report: ${err.message}`);
            reject(err);
          } else {
            const hasReported = !!row;
            logger.info(`User ${reporterId} ${hasReported ? 'has' : 'has not'} reported this submission`);
            resolve(hasReported);
          }
        }
      );
    });
  }

  // الحصول على جميع الإبلاغات المعلقة
  static getPending() {
    return new Promise((resolve, reject) => {
      logger.database('Fetching pending reports');
      
      db.all(
        `SELECT r.*, 
         u1.username as reporter_username, u1.telegram_id as reporter_telegram_id,
         u2.username as reported_username, u2.telegram_id as reported_telegram_id,
         t.bot_name, s.proof_text, s.proof_images
         FROM reports r
         JOIN users u1 ON r.reporter_id = u1.id
         JOIN users u2 ON r.reported_user_id = u2.id
         JOIN tasks t ON r.task_id = t.id
         JOIN task_submissions s ON r.submission_id = s.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at ASC`,
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch pending reports: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} pending reports`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // تحديث حالة الإبلاغ
  static updateStatus(reportId, status, reviewerId) {
    return new Promise((resolve, reject) => {
      logger.database(`Updating report ${reportId} status to: ${status}`);
      
      db.run(
        `UPDATE reports 
         SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, reviewerId, reportId],
        (err) => {
          if (err) {
            logger.error(`Failed to update report ${reportId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Report ${reportId} status updated to ${status}`);
            resolve();
          }
        }
      );
    });
  }

  // حذف جميع الإبلاغات على مستخدم معين (عند حظره)
  static clearReports(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Clearing all reports for user ${userId}`);
      
      db.run(
        `UPDATE reports SET status = 'resolved' WHERE reported_user_id = ? AND status = 'pending'`,
        [userId],
        (err) => {
          if (err) {
            logger.error(`Failed to clear reports: ${err.message}`);
            reject(err);
          } else {
            logger.success(`All reports cleared for user ${userId}`);
            resolve();
          }
        }
      );
    });
  }
}
