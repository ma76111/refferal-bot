import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 بدء إعادة تعيين البوت...\n');

// 1. حذف قاعدة البيانات
const dbPath = path.join(__dirname, 'bot.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ تم حذف قاعدة البيانات');
} else {
  console.log('⚠️ قاعدة البيانات غير موجودة');
}

// 2. حذف ملفات التوثيق .md (ما عدا README.md)
const mdFiles = fs.readdirSync(__dirname).filter(file => 
  file.endsWith('.md') && file !== 'README.md' && file !== 'README_AR.md'
);

if (mdFiles.length > 0) {
  mdFiles.forEach(file => {
    fs.unlinkSync(path.join(__dirname, file));
  });
  console.log(`✅ تم حذف ${mdFiles.length} ملف توثيق`);
} else {
  console.log('⚠️ لا توجد ملفات توثيق للحذف');
}

// 3. حذف ملفات الـ migration القديمة
const migrationFiles = fs.readdirSync(__dirname).filter(file => 
  file.startsWith('migrate_') && file.endsWith('.js')
);

if (migrationFiles.length > 0) {
  migrationFiles.forEach(file => {
    fs.unlinkSync(path.join(__dirname, file));
  });
  console.log(`✅ تم حذف ${migrationFiles.length} ملف migration`);
} else {
  console.log('⚠️ لا توجد ملفات migration للحذف');
}

// 4. حذف ملف test_admin.txt إن وجد
const testAdminPath = path.join(__dirname, 'test_admin.txt');
if (fs.existsSync(testAdminPath)) {
  fs.unlinkSync(testAdminPath);
  console.log('✅ تم حذف ملف test_admin.txt');
}

console.log('\n🎉 تم إعادة تعيين البوت بنجاح!\n');
console.log('📋 الخطوات التالية:');
console.log('   1. شغل البوت: node index.js');
console.log('   2. سيتم إنشاء قاعدة بيانات جديدة تلقائياً');
console.log('   3. البوت جاهز للاستخدام!\n');
