import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         🔄 سكريبت إعادة تعيين البوت بالكامل             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  سيتم حذف كل البيانات:\n');
console.log('   ❌ قاعدة البيانات (bot.db) - كل المستخدمين والمهام والبيانات');
console.log('   ❌ ملفات السجلات (*.log)\n');
console.log('✅ سيتم الاحتفاظ بكل الكود والإعدادات\n');

rl.question('❓ هل أنت متأكد؟ (اكتب "نعم" للتأكيد): ', (answer) => {
  if (answer.toLowerCase() !== 'نعم' && answer.toLowerCase() !== 'yes') {
    console.log('\n❌ تم إلغاء العملية');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 جاري إعادة التعيين...\n');

  let deletedCount = 0;

  // 1. حذف قاعدة البيانات
  const dbPath = path.join(__dirname, 'bot.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ تم حذف قاعدة البيانات (bot.db)');
    deletedCount++;
  } else {
    console.log('⚠️  قاعدة البيانات غير موجودة');
  }

  // 2. حذف ملفات السجلات
  const logFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.log'));
  logFiles.forEach(file => {
    fs.unlinkSync(path.join(__dirname, file));
    deletedCount++;
  });
  if (logFiles.length > 0) console.log(`✅ تم حذف ${logFiles.length} ملف سجلات`);

  // 3. حذف نسخ الـ backup
  const backupDir = path.join(__dirname, 'backups');
  if (fs.existsSync(backupDir)) {
    const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    backups.forEach(f => {
      fs.unlinkSync(path.join(backupDir, f));
      deletedCount++;
    });
    if (backups.length > 0) console.log(`✅ تم حذف ${backups.length} نسخة backup`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ تم إعادة التعيين بنجاح!                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`🗑️  تم حذف ${deletedCount} ملف\n`);
  console.log('📋 الخطوات التالية:');
  console.log('   1️⃣  شغّل البوت: node index.js');
  console.log('   2️⃣  سيتم إنشاء قاعدة بيانات جديدة فارغة تلقائياً');
  console.log('   3️⃣  البوت جاهز كأنه جديد تماماً!\n');

  rl.close();
});
