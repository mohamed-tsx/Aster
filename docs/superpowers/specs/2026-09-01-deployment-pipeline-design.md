# Deployment & CI/CD Pipeline

Date: 2026-09-01

## Goal

Get the Aster app (frontend `aster/` + backend `Server/`) running on a single
production Ubuntu VPS, publicly reachable over HTTPS, with GitHub Actions
auto-deploying on every push to `main`.

## Target environment

- Single Ubuntu 22.04/24.04 VPS.
- Self-hosted Postgres on the same box.
- Two subdomains, e.g. `app.example.com` (frontend) and `api.example.com`
  (backend), each with its own Nginx server block and Let's Encrypt cert.
- Repo lives at `/var/www/aster` on the server.
- Deploy auth: SSH key stored as a GitHub Actions secret.

## Components

1. **`deploy/setup-server.sh`** — one-time, run by hand over SSH on a fresh
   box. Installs Node LTS, PM2, Nginx, Postgres, Certbot; creates the
   Postgres role/db; installs the Nginx site configs (substituting the real
   domain); requests SSL certs; registers `pm2 startup` for boot survival.
   Safe to re-run (checks before installing/creating).

2. **`deploy/deploy.sh`** — run on every deploy (by CI, or by hand). Steps,
   each fatal on failure (`set -euo pipefail`):
   - record current commit SHA for manual rollback reference
   - `git fetch && git reset --hard origin/main`
   - `npm ci` in `Server/` and `aster/`
   - `npx prisma generate` and `npx prisma migrate deploy` in `Server/`
   - `npm run build` in `aster/`
   - `pm2 reload deploy/ecosystem.config.js` (zero-downtime reload)
   - curl health checks against both apps; non-2xx fails the deploy

3. **`deploy/ecosystem.config.js`** — PM2 process definitions:
   `aster-frontend` (`npm run start` in `aster/`, port 3000) and
   `aster-server` (`node cmd/Server/Server.js` in `Server/`, port 5000).

4. **`deploy/nginx/app.conf.template`** and **`deploy/nginx/api.conf.template`**
   — Nginx reverse-proxy server blocks for the two subdomains, with a
   `__DOMAIN__` placeholder substituted by `setup-server.sh`.

5. **`.github/workflows/deploy.yml`** — triggers on push to `main`. SSHes
   into the server using `SSH_HOST` / `SSH_USER` / `SSH_PORT` /
   `SSH_PRIVATE_KEY` secrets and runs `bash /var/www/aster/deploy/deploy.sh`.

## Secrets & environment variables

- `Server/.env` and `aster/.env.production` are created once by hand on the
  server (`DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL=https://api.<domain>`,
  etc.). Both are gitignored already, so `git reset --hard` in `deploy.sh`
  never touches them — they persist across deploys without ever going
  through GitHub.
- GitHub repo secrets needed for CI: `SSH_HOST`, `SSH_USER`, `SSH_PORT`,
  `SSH_PRIVATE_KEY`.

## Error handling / rollback

No blue/green releases directory — YAGNI for a single-server setup.
`deploy.sh` aborts on the first failing step (failed build, failed
migration, failed health check), which fails the GitHub Actions run. The
previous commit SHA is logged so a bad deploy can be rolled back manually
with `git checkout <sha> && bash deploy/deploy.sh`.

## Testing

Scripts are shell-checked locally (`bash -n`) and the workflow YAML is
validated for syntax. Actually exercising `setup-server.sh` and the first
`deploy.sh` run requires a real VPS and is done by the user after these
files are merged.

## Out of scope

- Multi-server / load-balanced setups.
- Blue-green or canary deploys.
- Automated DB backups (separate concern, not blocking "alive and public").
