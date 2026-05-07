# 🚀 دليل التشغيل السريع

## على الهاتف (Termux + PM2)

### 1. تثبيت Termux
حمّل من F-Droid: https://f-droid.org/en/packages/com.termux/

### 2. تثبيت الأدوات
```bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
npm install -g pm2
```

### 3. تحميل البوت
```bash
cd ~
git clone https://github.com/ma76111/refferal-bot.git
cd refferal-bot
npm install
```

### 4. إعداد البيئة
```bash
cp .env.example .env
nano .env
```
أضف:
```
BOT_TOKEN=your_token_here
ADMIN_IDS=8339087985
```

### 5. تشغيل البوت
```bash
pm2 start index.js --name "bot"
pm2 save
pm2 startup
```

### 6. مراقبة البوت
```bash
pm2 status
pm2 logs bot
```

---

## على الكمبيوتر

### 1. استنساخ المشروع
```bash
git clone https://github.com/ma76111/refferal-bot.git
cd refferal-bot
npm install
```

### 2. إعداد البيئة
أنشئ ملف `.env`:
```
BOT_TOKEN=your_token_here
ADMIN_IDS=8339087985
```

### 3. تشغيل البوت
```bash
# تشغيل عادي
node index.js

# أو باستخدام PM2
npm install -g pm2
pm2 start index.js --name "bot"
```

---

## أوامر مهمة

```bash
# عرض الحالة
pm2 status

# عرض السجلات
pm2 logs bot

# إعادة التشغيل
pm2 restart bot

# إيقاف البوت
pm2 stop bot

# تحديث من GitHub
git pull origin main
pm2 restart bot
```

---

## روابط مهمة

- 📖 [دليل التشغيل الكامل](DEPLOYMENT_GUIDE.md)
- 👥 [نظام إدارة الأدمنز](ADMIN_MANAGEMENT.md)
- 🚫 [نظام المخالفات](VIOLATION_SYSTEM.md)
- 🆕 [الميزات الجديدة](NEW_FEATURES.md)
- 🔗 [دليل التكامل](INTEGRATION_GUIDE.md)

---

**رابط المشروع:** https://github.com/ma76111/refferal-bot
