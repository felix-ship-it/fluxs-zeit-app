#!/bin/bash
# FLUXS Zeit App — Hetzner Server Setup (Git-basiert)
# Server: 178.104.15.196 | Domain: zeit.fluxs.de
set -e

DOMAIN="zeit.fluxs.de"
APP_DIR="/var/www/zeit"
REPO="https://github.com/felix-ship-it/fluxs-zeit-app.git"
BRANCH="live"

echo "=== 1/6: System Update ==="
apt-get update -y
apt-get upgrade -y

echo "=== 2/6: Apache + Git + Python installieren ==="
apt-get install -y apache2 git python3 python3-pip certbot python3-certbot-apache
a2enmod ssl rewrite headers cgid
systemctl enable apache2

echo "=== 3/6: Python-Dependencies ==="
pip3 install requests

echo "=== 4/6: Repo klonen (Branch: $BRANCH) ==="
rm -rf "$APP_DIR"
git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
chmod +x "$APP_DIR"/cgi-bin/*.py 2>/dev/null || true
chown -R www-data:www-data "$APP_DIR"

echo "=== 5/6: Apache VirtualHost ==="
cat > /etc/apache2/sites-available/zeit.fluxs.de.conf << 'VHOST'
<VirtualHost *:80>
    ServerName zeit.fluxs.de
    DocumentRoot /var/www/zeit

    <Directory /var/www/zeit>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ScriptAlias /cgi-bin/ /var/www/zeit/cgi-bin/
    <Directory /var/www/zeit/cgi-bin>
        Options +ExecCGI
        AddHandler cgi-script .py
        Require all granted
    </Directory>

    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"

    <LocationMatch "\.(woff2?|ttf|svg|png|jpg|ico)$">
        Header set Cache-Control "public, max-age=2592000"
    </LocationMatch>
    <LocationMatch "\.(css|js)$">
        Header set Cache-Control "public, max-age=3600"
    </LocationMatch>

    ErrorLog ${APACHE_LOG_DIR}/zeit-error.log
    CustomLog ${APACHE_LOG_DIR}/zeit-access.log combined
</VirtualHost>
VHOST

a2dissite 000-default.conf 2>/dev/null || true
a2ensite zeit.fluxs.de.conf
systemctl reload apache2

echo "=== 6/6: Let's Encrypt SSL ==="
certbot --apache -d "$DOMAIN" --non-interactive --agree-tos --email felix.grund@me.com --redirect

chown -R www-data:www-data "$APP_DIR"

echo ""
echo "SETUP FERTIG: https://zeit.fluxs.de"
echo "Update deployen: cd /var/www/zeit && git pull"
echo ""
