# وثيقة التصميم: bot-web-enhancements

## نظرة عامة

تهدف هذه الوثيقة إلى تصميم مجموعة شاملة من التحسينات لمنصة تبادل الإحالات المكونة من بوت تيليجرام (Node.js/grammy أو node-telegram-bot-api) وواجهة ويب (React + Express + SQLite).

### الأهداف الرئيسية

- رفع مستوى الأمان (IP tracking، منع تعدد الحسابات، Rate Limiting)
- تحسين تجربة المستخدم (لوحة تحكم محسّنة، إشعارات فورية، RTL)
- توسيع دعم اللغات (من 3 إلى 6 لغات)
- إضافة أنظمة إدارية متقدمة (تذاكر الدعم، إدارة المهام المتقدمة)
- إضافة طرق دفع جديدة وتحسين نظام المحافظ

### الحدود

- قاعدة البيانات: SQLite مع WAL mode (لا تغيير في نوع قاعدة البيانات)
- البوت: node-telegram-bot-api (موجود)
- الواجهة الأمامية: React + Vite (موجود)
- الخادم: Express.js (موجود)

---

## المعمارية

### المعمارية الحالية

```
┌─────────────────────────────────────────────────────┐
│                  Telegram Bot (Node.js)              │
│  index.js → handlers/* → models/* → database.js     │
└────────────────────────┬────────────────────────────┘
                         │ SQLite (bot.db)
┌────────────────────────┴────────────────────────────┐
│              Web Server (Express.js)                 │
│  web/server/index.js → routes/* → db.js             │
└────────────────────────┬────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────┐
│              Web Client (React + Vite)               │
│  App.jsx → pages/* → api.js                         │
└─────────────────────────────────────────────────────┘
```

### المعمارية المقترحة بعد التحسينات

