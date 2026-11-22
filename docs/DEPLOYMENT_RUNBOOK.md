# Deployment & Operations Runbook (`docs/DEPLOYMENT_RUNBOOK.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Deployment Target**: Self-Hosted Local Stack (PostgreSQL 16 + FastAPI/React) + Cloudflare Tunnel (Remote HTTPS)  
> **Author**: Bottega DevOps & SRE Specialist (`devops-sre`)

---

## 1. Solution Architecture

- **Backend & Frontend**: Single `menu-design-app` container (FastAPI serves both the `/api/v1` APIs and the compiled static React bundle).
- **Database**: PostgreSQL 16 Alpine run locally with a persistent `postgres_data` volume.
  - **LAN access**: Port `5432` is exposed on the server machine to allow direct connections from the home network (e.g. DBeaver, DataGrip, pgAdmin).
  - **Security**: Port `5432` is never exposed to the Internet by the router.
- **Secure remote access**: Cloudflare Tunnel (optional/on-demand) to allow secure HTTPS access from a smartphone outside the home, without opening ports on the firewall or home router.

---

## 2. Quick Configuration (.env)

Create your `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Generate a secure secret key and set it in the `.env` file:
```bash
# Generate a 32-byte SECRET_KEY
openssl rand -hex 32
```

In the `.env` file also set a strong password for `POSTGRES_PASSWORD`:
```env
ENVIRONMENT=production
SECRET_KEY=<key_generated_with_openssl>
POSTGRES_DB=menu_design
POSTGRES_USER=menu_user
POSTGRES_PASSWORD=<your_secure_password>
CORS_ORIGINS=http://localhost:8000,http://<SERVER_LOCAL_IP>:8000,https://menu.yourdomain.com
TUNNEL_TOKEN=<optional_cloudflare_token>
AUTH_RATE_LIMIT_PER_MINUTE=10
TRUSTED_PROXY_IPS=<cloudflared_container_IP>/32
```

### Login/registration rate limiting and client IP (SEC-F02)
`POST /api/v1/auth/login` and `/register` are limited to `AUTH_RATE_LIMIT_PER_MINUTE` requests per minute per IP and per endpoint (`429` response with a `Retry-After` header). The state is kept in process memory: the image uses a single uvicorn worker; with multiple workers/replicas the limit would have to move to a shared store.

- **Direct LAN access (port 8000)**: leave `TRUSTED_PROXY_IPS` empty or restricted to the proxy; the IP used is the connection's peer address.
- **Behind Cloudflare Tunnel**: `cloudflared` reaches the app over the Docker network, so without configuration all users share the same IP (an attacker would lock everyone out). Set `TRUSTED_PROXY_IPS` to **the IP of the `cloudflared` container only, as a `/32`** (e.g. `172.18.0.3/32`; `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <cloudflared_container>`, ideally pinned with `ipv4_address` in the compose file so it does not change on restart). **Do not trust the whole subnet**: with Docker's NAT/userland proxy, LAN clients on port 8000 can appear with the bridge gateway IP, which is inside the subnet, and could spoof `CF-Connecting-IP` to bypass the limit. Only trusted peers get their `CF-Connecting-IP` and `X-Forwarded-For` headers honored.
- If you use a separate production compose file (`docker-compose.prod.yml`, not versioned; the versioned template is `docker-compose.prod.yml.example`, which already leaves port 8000 unpublished and pins the tunnel IP), it must also pass `TRUSTED_PROXY_IPS` and `AUTH_RATE_LIMIT_PER_MINUTE` to the app, like `docker-compose.yml`.
- All attempts are counted (including successful logins and requests with an invalid body). IPv6 addresses are grouped per /64; IPv4-mapped addresses are normalized to IPv4.
- **If the tunnel is the only entry point**: do not publish port 8000 on the host. In `docker-compose.yml` remove `"8000:8000"` from the `ports` section of the `app` service (or use `expose: ["8000"]`; `docker-compose.prod.yml.example` already does this): `cloudflared` still reaches the app over the internal Docker network, and no LAN client can bypass the tunnel or appear with the gateway IP. If you do need direct LAN access, leave the port published and keep `TRUSTED_PROXY_IPS` restricted to the `/32` of `cloudflared` only.
- Optional: add a WAF rate limiting rule on Cloudflare for `/api/v1/auth/*` as an upstream defense (it does not cover LAN access).

---

## 3. Starting the Application with Docker Compose

### App + Local Database Only (local network access)
```bash
# Start Postgres and the application in the background
docker compose up -d --build

# Show container and healthcheck status
docker compose ps

# Follow the logs in real time
docker compose logs -f app
```

The application will be reachable at:
- From the server itself: `http://localhost:8000`
- From any device connected to the home Wi-Fi: `http://<SERVER_LAN_IP>:8000` (e.g. `http://192.168.1.50:8000`)

### With Cloudflare Tunnel (secure remote access from smartphone/internet)
Once you have created the tunnel on the Cloudflare Zero Trust dashboard and set `TUNNEL_TOKEN` in the `.env` file:
```bash
# Start App, Postgres and Cloudflare Tunnel
docker compose --profile tunnel up -d
```
The app will be immediately reachable at your public domain (e.g. `https://menu.yourdomain.com`) with a valid SSL certificate.

---

## 4. Accessing PostgreSQL from the Home Network (LAN)

You can connect to the database directly from your PC or laptop (e.g. with DBeaver, pgAdmin, DataGrip or the CLI):

- **Host / Address**: local IP of the server (e.g. `192.168.1.50`, or `localhost` if you are on the same machine)
- **Port**: `5432`
- **Database**: `menu_design` (or the value of `POSTGRES_DB`)
- **Username**: `menu_user` (or the value of `POSTGRES_USER`)
- **Password**: the one configured in `POSTGRES_PASSWORD`

### Quick connection from a terminal (psql):
```bash
psql -h <SERVER_LAN_IP> -p 5432 -U menu_user -d menu_design
```

### Direct access through the container:
```bash
docker exec -it menu-design-postgres psql -U menu_user -d menu_design
```

---

## 5. PostgreSQL Maintenance and Backup

### Run an immediate manual backup
```bash
# Save a compressed, timestamped dump
docker exec menu-design-postgres pg_dump -U menu_user menu_design | gzip > backup_menu_design_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore a backup
The dump is plain SQL: restoring it over existing tables fails with "already exists" errors, so recreate the database first, with the app stopped.
```bash
docker stop menu-design-app
docker exec menu-design-postgres psql -U menu_user -d postgres -c "DROP DATABASE menu_design WITH (FORCE);"
docker exec menu-design-postgres psql -U menu_user -d postgres -c "CREATE DATABASE menu_design OWNER menu_user;"
gunzip < backup_menu_design_YYYYMMDD_HHMMSS.sql.gz | docker exec -i menu-design-postgres psql -U menu_user -d menu_design -v ON_ERROR_STOP=1
docker start menu-design-app
```
Never use `-t` on these commands: no TTY must be allocated when stdin/stdout are redirected or in cron (`-i` is enough for stdin).

### Automatic daily backup (cron job on the server)
You can add a cron job with `crontab -e`:
```bash
0 3 * * * docker exec menu-design-postgres pg_dump -U menu_user menu_design | gzip > /home/marco/backups/menu_db_$(date +\%Y\%m\%d).sql.gz
```

---

## 5b. Database Migrations (Alembic, ADR-0001)

The container entrypoint runs `python -m app.core.db_bootstrap` (= `alembic upgrade head`) before starting uvicorn. If it fails the container exits (the server never starts on a wrong schema).

**First deploy of the Alembic-enabled image on an existing database (one-off):**
1. **Back up first** (section 5): the pre-Alembic fix-ups include a destructive dishes de-duplication (same title ignoring case/whitespace in a household is merged).
2. If the database contains duplicate dishes (same title ignoring case/whitespace in a household) the bootstrap refuses to start and changes nothing until you set `ALLOW_LEGACY_DEDUP=true` in the app environment for that one start (it merges/deletes them; tags of a deleted duplicate are not merged). Remove the variable afterwards. Take the backup immediately before this start, not only the nightly dump, and check it restores. Note `restart: unless-stopped` re-runs the bootstrap on every restart (idempotent; a failing check makes the container loop, see the logs).
3. Start the new image. The bootstrap detects a database with tables but no `alembic_version`, applies the legacy fix-ups, checks nothing is missing against the models, stamps baseline `0001` and upgrades to head. Look for `Pre-Alembic database detected` then `Database is at Alembic head` in `docker compose logs app`.
4. Recommended: first dry-run the bootstrap against a restored copy of the backup (throwaway Postgres, `DATABASE_URL` pointing at it) to see the result before touching prod. Run a single app replica (concurrent bootstraps are not guarded).
5. If it logs `Legacy database does not match the models and was NOT stamped`, the DB is untouched by Alembic: restore the backup (or fix the listed gap) and re-run. Nullability/default drift is tolerated and only logged.

**Later releases**: migrations apply automatically on start. Take a backup before releases that include a new revision.

**Rollback**: redeploying the previous (pre-S34) image is safe on a stamped DB (it ignores `alembic_version`). Never run `alembic downgrade` past baseline `0001` on a real database: it drops every table. To undo a later revision use `alembic downgrade -1` (from `/app/backend`) only after a backup; otherwise restore the backup.

**SQLite (dev)**: before the first `./run_dev.sh` on an existing database copy `app.db` together with its `-wal` and `-shm` files.

**Status / manual commands** (run inside the app container, `cd /app/backend`): `alembic current`, `alembic history`, `alembic check`. Never run Alembic against a database you have not backed up.

## 6. Health Checks & Monitoring

- **App healthcheck**: `GET /health` (returns `{"status": "ok", "app": "Menu Design API", "version": "1.0.0"}`)
- **Postgres health check**:
  ```bash
  docker inspect --format='{{json .State.Health.Status}}' menu-design-postgres
  # Output: "healthy"
  ```
