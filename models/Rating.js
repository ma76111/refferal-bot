import db from '../database.js';
import { logInfo, logSuccess, logError, logDatabase } from '../utils/logger.js';

export default class Rating {
  // إنشاء تقييم جديد
  static create(taskId, raterUserId, ratedUserId, rating, comment = null) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Creating rating: ${rating}/5 for user ${ratedUserId}`);
      
      db.run(
        `INSERT INTO ratings (task_id, rater_user_id, rated_user_id, rating, comment)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, raterUserId, ratedUserId, rating, comment],
        function(err) {
          if (err) {
            logError('RATING', 'Failed to create rating', err);
            reject(err);
          } else {
            logSuccess('RATING', `Rating created with ID: ${this.lastID}`);
            logDatabase('INSERT', 'ratings', { id: this.lastID, rating });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // التحقق من وجود تقييم
  static checkExists(taskId, raterUserId) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Checking if rating exists for task ${taskId}`);
      
      db.get(
        'SELECT id FROM ratings WHERE task_id = ? AND rater_user_id = ?',
        [taskId, raterUserId],
        (err, row) => {
          if (err) {
            logError('RATING', 'Failed to check rating', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  // الحصول على متوسط تقييم المستخدم
  static getAverageRating(userId) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Getting average rating for user ${userId}`);
      
      db.get(
        `SELECT 
          AVG(rating) as avg_rating,
          COUNT(*) as total_ratings
         FROM ratings 
         WHERE rated_user_id = ?`,
        [userId],
        (err, row) => {
          if (err) {
            logError('RATING', 'Failed to get average rating', err);
            reject(err);
          } else {
            const avgRating = row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : 0;
            logSuccess('RATING', `Average rating: ${avgRating}/5 (${row.total_ratings} ratings)`);
            resolve({
              avgRating: parseFloat(avgRating),
              totalRatings: row.total_ratings || 0
            });
          }
        }
      );
    });
  }

  // الحصول على جميع تقييمات المستخدم
  static getUserRatings(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Getting ratings for user ${userId}`);
      
      db.all(
        `SELECT 
          r.*,
          u.username as rater_username,
          t.bot_name as task_title
         FROM ratings r
         JOIN users u ON r.rater_user_id = u.id
         JOIN tasks t ON r.task_id = t.id
         WHERE r.rated_user_id = ?
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) {
            logError('RATING', 'Failed to get user ratings', err);
            reject(err);
          } else {
            logSuccess('RATING', `Found ${rows.length} ratings`);
            resolve(rows);
          }
        }
      );
    });
  }

  // الحصول على توزيع التقييمات
  static getRatingDistribution(userId) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Getting rating distribution for user ${userId}`);
      
      db.all(
        `SELECT 
          rating,
          COUNT(*) as count
         FROM ratings
         WHERE rated_user_id = ?
         GROUP BY rating
         ORDER BY rating DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logError('RATING', 'Failed to get rating distribution', err);
            reject(err);
          } else {
            const distribution = {
              5: 0, 4: 0, 3: 0, 2: 0, 1: 0
            };
            
            rows.forEach(row => {
              distribution[row.rating] = row.count;
            });
            
            logSuccess('RATING', 'Rating distribution retrieved');
            resolve(distribution);
          }
        }
      );
    });
  }

  // حذف تقييم
  static delete(ratingId) {
    return new Promise((resolve, reject) => {
      logInfo('RATING', `Deleting rating ${ratingId}`);
      
      db.run(
        'DELETE FROM ratings WHERE id = ?',
        [ratingId],
        function(err) {
          if (err) {
            logError('RATING', 'Failed to delete rating', err);
            reject(err);
          } else {
            logSuccess('RATING', `Rating ${ratingId} deleted`);
            logDatabase('DELETE', 'ratings', { id: ratingId });
            resolve(this.changes);
          }
        }
      );
    });
  }
}
