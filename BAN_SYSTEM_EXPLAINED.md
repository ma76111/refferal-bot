# 🚫 شرح نظام الحظر والمخالفات

## 📊 نظرة عامة

نظام الحظر يعتمد على **نقاط المخالفات**:
- كل مخالفة = نقاط
- النقاط تتراكم
- عند وصول حد معين = حظر تلقائي
- النقاط تقل تلقائياً مع الوقت (إعادة تأهيل)

---

## 🎯 أنواع المخالفات والنقاط

### 1️⃣ رفض الإثبات (Rejection)
```javascript
النقاط: 1 نقطة
السبب: الأدمن رفض إثبات المستخدم
```

### 2️⃣ رفض نهائي (Final Rejection)
```javascript
النقاط: 2 نقطة
السبب: الأدمن رفض الإثبات نهائياً (بدون فرصة ثانية)
```

### 3️⃣ بلاغ من مستخدم (Report)
```javascript
النقاط: 3 نقاط
السبب: مستخدم آخر أبلغ عنه
```

### 4️⃣ حظر يدوي من الأدمن (Manual Ban)
```javascript
النقاط: 10 نقاط
السبب: الأدمن حظره يدوياً
```

---

## 📈 مستويات الحظر

### المستوى 1: تحذير (0-2 نقطة)
```
✅ يمكنه استخدام البوت عادي
⚠️ تحذير فقط
```

### المستوى 2: تقييد (3-4 نقاط)
```
⏸️ حظر مؤقت 24 ساعة
❌ لا يمكنه إضافة مهام
❌ لا يمكنه تنفيذ مهام
✅ يمكنه السحب فقط
```

### المستوى 3: حظر مؤقت (5-9 نقاط)
```
🚫 حظر مؤقت 7 أيام
❌ لا يمكنه استخدام البوت نهائياً
✅ يمكنه تقديم استئناف
```

### المستوى 4: حظر دائم (10+ نقاط)
```
🔴 حظر دائم
❌ لا يمكنه استخدام البوت أبداً
✅ يمكنه تقديم استئناف (يراجعه الأدمن)
```

---

## 🔄 كيف يعمل النظام؟

### 1. عند حدوث مخالفة:

```javascript
// مثال: رفض إثبات
await ViolationSystem.recordViolation(
  userId,           // ID المستخدم
  'rejection',      // نوع المخالفة
  1,                // النقاط
  'سبب الرفض',      // السبب
  adminId           // ID الأدمن
);
```

**ماذا يحدث:**
1. ✅ يضيف نقطة مخالفة للمستخدم
2. ✅ يحسب إجمالي النقاط
3. ✅ يحدد مستوى الحظر
4. ✅ يطبق الحظر/التقييد تلقائياً

---

### 2. التحقق من حالة المستخدم:

```javascript
// في كل رسالة يرسلها المستخدم
const status = await ViolationSystem.checkUserStatus(userId);

if (!status.allowed) {
  // المستخدم محظور
  await bot.sendMessage(chatId, status.message);
  return; // إيقاف معالجة الرسالة
}
```

**النتيجة:**
```javascript
{
  allowed: false,           // هل مسموح له؟
  banStatus: 'temporary',   // نوع الحظر
  remaining: '5 أيام',      // الوقت المتبقي
  message: 'أنت محظور...'   // الرسالة
}
```

---

### 3. إعادة التأهيل التلقائية:

```javascript
// كل 24 ساعة (مهمة دورية)
await Violation.rehabilitateUsers();
```

**ماذا يحدث:**
- ✅ يقلل نقطة واحدة من كل مستخدم
- ✅ إذا وصلت النقاط لـ 0 = يرفع الحظر تلقائياً
- ✅ يشجع المستخدمين على تحسين سلوكهم

---

## 📋 جداول قاعدة البيانات

### 1. جدول `violations` (المخالفات)
```sql
CREATE TABLE violations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,           -- ID المستخدم
  violation_type TEXT,       -- نوع المخالفة
  points INTEGER,            -- النقاط
  reason TEXT,               -- السبب
  issued_by INTEGER,         -- من أصدرها
  created_at DATETIME        -- التاريخ
);
```

### 2. جدول `bans` (الحظر)
```sql
CREATE TABLE bans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,           -- ID المستخدم
  ban_type TEXT,             -- نوع الحظر (temporary/permanent)
  reason TEXT,               -- السبب
  expires_at DATETIME,       -- تاريخ الانتهاء (للمؤقت)
  is_active INTEGER,         -- نشط؟
  created_at DATETIME        -- تاريخ الحظر
);
```

