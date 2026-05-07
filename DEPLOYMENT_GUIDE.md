# 📱 دليل تشغيل البوت على الهاتف باستخدام PM2

## المتطلبات الأساسية

### 1. تطبيق Termux
- حمّل تطبيق **Termux** من F-Droid (ليس من Google Play)
- رابط التحميل: https://f-droid.org/en/packages/com.termux/

### 2. تثبيت الأدوات الأساسية

افتح Termux وقم بتنفيذ الأوامر التالية:

```bash
# تحديث الحزم
pkg update && pkg upgrade -y

# تثبيت Git
pkg install git -y

# تثبيت Node.js و npm
pkg install nodejs -y

# التحقق من التثبيت
node --version
npm --version
```

---

## 📥 تحميل البوت من GitHub

### 1. استنساخ المشروع
```bash
# الانتقال إلى المجلد الرئيسي
cd ~

# استنساخ المشروع (استبدل YOUR_USERNAME باسم المستخدم الخاص بك)
git clone https://github.com/YOUR_USERNAME/allifiates-bot.git

# الدخول إلى مجلد المشروع
cd allifiates-bot
```

### 2. تثبيت الحزم
```bash
npm install
```

---

## ⚙️ إعداد البوت

### 1. إنشاء ملف البيئة
```bash
# نسخ ملف المثال
cp .env.example .env

# تعديل الملف
nano .env
```

### 2. إضافة البيانات المطلوبة
```env
BOT_TOKEN=your_bot_token_here
ADMIN_IDS=8339087985
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
```

**للحفظ في nano:**
- اضغط `Ctrl + X`
- اضغط `Y`
- اضغط `Enter`

### 3. تهيئة قاعدة البيانات
```bash
# تشغيل سكريبت إعادة التعيين (اختياري - فقط للمرة الأولى)
node reset_bot.js
```

---

## 🚀 تثبيت وتشغيل PM2

### 1. تثبيت PM2
```bash
npm install -g pm2
```

### 2. تشغيل البوت باستخدام PM2
```bash
# تشغيل البوت
pm2 start index.js --name "affiliates-bot"

# حفظ قائمة العمليات
pm2 save

# تفعيل التشغيل التلقائي عند إعادة التشغيل
pm2 startup
```

---

## 📊 أوامر إدارة PM2

### عرض حالة البوت
```bash
pm2 status
```

### عرض السجلات (Logs)
```bash
# عرض جميع السجلات
pm2 logs

# عرض سجلات البوت فقط
pm2 logs affiliates-bot

# عرض آخر 100 سطر
pm2 logs affiliates-bot --lines 100
```

### إيقاف البوت
```bash
pm2 stop affiliates-bot
```

### إعادة تشغيل البوت
```bash
pm2 restart affiliates-bot
```

### حذف البوت من PM2
```bash
pm2 delete affiliates-bot
```

### إعادة تحميل البوت (بدون توقف)
```bash
pm2 reload affiliates-bot
```

---

## 🔄 تحديث البوت

عندما تريد تحديث البوت من GitHub:

```bash
# الانتقال إلى مجلد المشروع
cd ~/allifiates-bot

# إيقاف البوت
pm2 stop affiliates-bot

# سحب آخر التحديثات
git pull origin main

# تثبيت الحزم الجديدة (إن وجدت)
npm install

# إعادة تشغيل البوت
pm2 restart affiliates-bot
```

---

## 🔧 حل المشاكل الشائعة

### المشكلة: البوت لا يعمل بعد إعادة تشغيل الهاتف
**الحل:**
```bash
# تفعيل التشغيل التلقائي
pm2 startup
pm2 save
```

### المشكلة: خطأ في الاتصال بقاعدة البيانات
**الحل:**
```bash
# التأكد من وجود ملف قاعدة البيانات
ls -la bot.db

# إذا لم يكن موجوداً، قم بتشغيل:
node reset_bot.js
```

