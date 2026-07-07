# Workers Bot - ملخص كامل للمشروع

## نظرة عامة

بوت تيليجرام لتبادل الإحالات والمهام المدفوعة، مع لوحة تحكم ويب كاملة.

---

## هيكل المشروع

```
allifiates-bot-fixed/
├── index.js                    # نقطة تشغيل البوت الرئيسية
├── database.js                 # إعداد SQLite + WAL mode + indexes
├── config.js                   # متغيرات البيئة
├── languages.js                # ترجمات (AR/EN/RU)
├── reset_bot.js                # سكريبت إعادة التعيين الكاملة
├── backup_to_github.js         # رفع backup لـ GitHub
├── ecosystem.config.cjs        # إعداد PM2
├── package.json
│
├── handlers/
│   ├── adminHandler.js         # معالجات لوحة تحكم البوت
│   ├── appealHandler.js        # معالجات الاستئنافات
│   ├── broadcastHandler.js     # معالجات الرسائل الجماعية
│   ├── depositHandler.js       # معالجات الإيداع
│   ├── ratingHandler.js        # معالجات التقييمات
│   ├── statisticsHandler.js    # معالجات الإحصائيات
│   ├── submissionHandler.js    # معالجات الإثباتات
│   ├── taskHandler.js          # معالجات المهام
│   └── withdrawalHandler.js    # معالجات السحوبات
│
├── models/
│   ├── Admin.js                # نموذج الأدمنز
│   ├── Appeal.js               # نموذج الاستئنافات
│   ├── Ban.js                  # نموذج الحظر
│   ├── Broadcast.js            # نموذج الرسائل الجماعية
│   ├── Deposit.js              # نموذج الإيداعات
│   ├── HiddenTask.js           # نموذج المهام المخفية
│   ├── Rating.js               # نموذج التقييمات
│   ├── Report.js               # نموذج الإبلاغات
│   ├── Restriction.js          # نموذج التقييدات
│   ├── Settings.js             # نموذج الإعدادات
│   ├── Statistics.js           # نموذج الإحصائيات
│   ├── Submission.js           # نموذج الإثباتات
│   ├── Task.js                 # نموذج المهام
│   ├── User.js                 # نموذج المستخدمين
│   ├── Violation.js            # نموذج المخالفات
│   └── Withdrawal.js           # نموذج السحوبات
│
├── utils/
│   ├── binanceApi.js           # تكامل Binance API
│   ├── keyboards.js            # لوحات مفاتيح تيليجرام
│   ├── logger.js               # نظام تسجيل الأحداث
│   └── violationSystem.js      # نظام المخالفات والعقوبات
│
└── web/
    ├── server/                 # Express API Server
    │   ├── index.js            # نقطة تشغيل السيرفر
    │   ├── auth.js             # JWT + Telegram auth verification
    │   ├── db.js               # اتصال SQLite (نفس bot.db)
    │   └── routes/
    │       ├── auth.js         # POST /api/auth/telegram
    │       ├── user.js         # GET /api/user/me, /stats
    │       ├── tasks.js        # GET /api/tasks, /mine, /submissions
    │       ├── wallet.js       # GET /api/wallet/deposits, /withdrawals
    │       ├── actions.js      # POST submit/hide/deposit/withdraw
    │       └── admin.js        # كل endpoints لوحة التحكم
    │
    └── client/                 # React + Vite Frontend
        └── src/
            ├── App.jsx         # Routing + ThemeProvider + AuthProvider
            ├── AuthContext.jsx # JWT authentication state
            ├── ThemeContext.jsx # Dark/Light theme
            ├── Layout.jsx      # Topbar + Sidebar
            ├── api.js          # Axios instance
            └── pages/
                ├── Login.jsx       # Telegram Login Widget + robot animation
                ├── Dashboard.jsx   # إحصائيات + Telegram ID مع نسخ
                ├── Tasks.jsx       # المهام المتاحة + تقديم إثبات
                ├── MyTasks.jsx     # مهامي
                ├── Submissions.jsx # إثباتاتي
                ├── Wallet.jsx      # إيداع + سحب + تاريخ المعاملات
                └── Admin.jsx       # لوحة التحكم الكاملة
```

