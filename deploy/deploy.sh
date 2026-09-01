#!/usr/bin/env bash
# Deploys the latest main branch to this server. Run by GitHub Actions on
# every push to main, or by hand: `bash deploy/deploy.sh`.
#
# Assumes:
#   - This script lives inside the already-cloned repo (see setup-server.sh)
#   - Server/.env and aster/.env.production already exist on this box
#   - Node, npm, PM2 are installed and on PATH
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Deploying from $REPO_ROOT"

PREVIOUS_SHA="$(git rev-parse HEAD)"
echo "==> Current commit before deploy: $PREVIOUS_SHA"
echo "    (rollback with: git checkout $PREVIOUS_SHA && bash deploy/deploy.sh)"

echo "==> Fetching latest main"
git fetch origin main
git reset --hard origin/main

echo "==> Installing backend dependencies"
(cd Server && npm ci --omit=dev)

echo "==> Applying database migrations"
(cd Server && npx prisma generate && npx prisma migrate deploy)

echo "==> Installing frontend dependencies"
(cd aster && npm ci)

echo "==> Building frontend"
(cd aster && npm run build)

echo "==> Reloading PM2 processes"
mkdir -p deploy/logs
if pm2 describe aster-server >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js --update-env
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo "==> Waiting for processes to come up"
sleep 5

echo "==> Health check: backend (127.0.0.1:5000)"
curl -fsS http://127.0.0.1:5000/ >/dev/null

echo "==> Health check: frontend (127.0.0.1:3000)"
curl -fsS http://127.0.0.1:3000/ >/dev/null

echo "==> Deploy complete. Now at commit $(git rev-parse HEAD)"
