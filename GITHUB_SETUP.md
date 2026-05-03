# خطوات رفع الكود على GitHub

## 1. إنشاء مستودع جديد على GitHub

1. اذهب إلى: https://github.com/new
2. اسم المستودع: `refferalbot`
3. الوصف (اختياري): `Telegram Referral Bot with Advanced Features`
4. اختر: **Private** أو **Public** (حسب رغبتك)
5. **لا تضف** README أو .gitignore أو license (لأنها موجودة بالفعل)
6. اضغط "Create repository"

## 2. ربط المستودع المحلي بـ GitHub

بعد إنشاء المستودع، نفذ الأوامر التالية:

```bash
# استبدل YOUR_USERNAME باسم المستخدم الخاص بك على GitHub
git remote add origin https://github.com/YOUR_USERNAME/refferalbot.git

# رفع الكود
git branch -M main
git push -u origin main
```

## 3. إذا طلب منك تسجيل الدخول

سيطلب منك GitHub اسم المستخدم وكلمة المرور (أو Personal Access Token)

### للحصول على Personal Access Token:
1. اذهب إلى: https://github.com/settings/tokens
2. اضغط "Generate new token" → "Generate new token (classic)"
3. اختر الصلاحيات: `repo` (كامل)
4. اضغط "Generate token"
5. انسخ الـ token واستخدمه بدلاً من كلمة المرور

## 4. التحقق من الرفع

بعد الرفع، اذهب إلى:
```
https://github.com/YOUR_USERNAME/refferalbot
```

يجب أن ترى جميع الملفات هناك!

---

## ملاحظات مهمة:

✅ الملفات الحساسة محمية:
- `.env` (يحتوي على BOT_TOKEN)
- `*.db` (قاعدة البيانات)
- `*.log` (ملفات السجلات)
- `node_modules/` (المكتبات)

✅ تم إنشاء `.env.example` كمثال للإعدادات

⚠️ **لا تشارك** ملف `.env` الحقيقي أبداً!