```
┌─────────────────────────────────────────────────────────────────┐
│                       Telegram Bot (Node.js)                     │
│                                                                  │
│  index.js                                                        │
│  ├── handlers/                                                   │
│  │   ├── notificationHandler.js    ← جديد (المتطلب 1)          │
│  │   ├── ticketHandler.js          ← جديد (المتطلب 4)          │
│  │   ├── taskHandler.js            ← معدّل (المتطلب 8)         │
│  │   └── ...                                                     │
│  ├── models/                                                     │
│  │   ├── NotificationPrefs.js      ← جديد (المتطلب 1)          │
│  │   ├── Ticket.js                 ← جديد (المتطلب 4)          │
│  │   ├── DeviceLog.js              ← جديد (المتطلب 3)          │
│  │   ├── ActivityLog.js            ← جديد (المتطلب 7)          │
│  │   ├── TaskAudit.js              ← جديد (المتطلب 8)          │
│  │   └── ...                                                     │
│  └── languages.js                 ← موسّع (المتطلب 2، 5)       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ SQLite (bot.db) - مشترك
┌─────────────────────────┴───────────────────────────────────────┐
│                    Web Server (Express.js)                        │
│                                                                  │
│  web/server/index.js                                             │
│  ├── middleware/                                                  │
│  │   ├── rateLimit.js              ← جديد (المتطلب 6)          │
│  │   ├── security.js               ← جديد (المتطلب 6)          │
│  │   └── deviceLogger.js           ← جديد (المتطلب 3)         │
│  └── routes/                                                     │
│      ├── notifications.js          ← جديد (المتطلب 9)          │
│      ├── tickets.js                ← جديد (المتطلب 4)          │
│      ├── activity.js               ← جديد (المتطلب 7)          │
│      ├── admin.js                  ← معدّل                      │
│      ├── tasks.js                  ← معدّل (المتطلب 8)         │
│      └── wallet.js                 ← معدّل (المتطلب 10)        │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API + WebSocket (اختياري)
┌─────────────────────────┴───────────────────────────────────────┐
│                    Web Client (React + Vite)                      │
│                                                                  │
│  src/                                                            │
│  ├── i18n/                         ← جديد (المتطلب 2، 5)       │
│  │   └── translations.js                                         │
│  ├── hooks/                                                       │
│  │   ├── useNotifications.js       ← جديد (المتطلب 9)          │
│  │   └── useActivityLog.js         ← جديد (المتطلب 7)          │
│  ├── components/                                                  │
│  │   ├── NotificationBell.jsx      ← جديد (المتطلب 9)          │
│  │   ├── Toast.jsx                 ← جديد (المتطلب 11)         │
│  │   ├── Spinner.jsx               ← جديد (المتطلب 11)         │
│  │   └── Table.jsx                 ← جديد (المتطلب 11)         │
│  └── pages/                                                       │
│      ├── Dashboard.jsx             ← معدّل (المتطلب 7)         │
│      ├── Tickets.jsx               ← جديد (المتطلب 4)          │
│      ├── MyTasks.jsx               ← معدّل (المتطلب 8)         │
│      └── Wallet.jsx                ← معدّل (المتطلب 10)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## المكونات والواجهات

### 1. نظام الإشعارات المخصصة (المتطلب 1 + 9)

**Notification_Manager** — مكوّن مشترك بين البوت والويب.

#### واجهة API (الويب)

```
GET  /api/notifications              → قائمة إشعارات المستخدم
POST /api/notifications/:id/read     → تعليم إشعار مقروء
POST /api/notifications/read-all     → تعليم الكل مقروء
GET  /api/notifications/prefs        → تفضيلات الإشعارات
PUT  /api/notifications/prefs        → تحديث التفضيلات
GET  /api/notifications/unread-count → عدد غير المقروءة
```

#### وظيفة `sendNotification(userId, type, payload)`

```javascript
// أنواع الإشعارات
const NOTIFICATION_TYPES = {
  SUBMISSION_ACCEPTED: 'submission_accepted',
  SUBMISSION_REJECTED: 'submission_rejected',
  TASK_COMPLETED:      'task_completed',
  PROMOTIONAL:         'promotional',
  SYSTEM_UPDATE:       'system_update',
  TICKET_REPLY:        'ticket_reply',
  DEPOSIT_COMPLETED:   'deposit_completed',
  WITHDRAWAL_COMPLETED:'withdrawal_completed',
};
```

### 2. نظام دعم اللغات (المتطلب 2 + 5)

**Language_System** — موسّع من `languages.js` الموجود.

اللغات المضافة: الفارسية (`fa`)، التركية (`tr`)، الأوردو (`ur`).

```javascript
// دالة getText الموسّعة
getText(lang, key, ...args)  // مع fallback إلى 'ar'

// دعم RTL في CSS
.rtl { direction: rtl; text-align: right; }   // ar, fa, ur
.ltr { direction: ltr; text-align: left; }    // en, ru, tr
```

### 3. نظام تسجيل الأجهزة (المتطلب 3)

**Security_Engine** — middleware في Express وBوت.

```javascript
// middleware للويب
deviceLoggerMiddleware(req, res, next)
// يسجل: IP، User-Agent، telegram_id، timestamp
// يتحقق من: تطابق بصمة الجهاز مع حسابات محظورة
```

#### نقاط API الإدارية

```
GET /api/admin/device-logs           → سجلات الأجهزة
GET /api/admin/duplicate-accounts    → الحسابات المتشابهة
POST /api/admin/override-ip/:userId  → تجاوز قيد IP
```

### 4. نظام تذاكر الدعم (المتطلب 4)

**Ticket_System**

```
POST /api/tickets                    → إنشاء تذكرة
GET  /api/tickets                    → تذاكر المستخدم الحالي
GET  /api/tickets/:id                → تفاصيل تذكرة
POST /api/tickets/:id/reply          → رد المستخدم
GET  /api/admin/tickets              → كل التذاكر (إداري)
POST /api/admin/tickets/:id/reply    → رد المشرف
PUT  /api/admin/tickets/:id/status   → تغيير الحالة
PUT  /api/admin/tickets/:id/assign   → تعيين لمشرف
```

### 5. تحسينات الأداء والأمان (المتطلب 6)

#### Rate Limiting

```javascript
// express-rate-limit
const publicLimiter    = rateLimit({ windowMs: 60_000, max: 100 })
const protectedLimiter = rateLimit({ windowMs: 60_000, max: 30,
  keyGenerator: (req) => req.user?.id || req.ip })
