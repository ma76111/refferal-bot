import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
const REPO = 'ma76111/Workers_bot_backups';
const DB_PATH = path.join(__dirname, 'bot.db');

function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'bot-backup',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function backupToGithub() {
  if (!GITHUB_TOKEN) {
    console.error('[BACKUP] GITHUB_BACKUP_TOKEN غير موجود في .env');
    return;
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error('[BACKUP] bot.db غير موجود');
    return;
  }

  try {
    const content = fs.readFileSync(DB_PATH).toString('base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `bot_${timestamp}.db`;
    const filePath = `/repos/${REPO}/contents/backups/${fileName}`;

    await githubRequest('PUT', filePath, {
      message: `backup: ${timestamp}`,
      content
    });

    console.log(`[BACKUP] ✅ تم الرفع إلى GitHub: ${fileName}`);

    // احذف النسخ القديمة (أكثر من 7 أيام)
    const listRes = await githubRequest('GET', `/repos/${REPO}/contents/backups`);
    if (listRes.status === 200 && Array.isArray(listRes.body)) {
      const week = 7 * 24 * 60 * 60 * 1000;
      const old = listRes.body.filter(f => {
        const match = f.name.match(/bot_(\d{4}-\d{2}-\d{2})/);
        if (!match) return false;
        return Date.now() - new Date(match[1]).getTime() > week;
      });
      for (const f of old) {
        await githubRequest('DELETE', `/repos/${REPO}/contents/backups/${f.name}`, {
          message: `cleanup: ${f.name}`,
          sha: f.sha
        });
      }
      if (old.length > 0) console.log(`[BACKUP] 🗑️ تم حذف ${old.length} نسخة قديمة`);
    }
  } catch (err) {
    console.error('[BACKUP] ❌ فشل الرفع:', err.message);
  }
}
