#!/bin/bash
# setup_nginx.sh — إعداد nginx + SSL لـ ducktasks.duckdns.org
# الاستخدام: bash setup_nginx.sh your@email.com

EMAIL=${1:-"admin@example.com"}
DOMAIN="ducktasks.duckdns.org"

echo "==> Writing nginx config..."
cat > /etc/nginx/conf.d/ducktasks.conf << 'EOF'
server {
    listen 80;
    server_name ducktasks.duckdns.org;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

echo "==> Killing any existing nginx..."
pkill nginx 2>/dev/null || true
sleep 1

echo "==> Starting nginx..."
nginx

echo "==> Testing nginx..."
nginx -t

echo "==> Getting SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

echo "==> Reloading nginx..."
nginx -s reload

echo ""
echo "✅ Done! Visit: https://$DOMAIN"