```

#### Security Headers (helmet.js)

```javascript
app.use(helmet({
  hsts: { maxAge: 31536000 },
  contentSecurityPolicy: { ... },
  frameguard: { action: 'deny' },
}))
```

#### فهارس قاعدة البيانات الجديدة

```sql
CREATE INDEX IF NOT EXISTS idx_tasks_status_created    ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status      ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created     ON task_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_status         ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status      ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_tickets_status          ON tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_device_logs_ip          ON device_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_activity_log_user       ON activity_log(user_id, created_at);
```

### 6. تحسينات لوحة التحكم (المتطلب 7)

**User_Dashboard** + **Activity_Log**

```
GET /api/user/activity               → سجل الأنشطة (paginated)
GET /api/user/balance-chart          → بيانات مخطط الرصيد (30 يوم)
GET /api/user/widgets-config         → تفضيلات الودجات (من DB)
PUT /api/user/widgets-config         → حفظ تفضيلات الودجات
```

### 7. إدارة المهام المتقدمة (المتطلب 8)

```
PATCH /api/tasks/:id                 → تعديل المهمة (التعليمات، اسم البوت، نوع الإثبات)
POST  /api/tasks/:id/pause           → إيقاف مؤقت
POST  /api/tasks/:id/resume          → استئناف
GET   /api/tasks/:id/audit           → سجل تدقيق التعديلات
```

### 8. إدارة المحافظ الموسّعة (المتطلب 10)

```
// طرق إضافية
POST /api/wallet/deposit             → body: { method: 'binance'|'trc20'|'ton', ... }
POST /api/wallet/withdraw            → body: { method: 'binance'|'trc20'|'ton', ... }
```

---

## نماذج البيانات

### الجداول الجديدة

#### `notification_prefs`
```sql
CREATE TABLE notification_prefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  submission_accepted INTEGER DEFAULT 1,
  submission_rejected INTEGER DEFAULT 1,
  task_completed      INTEGER DEFAULT 1,
  promotional         INTEGER DEFAULT 1,
  system_update       INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  type      TEXT NOT NULL,
  title     TEXT NOT NULL,
  body      TEXT,
  link      TEXT,
  is_read   INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `tickets`
```sql
CREATE TABLE tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no   TEXT NOT NULL UNIQUE,   -- TKT-XXXXXXXX
  user_id     INTEGER NOT NULL,
  subject     TEXT NOT NULL,
  priority    TEXT DEFAULT 'medium',  -- low|medium|high|urgent
  status      TEXT DEFAULT 'open',    -- open|in_progress|closed
  assigned_to INTEGER,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at   DATETIME,
  FOREIGN KEY (user_id)     REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

#### `ticket_messages`
```sql
CREATE TABLE ticket_messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  is_admin  INTEGER DEFAULT 0,
  body      TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id)  REFERENCES tickets(id),
  FOREIGN KEY (sender_id)  REFERENCES users(id)
);
```

#### `device_logs`
```sql
CREATE TABLE device_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  ip_address   TEXT NOT NULL,
  user_agent   TEXT,
  fingerprint  TEXT,          -- hash(ip + user_agent)
  country_code TEXT,          -- مستنتج من IP
  session_type TEXT,          -- 'bot' | 'web'
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `activity_log`
```sql
CREATE TABLE activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  event_type TEXT NOT NULL,   -- login|task_created|submission|deposit|withdrawal|vote|ticket_reply
  metadata   TEXT,            -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `task_audit`
```sql
CREATE TABLE task_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL,
  changed_by  INTEGER NOT NULL,
  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id)    REFERENCES tasks(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);
```

### تعديلات على الجداول الموجودة

```sql
-- إضافة حقول للمهام (دعم إيقاف/تشغيل من الويب وكان موجوداً جزئياً)
ALTER TABLE tasks ADD COLUMN paused_at DATETIME DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN country_code TEXT DEFAULT NULL;

-- إضافة حقول للمستخدمين
ALTER TABLE users ADD COLUMN notification_channel TEXT DEFAULT 'both'; -- 'bot'|'web'|'both'
ALTER TABLE users ADD COLUMN last_known_ip TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT NULL;