---

## قاعدة البيانات (SQLite - bot.db)

### الجداول

| الجدول | الوصف |
|--------|-------|
| users | المستخدمون + رصيد + نقاط المقايضة + حالة الحظر |
| tasks | المهام (مدفوعة / تبادل) |
| task_submissions | الإثباتات المقدمة |
| deposits | طلبات الإيداع |
| withdrawals | طلبات السحب |
| bans | سجل الحظر |
| restrictions | تقييدات المستخدمين |
| violations | نقاط المخالفات |
| reports | الإبلاغات |
| appeals | الاستئنافات |
| ratings | تقييمات المستخدمين |
| broadcasts | الرسائل الجماعية |
| admins | الأدمنز الثانويين |
| settings | إعدادات البوت |
| hidden_tasks | المهام المخفية لكل مستخدم |

### تحسينات الأداء
- WAL mode لحماية البيانات من الانقطاع المفاجئ
- PRAGMA cache_size=10000 + temp_store=MEMORY
- Indexes على: tasks(status), task_submissions(user_id, task_id), hidden_tasks(user_id), users(telegram_id)
- استبدال NOT IN subqueries بـ LEFT JOIN لتسريع الـ queries

---

## ميزات البوت (تيليجرام)

### للمستخدمين
- تسجيل تلقائي عند /start
- دعم 3 لغات: العربية، الإنجليزية، الروسية
- إضافة مهام (مدفوعة أو تبادل إحالات)
- تنفيذ مهام الآخرين وتقديم إثبات (نص/صور/كليهما)
- إيداع USDT عبر Binance Pay ID
- سحب USDT
- تقييم المستخدمين بعد إتمام المهمة
- استئناف قرار الحظر
- نظام نقاط المقايضة

### للأدمن
- **مراجعة الإثباتات**: قبول / رفض مع فرصة ثانية / رفض نهائي
- **مراجعة الإيداعات**: قبول (يضيف رصيد) / رفض
- **مراجعة السحوبات**: إتمام / رفض (يعيد الرصيد)
- **إدارة الاستئنافات**: قبول (يرفع الحظر) / رفض
- **البحث عن مستخدم**: بالـ ID أو اليوزرنيم
- **تعديل الرصيد ونقاط المقايضة**
- **حظر مستخدم** (مؤقت/دائم) / رفع الحظر
- **إدارة المخالفات**: عرض / حذف / إعادة ضبط
- **الإبلاغات المعلقة**: قبول / رفض
- **إضافة تقييدات**: منع مهام / منع سحب / منع إبلاغ
- **إحصائيات شاملة**
- **رسائل جماعية** لكل المستخدمين أو فئة محددة
- **إدارة الأدمنز الثانويين** (إضافة/إزالة)
- **حذف مهمة** مع إرجاع الرصيد أو النقاط
- **إعدادات البوت**: حد الأشخاص، المكافآت، الحد الأدنى للسحب، إلخ

---

## نظام المخالفات والعقوبات

| النقاط | العقوبة |
|--------|---------|
| 3-4 | تحذير أول |
| 5-7 | تقييد |
| 8-10 | حظر مؤقت 3 أيام |
| 11-14 | حظر مؤقت 7 أيام |
| 15+ | حظر دائم |

### أنواع المخالفات
- تلقي إبلاغ (1 نقطة)
- رفض إثبات نهائي (2 نقطة)
- إرسال إبلاغات سبام (3 نقاط)
- إنشاء مهمة وهمية (4 نقاط)
- محاولة احتيال (5 نقاط)
- استخدام حسابات متعددة (10 نقاط)

---

## لوحة التحكم الويب

