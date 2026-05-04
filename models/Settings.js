import db from '../database.js';
import { logDatabase, logInfo, logSuccess, logError } from '../utils/logger.js';

export default class Settings {
  static get(key) {
    return new Promise((resolve, reject) => {
      logInfo('SETTINGS', `Getting setting: ${key}`);
      
      db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
        if (err) {
          logError('SETTINGS', `Failed to get setting ${key}`, err);
          reject(err);
        } else {
          const value = row ? JSON.parse(row.value) : null;
          logInfo('SETTINGS', `Setting ${key}: ${value !== null ? 'found' : 'not found'}`);
          resolve(value);
        }
      });
    });
  }

  static set(key, value) {
    return new Promise((resolve, reject) => {
      logInfo('SETTINGS', `Setting ${key} to:`, value);
      
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, JSON.stringify(value)],
        (err) => {
          if (err) {
            logError('SETTINGS', `Failed to set ${key}`, err);
            reject(err);
          } else {
            logSuccess('SETTINGS', `Setting ${key} updated successfully`);
            logDatabase('UPSERT', 'settings', { key, value });
            resolve();
          }
        }
      );
    });
  }

  static async getMaxRequiredCount() {
    const value = await this.get('max_required_count');
    const result = value || 10;
    logInfo('SETTINGS', `Max required count: ${result}`);
    return result;
  }

  static async setMaxRequiredCount(count) {
    logInfo('SETTINGS', `Setting max required count to: ${count}`);
    return await this.set('max_required_count', count);
  }

  static async getMaxTasksPerUser() {
    const value = await this.get('max_tasks_per_user');
    const result = value || 2;
    logInfo('SETTINGS', `Max tasks per user: ${result}`);
    return result;
  }

  static async setMaxTasksPerUser(count) {
    logInfo('SETTINGS', `Setting max tasks per user to: ${count}`);
    return await this.set('max_tasks_per_user', count);
  }

  static async getSupportText(lang = 'ar') {
    const value = await this.get(`support_text_${lang}`);
    const result = value || 'للتواصل مع الدعم، يرجى المراسلة على: @support';
    logInfo('SETTINGS', `Support text for ${lang}: ${result.substring(0, 50)}...`);
    return result;
  }

  static async setSupportText(lang, text) {
    logInfo('SETTINGS', `Setting support text for ${lang}`);
    return await this.set(`support_text_${lang}`, text);
  }

  static async getTaskTimeout() {
    const value = await this.get('task_timeout');
    const result = value || 300; // 5 دقائق افتراضياً
    logInfo('SETTINGS', `Task timeout: ${result} seconds (${result / 60} minutes)`);
    return result;
  }

  static async setTaskTimeout(seconds) {
    logInfo('SETTINGS', `Setting task timeout to: ${seconds} seconds (${seconds / 60} minutes)`);
    return await this.set('task_timeout', seconds);
  }

  static async getImprovementTimeout() {
    const value = await this.get('improvement_timeout');
    const result = value || 900; // 15 دقيقة افتراضياً
    logInfo('SETTINGS', `Improvement timeout: ${result} seconds (${result / 60} minutes)`);
    return result;
  }

  static async setImprovementTimeout(seconds) {
    logInfo('SETTINGS', `Setting improvement timeout to: ${seconds} seconds (${seconds / 60} minutes)`);
    return await this.set('improvement_timeout', seconds);
  }

  static async getMinReward() {
    const value = await this.get('min_reward');
    const result = value || 0.01; // 0.01 USDT افتراضياً
    logInfo('SETTINGS', `Minimum reward: ${result} USDT`);
    return result;
  }

  static async setMinReward(amount) {
    logInfo('SETTINGS', `Setting minimum reward to: ${amount} USDT`);
    return await this.set('min_reward', amount);
  }
}