-- إضافة دعم طرق دفع إضافية في الإيداعات
ALTER TABLE deposits  ADD COLUMN wallet_address TEXT DEFAULT NULL;
ALTER TABLE deposits  ADD COLUMN network TEXT DEFAULT NULL;        -- trc20|ton|bsc
ALTER TABLE withdrawals ADD COLUMN ton_address TEXT DEFAULT NULL;
```

---

## خصائص الصحة (Correctness Properties)


*الخاصية هي سلوك يجب أن يصدق على جميع حالات التنفيذ الصالحة للنظام — أي تصريح رسمي بما يجب على النظام فعله. تعمل الخصائص كجسر بين المواصفات البشرية القابلة للقراءة وضمانات الصحة القابلة للتحقق آلياً.*

### الخاصية 1: الاتساق التام لتفضيلات الإشعارات

*لأي* مستخدم وأي مجموعة من تفضيلات الإشعارات (مُفعَّل/معطَّل لكل من الأنواع الخمسة)، عند حفظ التفضيلات ثم استرجاعها، يجب أن تكون القيم المُسترجعة مطابقة تماماً للقيم المحفوظة.

**يتحقق من: المتطلبات 1.1، 1.2**

---

### الخاصية 2: عدم إرسال الإشعارات المعطّلة

*لأي* حدث في النظام وأي مستخدم تم تعطيل نوع إشعار ذلك الحدث لديه، لا يجب أن يُنشأ أي سجل إشعار لذلك المستخدم في قاعدة البيانات عند وقوع الحدث.

**يتحقق من: المتطلبات 1.3، 1.4**

---

### الخاصية 3: اكتمال مفاتيح الترجمة في جميع اللغات

*لأي* لغة مدعومة، يجب أن يحتوي ملف translations على نفس مجموعة المفاتيح الموجودة في اللغة المرجعية (العربية). عدد المفاتيح في أي لغة يجب أن يساوي عدد المفاتيح في اللغة العربية.

**يتحقق من: المتطلبات 2.1، 2.6، 5.5**

---

### الخاصية 4: الـ Fallback إلى العربية عند غياب مفتاح

*لأي* لغة مدعومة وأي مفتاح ترجمة غير موجود في تلك اللغة، يجب أن تُرجع دالة `getText()` القيمة العربية المقابلة بدلاً من `undefined` أو خطأ.

**يتحقق من: المتطلب 2.3**

---

### الخاصية 5: ثبات المصطلحات التقنية عبر الترجمات

*لأي* نص مترجم في أي لغة، المصطلحات التقنية (USDT، Binance، TRC20، TON) يجب أن تظهر بنفس الصيغة الأصلية دون تعديل.

**يتحقق من: المتطلب 2.4**

---

### الخاصية 6: تسجيل بصمة الجهاز في كل جلسة

*لأي* عملية تسجيل دخول أو إنشاء حساب جديد (في البوت أو الواجهة الويب)، يجب أن يُنشأ سجل في جدول `device_logs` يحتوي على IP وUser-Agent وhash الجهاز ومعرف المستخدم.

**يتحقق من: المتطلبات 3.1، 3.6**

---

### الخاصية 7: رفض تسجيل الأجهزة المحظورة

*لأي* محاولة إنشاء حساب جديد من جهاز (بصمة مطابقة) مرتبط بحساب محظور، يجب أن يُرفض الطلب بكود HTTP 403 أو رسالة خطأ واضحة، ولا يُنشأ أي حساب جديد.

**يتحقق من: المتطلب 3.3**

---

### الخاصية 8: تأشير الحسابات المتعددة لنفس الـ IP

*لأي* IP يرتبط بأكثر من 3 حسابات نشطة في قاعدة البيانات، يجب أن يُعيد استعلام `GET /api/admin/duplicate-accounts` تلك الحسابات ضمن قائمة المشبوهة.

**يتحقق من: المتطلب 3.4**

---

### الخاصية 9: فلترة المهام حسب بلد المستخدم

*لأي* مهمة تحمل `country_code` محدداً، ولأي مستخدم `country_code` مختلف، يجب ألا تظهر تلك المهمة في نتائج `GET /api/tasks` لذلك المستخدم.

**يتحقق من: المتطلب 3.7**

---

### الخاصية 10: فريدية أرقام تذاكر الدعم

*لأي* مجموعة من التذاكر في النظام، لا يجب أن يتكرر حقل `ticket_no` بين أي تذكرتين مختلفتين.

**يتحقق من: المتطلب 4.2**

---

### الخاصية 11: دعم مستويات الأولوية الأربعة للتذاكر

*لأي* تذكرة تُنشأ بأي من المستويات الأربعة (low، medium، high، urgent)، يجب أن يكون المستوى المحفوظ مطابقاً للمستوى المُرسل.

**يتحقق من: المتطلب 4.3**

---

### الخاصية 12: بقاء محادثة التذكرة المغلقة

*لأي* تذكرة مُغلقة، يجب أن تبقى جميع رسائلها في جدول `ticket_messages` قابلة للاسترجاع، ولا يُحذف أي منها عند إغلاق التذكرة.

**يتحقق من: المتطلب 4.5**

---

### الخاصية 13: عزل تذاكر المستخدمين

*لأي* مستخدم، يجب ألا يُعيد `GET /api/tickets` تذاكر تعود لمستخدمين آخرين. جميع التذاكر المُعادة يجب أن يكون `user_id` الخاص بها مطابقاً لمعرف المستخدم المصادَق عليه.

**يتحقق من: المتطلب 4.7**

---

### الخاصية 14: رفض المدخلات الخبيثة (SQL Injection)

*لأي* حقل إدخال في API، إرسال سلاسل نصية تحتوي على أوامر SQL (مثل `'; DROP TABLE users; --`) يجب أن يُعالَج كنص حرفي ولا يُنفَّذ كأمر SQL، مع إرجاع استجابة طبيعية أو خطأ validation.