### المصادقة
- Telegram Login Widget
- التحقق من صحة البيانات بـ HMAC-SHA256
- JWT tokens صالحة لـ 7 أيام

### الصفحات
| الصفحة | الوصف |
|--------|-------|
| Login | تسجيل دخول عبر تيليجرام مع animation روبوت |
| Dashboard | الرصيد + نقاط المقايضة + إحصائيات + Telegram ID مع نسخ |
| Tasks | المهام المتاحة + تقديم إثبات + إخفاء مهمة |
| My Tasks | مهامي مع عدد المقبولين والمعلقين |
| Submissions | إثباتاتي مع حالة كل إثبات |
| Wallet | إيداع + سحب + تاريخ المعاملات |
| Admin | لوحة تحكم كاملة (للأدمن فقط) |

### لوحة التحكم (Admin Panel) - Tabs
1. **📊 إحصائيات** - إجمالي المستخدمين، المهام، الأرصدة، الطلبات المعلقة
2. **💵 إيداعات** - مراجعة وقبول/رفض الإيداعات
3. **💸 سحوبات** - مراجعة وإتمام/رفض السحوبات (مع إعادة الرصيد)
4. **✅ إثباتات** - مراجعة وقبول/رفض إثباتات المهام
5. **📋 استئنافات** - مراجعة وقبول/رفض الاستئنافات
6. **🚫 محظورون** - عرض المحظورين ورفع الحظر
7. **⚙️ إعدادات** - تعديل إعدادات البوت مباشرة
8. **🔍 مستخدم** - بحث + تعديل رصيد/نقاط/حظر

---

## نظام Backup

### محلي (كل 30 دقيقة)
- نسخ `bot.db` إلى مجلد `backups/`
- يحتفظ بآخر 48 نسخة (يوم كامل)

### GitHub (كل 24 ساعة)
- رفع نسخة لـ `ma76111/Workers_bot_backups`
- يحتفظ بآخر 7 أيام
- رفع فوري عند بدء التشغيل

---

## التشغيل

### أوامر التشغيل
```bash
# تشغيل البوت + web server
npm run launch

# تشغيل البوت فقط
npm start

# إعادة تعيين كامل (حذف قاعدة البيانات)
node reset_bot.js
```

### Localtonet Tunnel
- شغّل تطبيق Localtonet وسجّل دخول
- الـ URL الثابت: `ugzx5pfvnb.localto.net`
- بعدها اضبط في BotFather: `/setdomain`

### متغيرات البيئة (.env)
```
BOT_TOKEN=                    # توكن البوت من BotFather
MAIN_ADMIN_ID=                # Telegram ID للأدمن الرئيسي
ADMIN_IDS=                    # IDs الأدمنز (مفصولة بفاصلة)
GITHUB_BACKUP_TOKEN=          # GitHub Personal Access Token للـ backup
BINANCE_API_KEY=              # مفتاح Binance API (اختياري)
BINANCE_API_SECRET=           # سر Binance API (اختياري)
```

### web/server/.env
```
BOT_TOKEN=                    # نفس توكن البوت
JWT_SECRET=                   # سر توليد JWT tokens
WEB_PORT=3001                 # منفذ الـ web server
```

### web/client/.env
```
VITE_BOT_NAME=                # اسم البوت (بدون @)
```

---

## التطويرات على مر المشروع

### المرحلة الأولى - الإعداد والتشغيل
- تشغيل البوت + web server + Vite client
- حل مشكلة `allowedHosts` في Vite
- تشغيل tunnels (serveo → ngrok → cloudflare → localtonet)

### المرحلة الثانية - تحسينات البوت
- تغيير "نقاط التبادل" إلى "نقاط المقايضة" في كل الملفات
- إضافة WAL mode لحماية البيانات
- إضافة Backup محلي كل 30 دقيقة
- إضافة Backup تلقائي لـ GitHub كل 24 ساعة
- تحديث `reset_bot.js` لحذف الـ backups أيضاً
- حذف 15 ملف غير ضروري (MD files، scripts قديمة)

