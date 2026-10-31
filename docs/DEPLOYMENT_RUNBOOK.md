# Deployment & Operations Runbook (`docs/DEPLOYMENT_RUNBOOK.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Deployment Target**: Self-Hosted Local Stack (PostgreSQL 16 + FastAPI/React) + Cloudflare Tunnel (Remote HTTPS)  
> **Author**: Bottega DevOps & SRE Specialist (`devops-sre`)

---

## 1. Architettura della Soluzione

- **Backend & Frontend**: Container unificato `menu-design-app` (FastAPI serve sia le API `/api/v1` sia il bundle statico React compilato).
- **Database**: PostgreSQL 16 Alpine gestito in locale con volume persistente `postgres_data`.
  - **Accesso LAN**: Porta `5432` esposta sulla macchina server per consentire connessioni dirette dalla rete domestica (es. DBeaver, DataGrip, pgAdmin).
  - **Sicurezza**: La porta `5432` non viene mai esposta su Internet dal router.
- **Accesso Remoto Sicuro**: Cloudflare Tunnel (opzionale/on-demand) per consentire l'accesso sicuro via HTTPS da smartphone all'esterno, senza aprire porte sul firewall o router domestico.

---

## 2. Configurazione Rapida (.env)

Crea il tuo file `.env` a partire da `.env.example`:

```bash
cp .env.example .env
```

Genera una chiave segreta sicura e impostala nel file `.env`:
```bash
# Genera SECRET_KEY a 32 byte
openssl rand -hex 32
```

Nel file `.env` imposta anche una password robusta per `POSTGRES_PASSWORD`:
```env
ENVIRONMENT=production
SECRET_KEY=<chiave_generata_con_openssl>
POSTGRES_DB=menu_design
POSTGRES_USER=menu_user
POSTGRES_PASSWORD=<tua_password_sicura>
CORS_ORIGINS=http://localhost:8000,http://<IP_LOCALE_SERVER>:8000,https://menu.tuodominio.it
TUNNEL_TOKEN=<token_cloudflare_opzionale>
```

---

## 3. Avvio dell'Applicazione con Docker Compose

### Solo App + Database Locale (Accesso da rete locale)
```bash
# Avvia Postgres e l'applicazione in background
docker compose up -d --build

# Visualizza lo stato dei container e dell'healthcheck
docker compose ps

# Visualizza i log in tempo reale
docker compose logs -f app
```

L'applicazione sarà accessibile all'indirizzo:
- Dal server stesso: `http://localhost:8000`
- Da qualsiasi dispositivo connesso alla Wi-Fi di casa: `http://<IP_SERVER_LAN>:8000` (es. `http://192.168.1.50:8000`)

### Con Cloudflare Tunnel (Accesso Remoto sicuro da smartphone/internet)
Quando hai creato il tunnel sulla dashboard Cloudflare Zero Trust e inserito `TUNNEL_TOKEN` nel file `.env`:
```bash
# Avvia App, Postgres e Cloudflare Tunnel
docker compose --profile tunnel up -d
```
L'app sarà immediatamente raggiungibile al tuo dominio pubblico (es. `https://menu.tuodominio.it`) con certificato SSL valido.

---

## 4. Accesso a PostgreSQL dalla Rete Domestica (LAN)

Puoi connetterti al database direttamente dal tuo PC o laptop (es. tramite DBeaver, pgAdmin, DataGrip o CLI):

- **Host / Indirizzo**: IP locale del server (es. `192.168.1.50` oppure `localhost` se sei sulla stessa macchina)
- **Porta**: `5432`
- **Database**: `menu_design` (o il valore di `POSTGRES_DB`)
- **Username**: `menu_user` (o il valore di `POSTGRES_USER`)
- **Password**: quella configurata in `POSTGRES_PASSWORD`

### Connessione rapida da terminale (psql):
```bash
psql -h <IP_SERVER_LAN> -p 5432 -U menu_user -d menu_design
```

### Accesso diretto tramite il container:
```bash
docker exec -it menu-design-postgres psql -U menu_user -d menu_design
```

---

## 5. Manutenzione e Backup di PostgreSQL

### Eseguire un backup manuale istantaneo
```bash
# Salva un dump compresso con timestamp
docker exec -t menu-design-postgres pg_dump -U menu_user menu_design | gzip > backup_menu_design_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Ripristinare un backup
```bash
gunzip < backup_menu_design_YYYYMMDD_HHMMSS.sql.gz | docker exec -i menu-design-postgres psql -U menu_user -d menu_design
```

### Backup automatico giornaliero (Cron job sul server)
Puoi aggiungere un cron job con `crontab -e`:
```bash
0 3 * * * docker exec -t menu-design-postgres pg_dump -U menu_user menu_design | gzip > /home/marco/backups/menu_db_$(date +\%Y\%m\%d).sql.gz
```

---

## 6. Health Checks & Monitoraggio

- **Healthcheck App**: `GET /health` (restituisce `{"status": "ok", "app": "Menu Design API", "version": "1.0.0"}`)
- **Verifica salute Postgres**:
  ```bash
  docker inspect --format='{{json .State.Health.Status}}' menu-design-postgres
  # Output: "healthy"
  ```
