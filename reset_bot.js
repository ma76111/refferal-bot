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
console.log('║         🔄 سكريبت إعادة تعيين البوت بالكامل            ║');
console.log('║                    الإصدار 2.1                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  تحذير: هذا السكريبت سيحذف:\n');
console.log('   ❌ قاعدة البيانات (bot.db) - جميع الجداول');
console.log('      • المستخدمون والمهام');
console.log('      • الإثباتات والتقييمات');
console.log('      • الإيداعات والسحوبات');
console.log('      • المخالفات والحظر');
console.log('      • الرسائل الجماعية والاستئنافات');
console.log('   ❌ جميع ملفات السجلات (*.log)');
console.log('   ❌ ملفات التوثيق الإضافية');
console.log('   ❌ ملفات الاختبار والـ migration');
console.log('   ❌ ملفات مؤقتة أخرى\n');

console.log('✅ سيتم الاحتفاظ بـ:\n');
console.log('   ✓ الكود المصدري');
console.log('   ✓ ملف .env (الإعدادات)');
console.log('   ✓ ملف README.md');
console.log('   ✓ ملف VIOLATION_SYSTEM.md');
console.log('   ✓ ملف NEW_FEATURES.md');
console.log('   ✓ ملف INTEGRATION_GUIDE.md');
console.log('   ✓ ملف .gitignore\n');

rl.question('❓ هل أنت متأكد من إعادة تعيين البوت؟ (اكتب "نعم" للتأكيد): ', (answer) => {
  if (answer.toLowerCase() !== 'نعم' && answer.toLowerCase() !== 'yes') {
    console.log('\n❌ تم إلغاء العملية');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 بدء إعادة التعيين...\n');

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
  const logFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.log'));
  if (logFiles.length > 0) {
    logFiles.forEach(file => {
      fs.unlinkSync(path.join(__dirname, file));
      deletedCount++;
    });
    console.log(`✅ تم حذف ${logFiles.length} ملف سجلات`);
  } else {
    console.log('⚠️  لا توجد ملفات سجلات');
  }

  // 3. حذف ملفات التوثيق الإضافية (ما عدا الملفات المهمة)
  const keepMdFiles = [
    'README.md',
    'GITHUB_SETUP.md',
    'VIOLATION_SYSTEM.md',
    'NEW_FEATURES.md',
    'INTEGRATION_GUIDE.md'
  ];
  
  const mdFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.md') && !keepMdFiles.includes(file)
  );
  
  if (mdFiles.length > 0) {
    mdFiles.forEach(file => {
      fs.unlinkSync(path.join(__dirname, file));
      deletedCount++;
    });
    console.log(`✅ تم حذف ${mdFiles.length} ملف توثيق إضافي`);
  }

  // 4. حذف ملفات الـ migration
  const migrationFiles = fs.readdirSync(__dirname).filter(file => 
    file.startsWith('migrate_') && file.endsWith('.js')
  );
  if (migrationFiles.length > 0) {
    migrationFiles.forEach(file => {
      fs.unlinkSync(path.join(__dirname, file));
      deletedCount++;
    });
    console.log(`✅ تم حذف ${migrationFiles.length} ملف migration`);
  }

  // 5. حذف ملفات الاختبار
  const testFiles = [
    'test_admin.txt',
    'test_bot.js',
    'test_syntax.js',
    'PUSH_TO_GITHUB.txt'
  ];
  testFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ تم حذف ${file}`);
      deletedCount++;
    }
  });

  // 6. حذف ملف User_test.js إن وجد
  const userTestPath = path.join(__dirname, 'models', 'User_test.js');
  if (fs.existsSync(userTestPath)) {
    fs.unlinkSync(userTestPath);
    console.log('✅ تم حذف models/User_test.js');
    deletedCount++;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              🎉 تم إعادة التعيين بنجاح!                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 الإحصائيات:`);
  console.log(`   🗑️  تم حذف ${deletedCount} ملف\n`);

  console.log('📋 الخطوات التالية:\n');
  console.log('   1️⃣  تأكد من إعدادات ملف .env');
  console.log('   2️⃣  شغل البوت: node index.js');
  console.log('   3️⃣  سيتم إنشاء قاعدة بيانات جديدة تلقائياً');
  console.log('   4️⃣  البوت جاهز للاستخدام!\n');

  console.log('📚 الجداول التي سيتم إنشاؤها تلقائياً:\n');
  console.log('   ✓ users - المستخدمون');
  console.log('   ✓ tasks - المهام');
  console.log('   ✓ task_submissions - الإثباتات');
  console.log('   ✓ deposits - الإيداعات');
  console.log('   ✓ withdrawals - السحوبات');
  console.log('   ✓ reports - الإبلاغات');
  console.log('   ✓ violations - المخالفات');
  console.log('   ✓ bans - الحظر');
  console.log('   ✓ restrictions - التقييدات');
  console.log('   ✓ appeals - الاستئنافات');
  console.log('   ✓ ratings - التقييمات (جديد)');
  console.log('   ✓ broadcasts - الرسائل الجماعية (جديد)');
  console.log('   ✓ settings - الإعدادات');
  console.log('   ✓ hidden_tasks - المهام المخفية\n');

  console.log('💡 ملاحظة: يمكنك الآن البدء من جديد بدون أي بيانات قديمة\n');
  console.log('🎉 الإصدار 2.0 يتضمن:\n');
  console.log('   • نظام الإحصائيات 📊');
  console.log('   • نظام التقييمات ⭐');
  console.log('   • نظام الرسائل الجماعية 📢');
  console.log('   • نظام الاستئناف 📝');
  console.log('   • نظام المخالفات والحظر المتقدم 🚫');
  console.log('   • فحص الرصيد قبل إنشاء المهام المدفوعة 💰');
  console.log('   • قبول روابط الإحالة بمعاملات رقمية ✅\n');

  rl.close();
});