### المرحلة الثالثة - تطوير لوحة التحكم في البوت
- إضافة إدارة المخالفات (عرض/حذف/إعادة ضبط)
- إضافة عرض المحظورين مع رفع الحظر
- إضافة إدارة الإبلاغات المعلقة (قبول/رفض)
- إضافة إضافة تقييدات للمستخدمين
- ربط الـ callbacks الجديدة في index.js

### المرحلة الرابعة - تطوير الواجهة الويب
- إضافة ThemeContext (Dark/Light mode)
- إضافة زر تبديل المظهر في الـ topbar
- إضافة صفحة Admin محمية (AdminOnly route)
- إضافة Telegram ID في Dashboard مع زرار نسخ
- تصميم واجهة تسجيل جديدة مع robot animation (SVG → PNG → WebM)
- إضافة particles animation في صفحة Login

### المرحلة الخامسة - لوحة التحكم الويب الكاملة
- إنشاء `/api/admin` routes شاملة
- إنشاء `/api/actions` routes للعمليات
- فتح DB للكتابة (كان READONLY)
- ربط كل العمليات: إيداعات، سحوبات، إثباتات، استئنافات، حظر، إعدادات، بحث
- Admin panel بـ 8 tabs كاملة وظيفياً

### المرحلة السادسة - تحسين الأداء
- استبدال `NOT IN (subquery)` بـ `LEFT JOIN` في tasks query
- إضافة SQLite indexes على الأعمدة المهمة
- إضافة PRAGMA cache_size وtemp_store لتسريع SQLite
- حل مشكلة duplicate imports في web server

---

## API Endpoints

### Public
| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | /api/auth/telegram | تسجيل دخول عبر تيليجرام |

### Authenticated
| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | /api/user/me | بيانات المستخدم |
| GET | /api/user/stats | إحصائيات المستخدم |
| GET | /api/tasks | المهام المتاحة |
| GET | /api/tasks/mine | مهامي |
| GET | /api/tasks/submissions | إثباتاتي |
| POST | /api/tasks/:id/submit | تقديم إثبات |
| POST | /api/tasks/:id/hide | إخفاء مهمة |
| GET | /api/wallet/deposits | تاريخ الإيداعات |
| GET | /api/wallet/withdrawals | تاريخ السحوبات |
| POST | /api/wallet/deposit | طلب إيداع |
| POST | /api/wallet/withdraw | طلب سحب |

### Admin Only
| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | /api/admin/stats | إحصائيات شاملة |
| GET | /api/admin/users/search | بحث عن مستخدم |
| POST | /api/admin/users/:id/balance | تعديل رصيد |
| POST | /api/admin/users/:id/points | تعديل نقاط |
| POST | /api/admin/users/:id/ban | حظر |
| POST | /api/admin/users/:id/unban | رفع حظر |
| GET | /api/admin/deposits | الإيداعات المعلقة |
| POST | /api/admin/deposits/:id/accept | قبول إيداع |
| POST | /api/admin/deposits/:id/reject | رفض إيداع |
| GET | /api/admin/withdrawals | السحوبات المعلقة |
| POST | /api/admin/withdrawals/:id/complete | إتمام سحب |
| POST | /api/admin/withdrawals/:id/reject | رفض سحب |
| GET | /api/admin/submissions | الإثباتات المعلقة |
| POST | /api/admin/submissions/:id/accept | قبول إثبات |
| POST | /api/admin/submissions/:id/reject | رفض إثبات |
| GET | /api/admin/appeals | الاستئنافات المعلقة |
| POST | /api/admin/appeals/:id/approve | قبول استئناف |
| POST | /api/admin/appeals/:id/reject | رفض استئناف |
| GET | /api/admin/bans | المحظورون النشطون |
| GET | /api/admin/reports | الإبلاغات المعلقة |
| GET | /api/admin/settings | الإعدادات |
| POST | /api/admin/settings | تحديث إعداد |
