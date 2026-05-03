import db from '../database.js';
import logger from '../utils/logger.js';

export default class HiddenTask {
  static hide(userId, taskId) {
    return new Promise((resolve, reject) => {
      logger.database(`Hiding task ${taskId} for user ${userId}`);
      
      db.run(
        'INSERT OR IGNORE INTO hidden_tasks (user_id, task_id) VALUES (?, ?)',
        [userId, taskId],
        (err) => {
          if (err) {
            logger.error(`Failed to hide task ${taskId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Task ${taskId} hidden for user ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  static unhide(userId, taskId) {
    return new Promise((resolve, reject) => {
      logger.database(`Unhiding task ${taskId} for user ${userId}`);
      
      db.run(
        'DELETE FROM hidden_tasks WHERE user_id = ? AND task_id = ?',
        [userId, taskId],
        (err) => {
          if (err) {
            logger.error(`Failed to unhide task ${taskId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Task ${taskId} unhidden for user ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  static isHidden(userId, taskId) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking if task ${taskId} is hidden for user ${userId}`);
      
      db.get(
        'SELECT id FROM hidden_tasks WHERE user_id = ? AND task_id = ?',
        [userId, taskId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to check hidden status: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Task ${taskId} is ${row ? 'hidden' : 'visible'} for user ${userId}`);
            resolve(!!row);
          }
        }
      );
    });
  }
}
