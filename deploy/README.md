# Deployment

Runs `aster` (Next.js) and `Server` (Express/Prisma) on one Ubuntu VPS under
PM2, behind Nginx on two subdomains with HTTPS. GitHub Actions deploys on
every push to `main`.

## One-time server setup

On a fresh Ubuntu 22.04/24.04 box, as a sudo-capable user:

```bash
git clone <your-repo-url> /var/www/aster
cd /var/www/aster
sudo APP_DOMAIN=app.example.com \
     API_DOMAIN=api.example.com \
     REPO_URL=<your-repo-url> \
     DB_PASSWORD=<pick-a-password> \
     LETSENCRYPT_EMAIL=you@example.com \
     bash deploy/setup-server.sh
```

This installs Node, PM2, Nginx, Postgres, Certbot; creates the Postgres
role/db; installs the two Nginx sites and SSL certs; and registers PM2 to
start on boot.

The script will tell you to create two env files that it deliberately does
not manage (they're gitignored, so `git reset --hard` in `deploy.sh` never
touches them):

- **`Server/.env`** — needs at least `DATABASE_URL`, `JWT_SECRET`,
  `CORS_ORIGIN=https://app.example.com` (see `Server/.env.example` if
  present for the full list).
- **`aster/.env.production`** — needs `NEXT_PUBLIC_API_URL=https://api.example.com`.
  This is baked in at build time, so it must exist *before* the first
  `npm run build`.

Once both files exist, run the first deploy by hand:

```bash
cd /var/www/aster && bash deploy/deploy.sh
```

## GitHub Actions setup

Add these secrets in the repo's Settings → Secrets and variables → Actions:

| Secret            | Value                                              |
|-------------------|-----------------------------------------------------|
| `SSH_HOST`        | Server IP or hostname                              |
| `SSH_USER`        | SSH user with access to `/var/www/aster`           |
| `SSH_PORT`        | SSH port (usually `22`)                            |
| `SSH_PRIVATE_KEY` | Private key matching a public key in the server's `~/.ssh/authorized_keys` |

After that, every push to `main` runs `.github/workflows/deploy.yml`, which
SSHes in and runs `deploy/deploy.sh`.

## Ongoing deploys

- Automatic: push/merge to `main`.
- Manual: `cd /var/www/aster && bash deploy/deploy.sh`, or trigger the
  workflow manually from the Actions tab (`workflow_dispatch`).

## Rollback

`deploy.sh` prints the previous commit SHA before pulling. To roll back:

```bash
cd /var/www/aster
git checkout <previous-sha>
bash deploy/deploy.sh
```

## Useful commands on the server

```bash
pm2 status                 # process states
pm2 logs aster-server      # backend logs
pm2 logs aster-frontend    # frontend logs
sudo nginx -t              # validate Nginx config
sudo systemctl status nginx
```
