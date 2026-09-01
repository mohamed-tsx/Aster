#!/usr/bin/env bash
# One-time provisioning for a fresh Ubuntu 22.04/24.04 VPS.
# Run by hand over SSH as a user with sudo: `sudo bash deploy/setup-server.sh`
#
# Usage:
#   sudo APP_DOMAIN=app.example.com API_DOMAIN=api.example.com \
#        REPO_URL=git@github.com:you/aster.git \
#        bash deploy/setup-server.sh
#
# Safe to re-run: each step checks whether it already applied.
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:?Set APP_DOMAIN, e.g. aster.withmohamed.com}"
API_DOMAIN="${API_DOMAIN:?Set API_DOMAIN, e.g. api.withmohamed.com}"
REPO_URL="${REPO_URL:?Set REPO_URL, e.g. git@github.com:mohamed-tsx/aster.git}"
APP_DIR="${APP_DIR:-/var/www/aster}"
DB_NAME="${DB_NAME:-aster}"
DB_USER="${DB_USER:-aster}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD for the Postgres role}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL for Certbot}"

echo "==> Updating apt and installing base packages"
apt-get update -y
apt-get install -y curl git nginx postgresql postgresql-contrib

echo "==> Installing Node.js LTS (via NodeSource) if missing"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Installing PM2 if missing"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> Installing Certbot if missing"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi

echo "==> Ensuring Postgres role and database exist"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> Cloning or updating repo at ${APP_DIR}"
if [ ! -d "${APP_DIR}/.git" ]; then
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "    Repo already present, skipping clone."
fi

if [ ! -f "${APP_DIR}/Server/.env" ]; then
  echo "==> NOTE: ${APP_DIR}/Server/.env does not exist yet."
  echo "    Create it now with at least:"
  echo "      DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
  echo "      JWT_SECRET=<generate one>"
  echo "      CORS_ORIGIN=https://${APP_DOMAIN}"
  echo "    (deploy.sh will not overwrite this file — it's gitignored.)"
fi

if [ ! -f "${APP_DIR}/aster/.env.production" ]; then
  echo "==> NOTE: ${APP_DIR}/aster/.env.production does not exist yet."
  echo "      NEXT_PUBLIC_API_URL=https://${API_DOMAIN}"
  echo "    Create it before the first build — NEXT_PUBLIC_* vars are baked in at build time."
fi

echo "==> Installing Nginx site for frontend (${APP_DOMAIN})"
sed "s/__DOMAIN__/${APP_DOMAIN}/g" "${APP_DIR}/deploy/nginx/app.conf.template" \
  > /etc/nginx/sites-available/aster-app
ln -sf /etc/nginx/sites-available/aster-app /etc/nginx/sites-enabled/aster-app

echo "==> Installing Nginx site for backend (${API_DOMAIN})"
sed "s/__DOMAIN__/${API_DOMAIN}/g" "${APP_DIR}/deploy/nginx/api.conf.template" \
  > /etc/nginx/sites-available/aster-api
ln -sf /etc/nginx/sites-available/aster-api /etc/nginx/sites-enabled/aster-api

nginx -t
systemctl reload nginx

echo "==> Requesting/renewing Let's Encrypt certificates"
certbot --nginx --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" \
  -d "${APP_DOMAIN}" -d "${API_DOMAIN}"

echo "==> Registering PM2 to start on boot"
pm2 startup systemd -u "$(logname)" --hp "$(eval echo ~"$(logname)")" | tail -n 1 | bash || true

cat <<EOF

==> Server setup complete.

Next steps:
  1. Make sure ${APP_DIR}/Server/.env and ${APP_DIR}/aster/.env.production
     are filled in (see notes above).
  2. Run the first deploy by hand:
       cd ${APP_DIR} && bash deploy/deploy.sh
  3. Add these GitHub Actions repo secrets so CI can deploy automatically:
       SSH_HOST, SSH_USER, SSH_PORT, SSH_PRIVATE_KEY
EOF