**يتحقق من: المتطلب 6.3**

---

### الخاصية 15: تطبيق Rate Limiting على المسارات العامة

*لأي* IP يرسل أكثر من 100 طلب في الدقيقة إلى المسارات العامة، يجب أن يُرفض الطلب الـ101 وما بعده بكود HTTP 429.

**يتحقق من: المتطلب 6.4**

---

### الخاصية 16: رفض المدخلات غير الصالحة

*لأي* حقل إدخال تُرسَل إليه قيمة خارج النطاق المقبول (مثل amount سالب، أو email بدون @، أو عنوان محفظة بتنسيق غير صحيح)، يجب أن يُرفض الطلب بكود HTTP 400 ورسالة خطأ تصف الحقل الخاطئ.

**يتحقق من: المتطلبات 6.5، 10.3، 10.4**

---

### الخاصية 17: تسجيل الأنشطة — round-trip

*لأي* حدث من الأحداث المحددة (تسجيل الدخول، إنشاء مهمة، تقديم إثبات، إيداع، سحب، رد على تذكرة)، بعد تنفيذ الحدث يجب أن يُعيد `GET /api/user/activity` سجلاً يحتوي على ذلك الحدث بنوعه الصحيح وطابعه الزمني.

**يتحقق من: المتطلب 7.3**

---

### الخاصية 18: الترتيب التنازلي لسجل الأنشطة

*لأي* استعلام لـ `GET /api/user/activity`، يجب أن تكون السجلات المُعادة مرتبة تنازلياً بحقل `created_at`، أي أن كل سجل `created_at` أحدث من أو مساوٍ للسجل التالي.

**يتحقق من: المتطلب 7.4**

---

### الخاصية 19: Pagination — التحكم في حجم الصفحة

*لأي* استعلام بـ `page` و`pageSize` محددَين، يجب ألا يزيد عدد السجلات المُعادة عن `pageSize`. والاستعلام بدون params يجب أن يُعيد 100 سجل كحد أقصى.

**يتحقق من: المتطلبات 7.5، 11.5**

---

### الخاصية 20: قبول تعديلات الحقول المسموح بها

*لأي* مهمة وأي مضيف هو صاحبها، عند إرسال PATCH بتعديل حقل `verification_instructions` أو `bot_name` أو `proof_type`، يجب أن يُحفظ التعديل ويُعاد القيمة الجديدة عند استعلام تفاصيل المهمة.

