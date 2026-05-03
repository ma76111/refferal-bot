import db from '../database.js';

export default class User {
  static searchByIdOrUsername(query) {
    return new Promise((resolve, reject) => {
      const searchId = parseInt(query) || 0;
      const searchUsername = `%${query}%`;
      
      console.log('[SEARCH] Query:', query);
      console.log('[SEARCH] Search ID:', searchId);
      console.log('[SEARCH] Search Username:', searchUsername);
      
      db.all(
        'SELECT * FROM users WHERE telegram_id = ? OR username LIKE ?',
        [searchId, searchUsername],
        (err, rows) => {
          if (err) {
            console.log('[SEARCH] Error:', err);
            reject(err);
          } else {
            console.log('[SEARCH] Found:', rows ? rows.length : 0, 'users');
            if (rows && rows.length > 0) {
              console.log('[SEARCH] Users:', JSON.stringify(rows));
            }
            resolve(rows || []);
          }
        }
      );
    });
  }
}
