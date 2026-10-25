# Deployment & Operations Runbook (`docs/DEPLOYMENT_RUNBOOK.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Status**: Verified & Ready for Operations  
> **Author**: Bottega DevOps & SRE Specialist (`devops-sre`)

---

## 1. Quick Start & Local Execution

### Option A: Local Unified Process (Fastest Local Testing)
1. **Activate Virtualenv and Install Dependencies**:
   ```bash
   source backend/.venv/bin/activate
   pip install -r backend/requirements.txt
   ```
2. **Build Frontend Static Bundle**:
   ```bash
   cd frontend && npm install && npm run build && cd ..
   ```
3. **Run Unified Server**:
   ```bash
   source backend/.venv/bin/activate
   cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
4. **Open Browser**:
   Navigate to `http://localhost:8000` (FastAPI serves both the React application and the `/api/v1` endpoints).

---

### Option B: Dual Development Mode (Live Hot-Reloading)
For active development with hot-reloading on both frontend and backend:
- **Terminal 1 (Backend API)**:
  ```bash
  source backend/.venv/bin/activate
  cd backend && uvicorn app.main:app --reload --port 8000
  ```
- **Terminal 2 (Frontend React Vite Dev Server)**:
  ```bash
  cd frontend && npm run dev
  ```
  Open `http://localhost:5173`. Vite automatically proxies all `/api/*` requests to port 8000.

---

### Option C: Docker & Docker Compose
To run Menu Design in an isolated, non-root, production container:
```bash
# Build and run the containerized app (with SQLite)
docker compose up -d --build

# Check logs
docker compose logs -f

# Check health
curl -f http://localhost:8000/health
```

---

## 2. Production PostgreSQL Deployment

To switch from SQLite to PostgreSQL:
1. Start PostgreSQL via Docker Compose profile:
   ```bash
   docker compose --profile postgres up -d
   ```
2. Update the `DATABASE_URL` environment variable:
   ```env
   DATABASE_URL=postgresql://menu_user:menu_secure_pass_123!@localhost:5432/menu_design
   ```
3. SQLAlchemy and Alembic automatically manage tables on startup.

---

## 3. Operations & Health Checks

- **Health Endpoint**: `GET /health` (returns `{"status": "ok", "app": "Menu Design API", "version": "1.0.0"}`)
- **API Documentation**: Interactive Swagger docs available at `http://localhost:8000/docs`
- **Data Backups**:
  - SQLite: Copy `backend/app.db` (safe during WAL mode via `.backup` or file copy).
  - PostgreSQL: `docker exec -t menu-design-postgres pg_dump -U menu_user menu_design > backup.sql`.