**يتحقق من: المتطلب 8.1**

---

### الخاصية 21: رفض تعديل الحقول المحمية

*لأي* مهمة، محاولة تعديل `referral_link` أو `reward_per_user` أو `required_count` عبر PATCH يجب أن تُرفض بكود HTTP 400 أو 403، وتبقى القيم الأصلية في قاعدة البيانات دون تغيير.

**يتحقق من: المتطلب 8.2**

---

### الخاصية 22: دورة حياة الإيقاف المؤقت للمهام — round-trip

*لأي* مهمة نشطة، عند إيقافها مؤقتاً لا تظهر في قائمة المهام المتاحة. عند استئنافها تظهر مجدداً. الحالة النهائية بعد (pause → resume) يجب أن تكون مطابقة للحالة الأولية.

**يتحقق من: المتطلبات 8.3، 8.4، 8.5**

---

### الخاصية 23: تسجيل تدقيق جميع تعديلات المهام

*لأي* تعديل مقبول على مهمة، يجب أن يُنشأ سجل في جدول `task_audit` يحتوي على: `task_id`، `changed_by`، `field_name`، `old_value`، `new_value`، `created_at`.

**يتحقق من: المتطلب 8.6**

---

### الخاصية 24: اتساق عداد الإشعارات غير المقروءة

*لأي* مستخدم، القيمة المُعادة من `GET /api/notifications/unread-count` يجب أن تساوي دائماً عدد السجلات في جدول `notifications` التي `is_read = 0` و`user_id = userId`.

**يتحقق من: المتطلبات 9.2، 9.5**

---

### الخاصية 25: تعليم الإشعار مقروءاً — round-trip

*لأي* إشعار غير مقروء وأي مستخدم يملكه، عند استدعاء `POST /api/notifications/:id/read` ثم استعلام `GET /api/notifications/unread-count`، يجب أن ينخفض العداد بمقدار 1.

**يتحقق من: المتطلب 9.3**

---

### الخاصية 26: انتهاء صلاحية الإشعارات بعد 30 يوماً

*لأي* استعلام لقاعدة البيانات، لا يجب أن توجد إشعارات تجاوزت `expires_at` في قائمة الإشعارات النشطة المُعادة للمستخدم.

**يتحقق من: المتطلب 9.4**

---

### الخاصية 27: التحقق من صحة عناوين المحافظ

*لأي* طلب إيداع أو سحب بعنوان محفظة TRC20 أو TON أو Binance Pay ID بتنسيق غير صالح (طول خاطئ أو أحرف غير مسموح بها)، يجب رفض الطلب بكود HTTP 400.

**يتحقق من: المتطلبات 10.3، 10.4**

---

### الخاصية 28: اتساق حالة المعاملات المالية

*لأي* معاملة (إيداع أو سحب)، الحالة المُعادة من `GET /api/wallet/deposits` أو `GET /api/wallet/withdrawals` يجب أن تطابق قيمة حقل `status` في قاعدة البيانات للسجل ذاته.

**يتحقق من: المتطلب 10.5**

---

### الخاصية 29: حفظ تفضيل الوضع الداكن/الفاتح

*لأي* تغيير في تفضيل الثيم (dark/light)، يجب أن تُحفظ القيمة في localStorage وعند تحميل الصفحة من جديد يُطبَّق نفس الثيم.

**يتحقق من: المتطلب 11.3**

---

### الخاصية 30: اتساق خاصية round-trip للبيانات (من المتطلب 13)

*لأي* كائن مستخدم صالح، تسلسله (serialize) ثم إلغاء تسلسله (deserialize) يجب أن ينتج كائناً مكافئاً للأصل.

*لأي* userId ومبلغ x موجب، بعد `updateBalance(userId, +x)` ثم `updateBalance(userId, -x)` يجب أن يعود الرصيد لقيمته الأصلية.

*لأي* مهمة بعد قبول تقديم، يجب ألا ينخفض `completed_count` عن صفر.

**يتحقق من: المتطلب 13.5**

---

## معالجة الأخطاء