### المشكلة: البوت يتوقف بشكل متكرر
**الحل:**
```bash
# عرض السجلات لمعرفة السبب
pm2 logs affiliates-bot --lines 50

# إعادة تشغيل البوت مع زيادة الذاكرة
pm2 delete affiliates-bot
pm2 start index.js --name "affiliates-bot" --max-memory-restart 300M
```

### المشكلة: Termux يغلق تلقائياً
**الحل:**
- افتح إعدادات الهاتف
- ابحث عن "Battery Optimization" أو "توفير الطاقة"
- أضف Termux إلى قائمة الاستثناءات
- فعّل "Run in background" لـ Termux

---

## 📱 نصائح للتشغيل على الهاتف

### 1. منع إغلاق Termux
```bash
# تشغيل Termux في الخلفية
termux-wake-lock
```

### 2. مراقبة استهلاك الموارد
```bash
# عرض استهلاك الذاكرة والمعالج
pm2 monit
```

### 3. تقليل استهلاك البطارية
```bash
# تقليل تكرار التحديثات في PM2
pm2 set pm2:autodump false
```

### 4. النسخ الاحتياطي لقاعدة البيانات
```bash
# إنشاء نسخة احتياطية
cp bot.db bot.db.backup

# جدولة نسخ احتياطي يومي
pm2 install pm2-logrotate
```

---

## 🌐 الوصول عن بُعد (اختياري)

إذا أردت الوصول إلى البوت من جهاز آخر:

### 1. تثبيت PM2 Web Interface
```bash
pm2 install pm2-server-monit
```

### 2. استخدام Ngrok للوصول عن بُعد
```bash
# تثبيت ngrok
pkg install wget -y
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-arm.zip
unzip ngrok-stable-linux-arm.zip
./ngrok authtoken YOUR_NGROK_TOKEN
```

---

## 📋 قائمة التحقق السريعة

- [ ] تثبيت Termux من F-Droid
- [ ] تثبيت Node.js و Git
- [ ] استنساخ المشروع من GitHub
- [ ] تثبيت الحزم (`npm install`)
- [ ] إنشاء ملف `.env` وإضافة البيانات
- [ ] تثبيت PM2 (`npm install -g pm2`)
- [ ] تشغيل البوت (`pm2 start index.js --name "affiliates-bot"`)
- [ ] حفظ الإعدادات (`pm2 save`)
- [ ] تفعيل التشغيل التلقائي (`pm2 startup`)
- [ ] إضافة Termux إلى استثناءات توفير الطاقة

---

## 🆘 الدعم

إذا واجهت أي مشكلة:

1. **تحقق من السجلات:**
   ```bash
   pm2 logs affiliates-bot --lines 100
   ```

2. **أعد تشغيل البوت:**
   ```bash
   pm2 restart affiliates-bot
   ```

3. **تحقق من حالة PM2:**
   ```bash
   pm2 status
   ```

4. **تحقق من اتصال الإنترنت:**
   ```bash
   ping -c 4 google.com
   ```

---

## 📝 ملاحظات مهمة

1. **احتفظ بالهاتف متصلاً بالإنترنت** - البوت يحتاج اتصال دائم
2. **لا تغلق Termux** - اتركه يعمل في الخلفية
3. **راقب استهلاك البطارية** - قد تحتاج لشحن الهاتف بشكل متكرر
4. **النسخ الاحتياطي المنتظم** - احفظ نسخة من `bot.db` بانتظام
5. **تحديثات منتظمة** - اسحب آخر التحديثات من GitHub أسبوعياً

---

## 🎯 الخلاصة

بعد اتباع هذه الخطوات، سيكون البوت يعمل على هاتفك 24/7 باستخدام PM2!

**للتحقق من أن كل شيء يعمل:**
```bash
pm2 status
pm2 logs affiliates-bot --lines 20
```

يجب أن ترى رسالة: `🤖 البوت يعمل الآن...`

---

**تاريخ آخر تحديث:** 2026-05-07
**الإصدار:** 1.0
