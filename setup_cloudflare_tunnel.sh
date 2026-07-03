#!/bin/bash
# setup_cloudflare_tunnel.sh
# يشغل الموقع عبر Cloudflare Tunnel على Android/Termux
# الاستخدام: bash setup_cloudflare_tunnel.sh

echo "==> Detecting architecture..."
ARCH=$(uname -m)
echo "Architecture: $ARCH"

echo "==> Downloading cloudflared..."
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    wget -q --show-progress -O cloudflared \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
elif [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armv8l" ]; then
    wget -q --show-progress -O cloudflared \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm
else
    wget -q --show-progress -O cloudflared \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
fi

chmod +x cloudflared
mv cloudflared /usr/local/bin/cloudflared

echo ""
echo "==> Verifying installation..."
cloudflared --version

echo ""
echo "==> Starting tunnel for http://localhost:3001 ..."
echo "    A public HTTPS URL will appear below — copy it and open in browser"
echo "    Press Ctrl+C to stop"
echo ""
cloudflared tunnel --url http://localhost:3001