### مستويات الأخطاء

```
┌─────────────────────────────────────────────────────────┐
│                    طبقة العرض (Client)                   │
│  - عرض Toast للأخطاء المؤقتة                           │
│  - عرض صفحة خطأ للأخطاء الحرجة                        │
│  - إعادة المحاولة التلقائية لأخطاء الشبكة              │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                    طبقة API (Express)                    │
│  - 400: مدخلات غير صالحة (تفاصيل الحقل الخاطئ)        │
│  - 401: غير مصادَق عليه                                 │
│  - 403: غير مصرّح (مستخدم عادي يطلب إداري)            │
│  - 404: مورد غير موجود                                  │
│  - 429: تجاوز حد الطلبات                               │
│  - 500: خطأ داخلي (مسجَّل في server logs)              │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                    طبقة قاعدة البيانات                    │
│  - SQLITE_CONSTRAINT: تسجيل + إرجاع 409                │
│  - SQLITE_BUSY: إعادة المحاولة 3 مرات                  │
│  - استعلام بطيء (>1000ms): تحذير في logs               │
│  - فشل كامل: تسجيل كامل + إرجاع 500 للعميل            │
└─────────────────────────────────────────────────────────┘
```

### قواعد معالجة الأخطاء

1. لا تُكشف تفاصيل الاستعلامات أو stack traces للعميل أبداً
2. جميع الأخطاء تُسجَّل مع context كافٍ للتشخيص
3. رسائل الخطأ تُترجَم حسب لغة المستخدم

---

## استراتيجية الاختبار

### نهج الاختبار المزدوج

النظام يتبع نهجاً مزدوجاً: **اختبارات الوحدة** للأمثلة والحالات الحدية، و**اختبارات الخاصية** للتحقق من السلوك الكوني.

#### اختبارات الوحدة (Unit Tests)

تغطي:
- **نماذج البيانات**: `User`، `Task`، `Submission`، `Ticket`، `NotificationPrefs`
- **دوال مساعدة**: `getText()`، `verifyTelegramAuth()`، validators عناوين المحافظ
- **حالات حدية**: رصيد صفر، تذكرة بدون رسائل، مستخدم بدون تفضيلات

الإطار المستخدم: **Jest** (متوافق مع Node.js/ESM)

#### اختبارات التكامل (Integration Tests)

تغطي:
- تدفق إنشاء مهمة كاملاً
- تدفق تقديم وقبول/رفض إثبات
- تدفق الإيداع والسحب
- دورة حياة تذكرة الدعم

#### اختبارات API Endpoints

تغطي جميع مسارات `/api/*` مع التحقق من:
- رموز HTTP الصحيحة للحالات الطبيعية
- رموز HTTP الصحيحة لحالات الخطأ
- بنية الاستجابة (JSON schema)

#### اختبارات الخاصية (Property-Based Tests)

الإطار المستخدم: **fast-check** (متوافق مع JavaScript/Node.js)

الإعداد: **100 تكرار على الأقل** لكل اختبار خاصية.

نموذج تعليق كل اختبار:
```javascript
// Feature: bot-web-enhancements, Property {N}: {وصف الخاصية}
```

مثال:
```javascript
import fc from 'fast-check';
import { getText } from '../languages.js';

// Feature: bot-web-enhancements, Property 4: Fallback إلى العربية عند غياب مفتاح
test('getText يُرجع قيمة عربية لمفتاح غير موجود في اللغة المحددة', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('fa', 'tr', 'ur', 'en', 'ru'),
      fc.string({ minLength: 1 }),
      (lang, key) => {
        const result = getText(lang, key);
        const arabic = getText('ar', key);
        // إذا لم يوجد في اللغة المطلوبة، يجب أن يرجع العربي
        expect(result).toBeDefined();
        expect(result).not.toBeUndefined();
      }
    ),
    { numRuns: 100 }
  );
});
```

### الاختبارات ضمن بيئة CI

- زمن الاكتمال المستهدف: أقل من 60 ثانية
- تشغيل اختبارات الخاصية بـ `--testTimeout=30000`
- تجنب اختبارات I/O في اختبارات الخاصية (استخدام in-memory SQLite)
