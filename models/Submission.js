import db from '../database.js';
import logger from '../utils/logger.js';

export default class Submission {
  static create(submissionData) {
    return new Promise((resolve, reject) => {
      const { taskId, userId, proofText, proofImages } = submissionData;
      
      logger.database(`Creating submission for task ${taskId} by user ${userId}`);
      
      db.run(
        `INSERT INTO task_submissions (task_id, user_id, proof_text, proof_images)
         VALUES (?, ?, ?, ?)`,
        [taskId, userId, proofText, proofImages],
        function(err) {
          if (err) {
            logger.error(`Failed to create submission: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Submission created with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getPending() {
    return new Promise((resolve, reject) => {
      logger.database('Fetching pending submissions');
      
      db.all(
        `SELECT s.*, t.bot_name, t.task_type, t.reward_per_user, u.username, u.telegram_id
         FROM task_submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users u ON s.user_id = u.id
         WHERE s.status = 'pending'
         ORDER BY s.created_at ASC`,
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch pending submissions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} pending submissions`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getById(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Fetching submission by ID: ${submissionId}`);
      
      db.get(
        `SELECT s.id, s.task_id, s.user_id, s.proof_text, s.proof_images, 
                s.status, s.reviewed_by, s.created_at, s.reviewed_at,
                s.reject_type, s.reject_message, s.can_retry,
                t.bot_name, t.task_type, t.reward_per_user, t.owner_id,
                u.telegram_id as user_telegram_id, u.username
         FROM task_submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users u ON s.user_id = u.id
         WHERE s.id = ?`,
        [submissionId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to fetch submission ${submissionId}: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Submission ${submissionId} ${row ? 'found' : 'not found'}`);
            if (row) {
              logger.info(`Submission status: ${row.status}`);
            }
            resolve(row);
          }
        }
      );
    });
  }

  static updateStatus(submissionId, status, reviewerId) {
    return new Promise((resolve, reject) => {
      logger.database(`Updating submission ${submissionId} status to: ${status}`);
      
      db.run(
        `UPDATE task_submissions 
         SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, reviewerId, submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to update submission ${submissionId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Submission ${submissionId} status updated to ${status} by reviewer ${reviewerId}`);
            resolve();
          }
        }
      );
    });
  }

  static hasSubmitted(taskId, userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking if user ${userId} has submitted for task ${taskId}`);
      
      db.get(
        'SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ?',
        [taskId, userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to check submission: ${err.message}`);
            reject(err);
          } else {
            logger.info(`User ${userId} ${row ? 'has' : 'has not'} submitted for task ${taskId}`);
            resolve(!!row);
          }
        }
      );
    });
  }

  static getActiveSubmission(taskId, userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting active submission for task ${taskId} by user ${userId}`);
      
      db.get(
        `SELECT id, started_at, status 
         FROM task_submissions 
         WHERE task_id = ? AND user_id = ? AND status = 'pending'`,
        [taskId, userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get active submission: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Active submission ${row ? 'found' : 'not found'} for task ${taskId}`);
            resolve(row);
          }
        }
      );
    });
  }

  static deleteExpiredSubmission(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Deleting expired submission ${submissionId}`);
      
      db.run(
        'DELETE FROM task_submissions WHERE id = ?',
        [submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to delete submission ${submissionId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Expired submission ${submissionId} deleted`);
            resolve();
          }
        }
      );
    });
  }

  static checkAndCleanExpired(timeoutSeconds) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking for expired submissions (timeout: ${timeoutSeconds}s)`);
      
      db.all(
        `SELECT id, task_id, user_id, started_at 
         FROM task_submissions 
         WHERE status = 'pending' 
         AND started_at IS NOT NULL
         AND (julianday('now') - julianday(started_at)) * 86400 > ?`,
        [timeoutSeconds],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to check expired submissions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} expired submissions`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getUserSubmissions(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Fetching submissions for user ${userId}`);
      
      db.all(
        `SELECT s.*, t.bot_name, t.task_type, t.reward_per_user
         FROM task_submissions s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch user submissions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} submissions for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // الحصول على إثباتات المستخدم مع تفاصيل كاملة (صاحب المهمة، تاريخ المراجعة، إلخ)
  static getUserSubmissionsWithDetails(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Fetching detailed submissions for user ${userId}`);
      
      db.all(
        `SELECT s.id, s.task_id, s.user_id, s.status, s.created_at, s.reviewed_at,
                s.reject_type, s.reject_message, s.can_retry,
                t.bot_name, t.task_type, t.reward_per_user, t.owner_id,
                owner.telegram_id as owner_telegram_id, owner.username as owner_username
         FROM task_submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users owner ON t.owner_id = owner.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch detailed user submissions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} detailed submissions for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getTaskSubmissions(taskId) {
    return new Promise((resolve, reject) => {
      logger.database(`Fetching submissions for task ${taskId}`);
      
      db.all(
        `SELECT s.*, u.username, u.telegram_id as user_telegram_id
         FROM task_submissions s
         JOIN users u ON s.user_id = u.id
         WHERE s.task_id = ?
         ORDER BY s.created_at DESC`,
        [taskId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch task submissions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} submissions for task ${taskId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // تحديث حالة الرفض مع رسالة وإمكانية إعادة المحاولة
  static updateRejection(submissionId, rejectType, rejectMessage, canRetry) {
    return new Promise((resolve, reject) => {
      logger.database(`Updating rejection for submission ${submissionId}: type=${rejectType}, canRetry=${canRetry}`);
      
      db.run(
        `UPDATE task_submissions 
         SET reject_type = ?, reject_message = ?, can_retry = ?
         WHERE id = ?`,
        [rejectType, rejectMessage, canRetry ? 1 : 0, submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to update rejection: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Rejection updated for submission ${submissionId}`);
            resolve();
          }
        }
      );
    });
  }

  // الحصول على صاحب المهمة من خلال التقديم
  static getTaskOwner(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting task owner for submission ${submissionId}`);
      
      db.get(
        `SELECT t.owner_id, u.telegram_id, u.username
         FROM task_submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users u ON t.owner_id = u.id
         WHERE s.id = ?`,
        [submissionId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get task owner: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Task owner found: ${row?.telegram_id}`);
            resolve(row);
          }
        }
      );
    });
  }

  // حذف الصور من التقديم (لتوفير المساحة والخصوصية)
  static clearProofImages(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Clearing proof images for submission ${submissionId}`);
      
      db.run(
        `UPDATE task_submissions 
         SET proof_images = NULL 
         WHERE id = ?`,
        [submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to clear proof images: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Proof images cleared for submission ${submissionId}`);
            resolve();
          }
        }
      );
    });
  }

  // إلغاء إمكانية إعادة المحاولة (عند رفض التحسين)
  static disableRetry(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Disabling retry for submission ${submissionId}`);
      
      db.run(
        `UPDATE task_submissions 
         SET can_retry = 0 
         WHERE id = ?`,
        [submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to disable retry: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Retry disabled for submission ${submissionId}`);
            resolve();
          }
        }
      );
    });
  }

  // تعيين مهلة التحسين
  static setImprovementDeadline(submissionId, timeoutSeconds) {
    return new Promise((resolve, reject) => {
      logger.database(`Setting improvement deadline for submission ${submissionId}: ${timeoutSeconds} seconds`);
      
      db.run(
        `UPDATE task_submissions 
         SET improvement_deadline = datetime('now', '+${timeoutSeconds} seconds')
         WHERE id = ?`,
        [submissionId],
        (err) => {
          if (err) {
            logger.error(`Failed to set improvement deadline: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Improvement deadline set for submission ${submissionId}`);
            resolve();
          }
        }
      );
    });
  }

  // التحقق من انتهاء مهلة التحسين
  static checkImprovementExpired(submissionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking improvement deadline for submission ${submissionId}`);
      
      db.get(
        `SELECT improvement_deadline,
                (julianday('now') > julianday(improvement_deadline)) as is_expired
         FROM task_submissions 
         WHERE id = ? AND can_retry = 1`,
        [submissionId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to check improvement deadline: ${err.message}`);
            reject(err);
          } else {
            const expired = row && row.is_expired === 1;
            logger.info(`Improvement deadline for submission ${submissionId}: ${expired ? 'expired' : 'valid'}`);
            resolve(expired);
          }
        }
      );
    });
  }

  // إلغاء إمكانية التحسين للإثباتات المنتهية
  static disableExpiredImprovements() {
    return new Promise((resolve, reject) => {
      logger.database('Disabling expired improvement opportunities');
      
      db.run(
        `UPDATE task_submissions 
         SET can_retry = 0 
         WHERE can_retry = 1 
         AND improvement_deadline IS NOT NULL 
         AND datetime('now') > datetime(improvement_deadline)`,
        function(err) {
          if (err) {
            logger.error(`Failed to disable expired improvements: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Disabled ${this.changes} expired improvement opportunities`);
            resolve(this.changes);
          }
        }
      );
    });
  }
}
