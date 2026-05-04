import db from '../database.js';
import { logDatabase, logInfo, logSuccess, logError } from '../utils/logger.js';

export default class Task {
  static create(taskData) {
    return new Promise((resolve, reject) => {
      const { ownerId, botName, referralLink, requiredCount, taskType, rewardPerUser, verificationInstructions, proofType } = taskData;
      
      logInfo('TASK', `Creating new task for user ${ownerId}`, { botName, taskType, requiredCount });
      
      db.run(
        `INSERT INTO tasks (owner_id, bot_name, referral_link, required_count, task_type, reward_per_user, verification_instructions, proof_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ownerId, botName, referralLink, requiredCount, taskType, rewardPerUser || 0, verificationInstructions, proofType],
        function(err) {
          if (err) {
            logError('TASK', 'Failed to create task', err);
            reject(err);
          } else {
            logSuccess('TASK', `Task created successfully with ID: ${this.lastID}`);
            logDatabase('INSERT', 'tasks', { id: this.lastID, botName, taskType });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getActiveTasks(userId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Fetching active tasks for user ${userId}`);
      
      db.all(
        `SELECT t.*, u.username as owner_username
         FROM tasks t 
         JOIN users u ON t.owner_id = u.id 
         WHERE t.status = 'active' 
         AND t.completed_count < t.required_count
         AND t.owner_id != ?
         AND t.id NOT IN (
           SELECT task_id FROM task_submissions WHERE user_id = ?
         )
         AND t.id NOT IN (
           SELECT task_id FROM hidden_tasks WHERE user_id = ?
         )
         ORDER BY 
           CASE WHEN t.task_type = 'paid' THEN t.reward_per_user ELSE 0 END DESC,
           t.created_at DESC
         LIMIT 10`,
        [userId, userId, userId],
        (err, rows) => {
          if (err) {
            logError('TASK', 'Failed to fetch active tasks', err);
            reject(err);
          } else {
            logSuccess('TASK', `Found ${rows?.length || 0} active tasks for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getById(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Fetching task by ID: ${taskId}`);
      
      db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) {
          logError('TASK', `Failed to fetch task ${taskId}`, err);
          reject(err);
        } else {
          if (row) {
            logSuccess('TASK', `Task ${taskId} found`);
          } else {
            logInfo('TASK', `Task ${taskId} not found`);
          }
          resolve(row);
        }
      });
    });
  }

  static getUserTasks(userId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Fetching all tasks for user ${userId}`);
      
      db.all(
        'SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) {
            logError('TASK', 'Failed to fetch user tasks', err);
            reject(err);
          } else {
            logSuccess('TASK', `Found ${rows?.length || 0} tasks for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getUserActiveTasksCount(userId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Counting active tasks for user ${userId}`);
      
      db.get(
        'SELECT COUNT(*) as count FROM tasks WHERE owner_id = ? AND status = "active"',
        [userId],
        (err, row) => {
          if (err) {
            logError('TASK', 'Failed to count active tasks', err);
            reject(err);
          } else {
            const count = row?.count || 0;
            logInfo('TASK', `User ${userId} has ${count} active tasks`);
            resolve(count);
          }
        }
      );
    });
  }

  static incrementCompleted(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Incrementing completed count for task ${taskId}`);
      
      db.run(
        'UPDATE tasks SET completed_count = completed_count + 1 WHERE id = ?',
        [taskId],
        (err) => {
          if (err) {
            logError('TASK', `Failed to increment task ${taskId}`, err);
            reject(err);
          } else {
            logSuccess('TASK', `Task ${taskId} completed count incremented`);
            logDatabase('UPDATE', 'tasks', { id: taskId, action: 'increment_completed' });
            resolve();
          }
        }
      );
    });
  }

  static updateStatus(taskId, status) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Updating task ${taskId} status to: ${status}`);
      
      db.run(
        'UPDATE tasks SET status = ? WHERE id = ?',
        [status, taskId],
        (err) => {
          if (err) {
            logError('TASK', `Failed to update task ${taskId} status`, err);
            reject(err);
          } else {
            logSuccess('TASK', `Task ${taskId} status updated to ${status}`);
            logDatabase('UPDATE', 'tasks', { id: taskId, status });
            resolve();
          }
        }
      );
    });
  }

  static delete(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Deleting task ${taskId}`);
      
      db.run(
        'DELETE FROM tasks WHERE id = ?',
        [taskId],
        (err) => {
          if (err) {
            logError('TASK', `Failed to delete task ${taskId}`, err);
            reject(err);
          } else {
            logSuccess('TASK', `Task ${taskId} deleted successfully`);
            logDatabase('DELETE', 'tasks', { id: taskId });
            resolve();
          }
        }
      );
    });
  }

  static isOwner(taskId, userId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Checking if user ${userId} owns task ${taskId}`);
      
      db.get(
        'SELECT id FROM tasks WHERE id = ? AND owner_id = ?',
        [taskId, userId],
        (err, row) => {
          if (err) {
            logError('TASK', 'Failed to check task ownership', err);
            reject(err);
          } else {
            const isOwner = !!row;
            logInfo('TASK', `User ${userId} ${isOwner ? 'owns' : 'does not own'} task ${taskId}`);
            resolve(isOwner);
          }
        }
      );
    });
  }

  static hasPendingSubmissions(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Checking for pending submissions on task ${taskId}`);
      
      db.get(
        'SELECT COUNT(*) as count FROM task_submissions WHERE task_id = ? AND status = "pending"',
        [taskId],
        (err, row) => {
          if (err) {
            logError('TASK', 'Failed to check pending submissions', err);
            reject(err);
          } else {
            const count = row?.count || 0;
            logInfo('TASK', `Task ${taskId} has ${count} pending submissions`);
            resolve(count > 0);
          }
        }
      );
    });
  }

  static getPendingSubmissionsCount(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Getting pending submissions count for task ${taskId}`);
      
      db.get(
        'SELECT COUNT(*) as count FROM task_submissions WHERE task_id = ? AND status = "pending"',
        [taskId],
        (err, row) => {
          if (err) {
            logError('TASK', 'Failed to get pending submissions count', err);
            reject(err);
          } else {
            const count = row?.count || 0;
            logInfo('TASK', `Task ${taskId} has ${count} pending submissions`);
            resolve(count);
          }
        }
      );
    });
  }

  static incrementPendingCount(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Incrementing pending count for task ${taskId}`);
      
      db.run(
        'UPDATE tasks SET completed_count = completed_count + 1 WHERE id = ?',
        [taskId],
        (err) => {
          if (err) {
            logError('TASK', `Failed to increment pending count for task ${taskId}`, err);
            reject(err);
          } else {
            logSuccess('TASK', `Task ${taskId} pending count incremented`);
            logDatabase('UPDATE', 'tasks', { id: taskId, action: 'increment_pending' });
            resolve();
          }
        }
      );
    });
  }

  static decrementPendingCount(taskId) {
    return new Promise((resolve, reject) => {
      logInfo('TASK', `Decrementing pending count for task ${taskId}`);
      
      db.run(
        'UPDATE tasks SET completed_count = completed_count - 1 WHERE id = ? AND completed_count > 0',
        [taskId],
        (err) => {
          if (err) {
            logError('TASK', `Failed to decrement pending count for task ${taskId}`, err);
            reject(err);
          } else {
            logSuccess('TASK', `Task ${taskId} pending count decremented`);
            logDatabase('UPDATE', 'tasks', { id: taskId, action: 'decrement_pending' });
            resolve();
          }
        }
      );
    });
  }
}
