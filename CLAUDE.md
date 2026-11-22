# Menu Design

Family meal-planning web app (dish catalog, per-member preferences, exception-based attendance, meal calendar with compatibility alerts, IT/EN UI). Bottega profile: `forge`. Read `docs/PROJECT_STATE.md` first: phase, slices, gates and the index of every spec.

## Stack
- Backend: Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2, JWT (pyjwt) + bcrypt, pytest; venv in `backend/.venv`, deps in `backend/requirements.txt`
- Frontend: TypeScript (Node 24), React 18, Vite 5, Tailwind 3, i18next; npm (`frontend/package-lock.json`)
- Database: SQLite (dev, `backend/app.db`) / PostgreSQL 16 (prod, docker compose). Schema created at startup via `create_all` + `app/core/migrations.py` (no Alembic)
- Single container in prod: FastAPI serves the built SPA from `frontend/dist`

## Commands
| Purpose | Command |
| :--- | :--- |
| Install dependencies | `TBD` (not run during onboarding; `backend/.venv` and `frontend/node_modules` already exist. Expected: `pip install -r backend/requirements-dev.txt` / `cd frontend && npm ci`; CI uses the same) |
| Run locally | `./run_dev.sh` (unverified; serves API + built SPA on :8000; DB is whatever `DATABASE_URL` in `.env` points to) |
| Full test suite | `cd backend && .venv/bin/python -m pytest -q` (40 pass; isolated from the real DB by `tests/conftest.py`) |
| Single test | `cd backend && .venv/bin/python -m pytest tests/test_auth.py::<name>` |
| Lint | `cd backend && .venv/bin/ruff check .`; `cd frontend && npm run lint` (ESLint, baseline of 20 warnings via `--max-warnings`; no formatter enforced) |
| Typecheck | `cd frontend && npm run typecheck` |
| Build | `cd frontend && npm run build` (= `tsc && vite build`; verified with `--outDir` elsewhere) |
| DB migrations | `TBD` (runtime auto-migrations in `backend/app/core/migrations.py`) |
| Security scan | `bash scripts/security-scan.sh . forge` (vendored copy of the Bottega scanner) |
| CI | `.github/workflows/ci.yml`: backend (ruff+pytest), frontend (lint+typecheck+build), security (scanner, pip-audit, npm audit report-only until S28) |
| Dependency audit | `cd backend && pip-audit -r requirements.txt`; `cd frontend && npm audit` |

## Conventions
- Layout: `backend/app/{routers,schemas,models,services,core,api}`, `frontend/src/components`; details in `docs/ARCHITECTURE.md`. API prefix `/api/v1`.
- Tests are isolated by default: `tests/conftest.py` forces `DATABASE_URL` to a throwaway SQLite before importing `app.*` (the app lifespan runs `create_all` + seeding on that engine) and asserts it. Keep that block above any `app` import.
- Every query is scoped by household (anti-IDOR); Pydantic schemas use `extra="forbid"`.
- UI strings go through i18n (`frontend/src/locales/{it,en}.json`), no hardcoded text.
- Commits: Conventional Commits (`feat(scope): ...`), referencing the GitHub Issue `#ID`.

## Project Rules
- Never commit or print `.env`, `.env.production`, `docker-compose.prod.yml` (gitignored, hold real config) or `*.db` files.
- GitHub Issues (titles, bodies, acceptance criteria) are written in Italian, like the existing backlog; docs in `docs/` and code stay in English.
- `workfiles/` is a local scratch folder (gitignored); do not rely on it.
