#!/bin/bash
# deploy.sh — تشغيل الموقع على Ubuntu
# الاستخدام: bash deploy.sh

set -e

echo "==> Installing Node.js 20 (if not installed)..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Installing server dependencies..."
cd "$(dirname "$0")/server"
npm install

echo "==> Installing client dependencies & building..."
cd ../client
npm install
npm run build

echo "==> Setting up PM2 processes..."
cd ..

# البوت
pm2 start ../index.js --name "telegram-bot" --interpreter node 2>/dev/null || pm2 restart telegram-bot

# الـ Web server
pm2 start server/index.js --name "web-server" --interpreter node 2>/dev/null || pm2 restart web-server

pm2 save
pm2 startup | tail -1 | sudo bash 2>/dev/null || true

echo ""
echo "✅ Done!"
echo "   Bot:        pm2 logs telegram-bot"
echo "   Web server: pm2 logs web-server"
echo "   Website:    http://$(hostname -I | awk '{print $1}'):3001"
