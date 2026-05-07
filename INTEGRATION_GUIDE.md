# 🔧 دليل التكامل - الميزات الجديدة

## 📋 الخطوات المطلوبة

لتفعيل الميزات الجديدة، يجب إضافة الكود التالي إلى `index.js`:

---

## 1️⃣ إضافة الاستيرادات في بداية index.js

```javascript
// بعد الاستيرادات الموجودة، أضف:
import Statistics from './models/Statistics.js';
import Rating from './models/Rating.js';
import Broadcast from './models/Broadcast.js';
import Appeal from './models/Appeal.js';

import {
  handleStatistics,
  handleTopUsers
} from './handlers/statisticsHandler.js';

import {
  handleRateUser,
  handleRatingSelection,
  handleSkipComment,
  handleRatingComment,
  handleViewRatings,
  ratingStates
} from './handlers/ratingHandler.js';

import {
  handleStartBroadcast,
  handleBroadcastTarget,
  handleBroadcastMessage,
  handleBroadcastSend,
  handleBroadcastCancel,
  handleBroadcastHistory,
  broadcastStates
} from './handlers/broadcastHandler.js';

import {
  handleStartAppeal,
  handleAppealReason,
  handleAppealReview,
  handleAppealRejectNote,
  handleViewAppeals,
  appealStates
} from './handlers/appealHandler.js';
```

---

## 2️⃣ إضافة معالجات الأزرار

### أ. معالج الإحصائيات
```javascript
// معالج زر الإحصائيات (للأدمن فقط)
bot.onText(/📊 الإحصائيات/, handleStatistics);
```

### ب. معالج التقييمات
```javascript
// معالج زر عرض التقييمات
bot.onText(/⭐ تقييماتي|⭐ My Ratings|⭐ Мои рейтинги/, handleViewRatings);
```

### ج. معالج الرسائل الجماعية
```javascript
// معالج زر الرسالة الجماعية (للأدمن فقط)
bot.onText(/📢 رسالة جماعية/, handleStartBroadcast);
```

### د. معالج الاستئنافات
```javascript
// معالج زر الاستئناف
bot.onText(/📝 استئناف|📝 Appeal|📝 Апелляция/, handleStartAppeal);

// معالج زر عرض الاستئنافات (للأدمن فقط)
bot.onText(/📋 الاستئنافات/, handleViewAppeals);
```

---

## 3️⃣ إضافة معالجات الـ Callback Queries

```javascript
// في معالج bot.on('callback_query')، أضف:

bot.on('callback_query', async (query) => {
  const data = query.data;

  // ... الكود الموجود ...

  // معالجات التقييمات
  if (data.startsWith('rate_user_')) {
    await handleRateUser(bot, query);
  } else if (data.startsWith('rating_')) {
    await handleRatingSelection(bot, query);
  } else if (data.startsWith('skip_comment_')) {
    await handleSkipComment(bot, query);
  }

  // معالجات الرسائل الجماعية
  else if (data.startsWith('broadcast_target_')) {
    await handleBroadcastTarget(bot, query);
  } else if (data.startsWith('broadcast_send_')) {
    await handleBroadcastSend(bot, query);
  } else if (data.startsWith('broadcast_cancel_')) {
    await handleBroadcastCancel(bot, query);
  }

  // معالجات الاستئنافات
  else if (data.startsWith('appeal_approve_') || data.startsWith('appeal_reject_')) {
    await handleAppealReview(bot, query);
  }

  // ... باقي الكود ...
});
```

---

## 4️⃣ إضافة معالجات الرسائل النصية

```javascript
// في معالج bot.on('message')، أضف:

bot.on('message', async (msg) => {
  // ... الكود الموجود ...

  // معالجات الحالات (States)
  if (await handleTaskCreationSteps(bot, msg)) return;
  if (await handleSubmissionSteps(bot, msg)) return;
  if (await handleDepositSteps(bot, msg)) return;
  if (await handleWithdrawalSteps(bot, msg)) return;
  if (await handleAdminSteps(bot, msg)) return;
  if (await handleWithdrawalRejectReason(bot, msg)) return;
  if (await handleDepositRejectReason(bot, msg)) return;
  if (await handleRejectMessage(bot, msg)) return;

  // أضف المعالجات الجديدة:
  if (await handleRatingComment(bot, msg)) return;
  if (await handleBroadcastMessage(bot, msg)) return;
  if (await handleAppealReason(bot, msg)) return;
  if (await handleAppealRejectNote(bot, msg)) return;

  // ... باقي الكود ...
});
```

