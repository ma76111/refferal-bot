import NotificationPrefs from '../models/NotificationPrefs.js';
import Notification from '../models/Notification.js';

/**
 * إرسال إشعار للمستخدم
 * يتحقق من تفضيلات المستخدم قبل الإنشاء
 * @param {number} userId
 * @param {string} type - نوع الإشعار (من NOTIFICATION_TYPES)
 * @param {object} payload - { title, body?, link? }
 * @returns {Promise<number|null>} معرّف الإشعار أو null إذا كان معطّلاً
 */
export async function sendNotification(userId, type, payload) {
  try {
    // التحقق من تفضيلات المستخدم
    const enabled = await NotificationPrefs.isEnabled(userId, type);
    if (!enabled) {
      return null; // الإشعار معطّل للمستخدم
    }

    // إنشاء الإشعار
    const { title, body = null, link = null } = payload;
    const notificationId = await Notification.create(userId, type, title, body, link);
    
    return notificationId;
  } catch (error) {
    console.error('[NotificationHandler] Error sending notification:', error);
    throw error;
  }
}

export default { sendNotification };
