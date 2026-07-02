# تشغيل الموقع على Ubuntu

## المتطلبات
- Ubuntu 20.04+
- Node.js 20+
- نفس السيرفر الذي يعمل عليه البوت

---

## الخطوات

### 1. نسخ الملفات على السيرفر
```bash
# من جهازك المحلي
scp -r web/ user@your-server-ip:~/bot/web/
```

### 2. إعداد ملفات البيئة

```bash
# server .env
cp web/server/.env.example web/server/.env
nano web/server/.env
```

```env
BOT_TOKEN=نفس_توكن_البوت
JWT_SECRET=اكتب_string_عشوائي_طويل
WEB_PORT=3001
```

```bash
# client .env
cp web/client/.env.example web/client/.env
nano web/client/.env
```

```env
VITE_BOT_NAME=اسم_البوت_بدون_@
```

### 3. تشغيل سكريبت الـ deployment
```bash
bash web/deploy.sh
```

السكريبت يقوم بـ:
- تثبيت Node.js إذا لم يكن موجوداً
- تثبيت PM2 لإدارة العمليات
- تثبيت dependencies وبناء الـ React app
- تشغيل البوت والـ web server مع PM2

---

## أوامر مفيدة

```bash
pm2 status              # حالة العمليات
pm2 logs web-server     # logs الموقع
pm2 logs telegram-bot   # logs البوت
pm2 restart web-server  # إعادة تشغيل الموقع
```

---

## إعداد Nginx (اختياري - لاستخدام domain)

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/bot
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL مجاني مع Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## ملاحظة مهمة

Telegram Login Widget يشترط أن تكون الصفحة على **HTTPS** أو **localhost**.
إذا كنت تستخدم IP مباشرة بدون domain، المستخدمين يمكنهم الدخول مباشرة بدون login عبر البوت أولاً.

لإضافة domain للبوت في Telegram:
```
/setdomain في @BotFather ← اختر بوتك ← اكتب الـ domain
```
