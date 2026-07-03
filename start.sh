#!/bin/bash
# ============================================
#   Bot + Website Setup Script
#   Run: bash start.sh
# ============================================

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "========================================"
echo "   Bot + Website Setup"
echo "========================================"
echo ""

# ── 1. Bot Token ──
read -p "Enter your BOT_TOKEN: " BOT_TOKEN
if [ -z "$BOT_TOKEN" ]; then
  echo -e "${RED}BOT_TOKEN is required!${NC}"
  exit 1
fi

# ── 2. Bot Username ──
read -p "Enter your bot username (without @): " BOT_NAME
if [ -z "$BOT_NAME" ]; then
  echo -e "${RED}Bot username is required!${NC}"
  exit 1
fi

# ── 3. JWT Secret ──
JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 40 | head -n 1)
echo -e "${GREEN}JWT Secret generated automatically.${NC}"

# ── 4. Write .env files ──
echo ""
echo "==> Writing config files..."

cat > .env << EOF
BOT_TOKEN=$BOT_TOKEN
MAIN_ADMIN_ID=
ADMIN_IDS=
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_DEPOSIT_ADDRESS=
BINANCE_NETWORK=BSC
MIN_DEPOSIT_AMOUNT=0.1
EOF

cat > web/server/.env << EOF
BOT_TOKEN=$BOT_TOKEN
JWT_SECRET=$JWT_SECRET
WEB_PORT=3001
EOF

cat > web/client/.env << EOF
VITE_BOT_NAME=$BOT_NAME
EOF

echo -e "${GREEN}Config files written.${NC}"

# ── 5. Install dependencies ──
echo ""
echo "==> Installing bot dependencies..."
npm install

echo ""
echo "==> Installing web server dependencies..."
cd web/server && npm install && cd ../..

echo ""
echo "==> Installing web client dependencies..."
cd web/client && npm install

echo ""
echo "==> Building web client..."
npm run build
cd ../..

echo -e "${GREEN}Build complete.${NC}"

# ── 6. Install PM2 ──
echo ""
echo "==> Installing PM2..."
npm install -g pm2 2>/dev/null || true

# ── 7. Start with PM2 ──
echo ""
echo "==> Starting bot and web server..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# ── 8. Start tunnel ──
echo ""
echo "==> Starting tunnel..."
pm2 start "ssh -o StrictHostKeyChecking=no -R 80:localhost:3001 serveo.net" --name "tunnel"
pm2 save

echo ""
echo "========================================"
echo -e "${GREEN}All done!${NC}"
echo ""
echo "Waiting for tunnel URL..."
sleep 5
pm2 logs tunnel --lines 10 --nostream | grep -o 'https://[^ ]*' | head -1
echo ""
echo "Copy the URL above and:"
echo "  1. Open it in your browser"
echo "  2. Set it in BotFather: /setdomain"
echo "========================================"