### 3. جدول `restrictions` (التقييدات)
```sql
CREATE TABLE restrictions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,           -- ID المستخدم
  restriction_type TEXT,     -- نوع التقييد
  reason TEXT,               -- السبب
  expires_at DATETIME,       -- تاريخ الانتهاء
  is_active INTEGER,         -- نشط؟
  created_at DATETIME        -- تاريخ التقييد
);
```

---

## 🔍 أمثلة عملية

### مثال 1: مستخدم رُفض إثباته مرتين

```
المخالفة الأولى:
- النوع: rejection
- النقاط: 1
- الإجمالي: 1 نقطة
- النتيجة: ✅ تحذير فقط

المخالفة الثانية:
- النوع: rejection
- النقاط: 1
- الإجمالي: 2 نقطة
- النتيجة: ✅ تحذير فقط

المخالفة الثالثة:
- النوع: rejection
- النقاط: 1
- الإجمالي: 3 نقاط
- النتيجة: ⏸️ تقييد 24 ساعة
```

---

### مثال 2: مستخدم تم الإبلاغ عنه

```
البلاغ الأول:
- النوع: report
- النقاط: 3
- الإجمالي: 3 نقاط
- النتيجة: ⏸️ تقييد 24 ساعة

البلاغ الثاني:
- النوع: report
- النقاط: 3
- الإجمالي: 6 نقاط
- النتيجة: 🚫 حظر مؤقت 7 أيام
```

---

### مثال 3: الأدمن حظر مستخدم يدوياً

```
الحظر اليدوي:
- النوع: manual_ban
- النقاط: 10
- الإجمالي: 10 نقاط
- النتيجة: 🔴 حظر دائم
```

---

## ⏰ المهام الدورية (Cron Jobs)

### 1. رفع الحظر المؤقت المنتهي
```javascript
// كل 10 دقائق
setInterval(async () => {
  await Ban.liftExpiredBans();
}, 10 * 60 * 1000);
```

### 2. رفع التقييدات المنتهية
```javascript
// كل 10 دقائق
setInterval(async () => {
  await Restriction.liftExpiredRestrictions();
}, 10 * 60 * 1000);
```

### 3. إعادة التأهيل
```javascript
// كل 24 ساعة
setInterval(async () => {
  await Violation.rehabilitateUsers();
}, 24 * 60 * 60 * 1000);
```

---

## 🛡️ الحماية من الإساءة

### 1. الأدمن محمي
```javascript
if (Admin.isMainAdmin(userId)) {
  // لا يمكن حظر الأدمن الرئيسي
  return;
}
```

### 2. منع الحظر المزدوج
```javascript
const existingBan = await Ban.getActiveBan(userId);
if (existingBan) {
  // المستخدم محظور بالفعل
  return;
}
```

### 3. سجل كامل
```javascript
// كل مخالفة مسجلة مع:
- التاريخ والوقت
- السبب
- من أصدرها
- النقاط
```

---

## 📊 إحصائيات النظام

```javascript
// عدد المخالفات النشطة
const violations = await Violation.getActiveViolations();

// عدد المحظورين
const bans = await Ban.getActiveBans();

// عدد المقيدين
const restrictions = await Restriction.getActiveRestrictions();
```

---

## 🎯 الخلاصة

### النظام يعمل بـ 4 خطوات:

1. **تسجيل المخالفة** → إضافة نقاط
2. **حساب الإجمالي** → تحديد مستوى الحظر
3. **تطبيق العقوبة** → حظر/تقييد تلقائي
4. **إعادة التأهيل** → تقليل النقاط تلقائياً

### الهدف:
- ✅ منع الإساءة
- ✅ تشجيع السلوك الجيد
- ✅ إعطاء فرص للتحسين
- ✅ حماية المستخدمين الآخرين

---

## 🔧 ملفات النظام

```
utils/violationSystem.js    - النظام الرئيسي
models/Violation.js          - نموذج المخالفات
models/Ban.js                - نموذج الحظر
models/Restriction.js        - نموذج التقييدات
handlers/appealHandler.js    - معالج الاستئنافات
```

---

**تاريخ الإنشاء:** 2026-05-07
**الإصدار:** 1.0