---

## 5️⃣ إضافة زر التقييم بعد قبول الإثبات

في `handlers/submissionHandler.js`، في دالة `handleReview`، بعد قبول الإثبات:

```javascript
// بعد السطر:
await bot.sendMessage(submission.user_telegram_id, acceptMessages[lang]);

// أضف:
// إرسال زر التقييم لصاحب المهمة
const task = await Task.getById(submission.task_id);
const taskOwner = await User.findById(task.owner_id);

const ratingKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ 
        text: '⭐ تقييم المستخدم', 
        callback_data: `rate_user_${submission.task_id}_${submission.user_id}` 
      }]
    ]
  }
};

await bot.sendMessage(
  taskOwner.telegram_id,
  `✅ تم قبول إثبات المستخدم @${user.username || 'مستخدم'}\n\n` +
  `💡 يمكنك الآن تقييم أداء المستخدم`,
  ratingKeyboard
);
```

---

## 6️⃣ تحديث معالج معلوماتي

في `index.js`، في معالج زر "ℹ️ معلوماتي"، أضف عرض التقييم:

```javascript
bot.onText(/ℹ️ معلوماتي|ℹ️ My Info|ℹ️ Моя информация/, async (msg) => {
  // ... الكود الموجود ...

  // أضف بعد عرض الرصيد:
  const { avgRating, totalRatings } = await Rating.getAverageRating(user.id);
  
  if (totalRatings > 0) {
    message += `⭐ التقييم: ${avgRating}/5 (${totalRatings} تقييم)\n`;
  }

  // ... باقي الكود ...
});
```

---

## ✅ التحقق من التكامل

بعد إضافة الكود، تحقق من:

### 1. الإحصائيات
```
الأدمن → ⚙️ لوحة التحكم → 📊 الإحصائيات
```
يجب أن تظهر لوحة الإحصائيات الشاملة

### 2. التقييمات
```
المستخدم → ⭐ تقييماتي
```
يجب أن تظهر صفحة التقييمات

### 3. الرسائل الجماعية
```
الأدمن → ⚙️ لوحة التحكم → 📢 رسالة جماعية
```
يجب أن تظهر خيارات الفئة المستهدفة

### 4. الاستئناف
```
مستخدم محظور → 📝 استئناف
```
يجب أن تظهر صفحة تقديم الاستئناف

---

## 🐛 استكشاف الأخطاء

### خطأ: "Cannot find module"
- تأكد من إضافة جميع الاستيرادات في بداية `index.js`

### خطأ: "Function is not defined"
- تأكد من استيراد الدوال من الـ handlers الصحيحة

### خطأ: الأزرار لا تظهر
- تأكد من تحديث `utils/keyboards.js`
- أعد تشغيل البوت

### خطأ: قاعدة البيانات
- تأكد من تحديث `database.js`
- احذف `bot.db` وأعد تشغيل البوت (سيتم إنشاء قاعدة بيانات جديدة)

---

## 📝 ملاحظات

1. **النسخ الاحتياطي**: احتفظ بنسخة احتياطية من `index.js` قبل التعديل
2. **الاختبار**: اختبر كل ميزة على حدة
3. **السجلات**: راقب السجلات (logs) للتأكد من عدم وجود أخطاء
4. **قاعدة البيانات**: الجداول الجديدة ستُنشأ تلقائياً عند أول تشغيل

---

## 🎯 الخطوات التالية

بعد التكامل الناجح:
1. ✅ اختبر جميع الميزات
2. ✅ راجع السجلات
3. ✅ اقرأ `NEW_FEATURES.md` للتفاصيل
4. ✅ شارك التحديثات مع المستخدمين

---

**ملاحظة مهمة:** 
جميع الملفات المطلوبة موجودة بالفعل:
- ✅ `models/Statistics.js`
- ✅ `models/Rating.js`
- ✅ `models/Broadcast.js`
- ✅ `models/Appeal.js`
- ✅ `handlers/statisticsHandler.js`
- ✅ `handlers/ratingHandler.js`
- ✅ `handlers/broadcastHandler.js`
- ✅ `handlers/appealHandler.js`
- ✅ `database.js` (محدّث)
- ✅ `utils/keyboards.js` (محدّث)

فقط أضف الكود إلى `index.js` كما هو موضح أعلاه!
