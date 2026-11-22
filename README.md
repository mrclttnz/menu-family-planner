# Menu Design

**A family-first meal planning web app.** Catalog the dishes your family loves, remember where each recipe lives, track who likes what, and plan the week knowing who will actually be at the table, with the app warning you before you cook something a present diner dislikes.

The UI is available in **Italian and English**, is mobile-first (built for the kitchen counter and the phone in your hand), and runs as a single self-hosted container.

---

## Why Menu Design

Planning family meals is a recurring source of friction:

- The same 4-5 dishes keep coming back because nobody remembers the others.
- Recipes found in books, reels and newsletters get lost.
- Nobody remembers who dislikes what, or who is home for dinner.

Menu Design turns these into a shared, always-available household workspace.

## Features

**Dish catalog**
- Multi-course dishes (starter, first, second, side, single dish, dessert, drink), a configurable status (to try, OK, discarded, favorite, ...) and free-form tags with colors.
- Recipe source tracking: cookbook and page, URL, social bookmark, newsletter or personal notes.
- Compact card view and full list view; filters shared across views.
- Duplicate-name prevention and whitespace sanitization.
- Import and export as **Excel, CSV and JSON** (with formula-injection defense on export).

**Preferences and attendance**
- Per-member preference for each dish: `favorite`, `neutral` (default) or `dislike`.
- **Exception-based attendance**: everyone is assumed present; you only record who is away.
- Dynamic daily meal slots (lunch, dinner, brunch, snack).

**Meal calendar**
- Multi-day planner with alternative dishes, notes per slot and meal ratings.
- **Smart compatibility alerts** when a planned dish is disliked by a member who will be present.
- Edit assigned dishes and diners, attendance indicator and modal.
- **Today view** with slot notes and full dish details.
- **Weekly menu print** layout for the fridge.

**Platform**
- Household accounts with a member switcher (children need no credentials).
- Dynamic UI theme and base color palette customization.
- Localized, user-friendly validation and error messages.

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Backend | Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2, pytest |
| Auth | JWT (pyjwt) + bcrypt, per-client rate limiting on login/register |
| Frontend | TypeScript, React 18, Vite 5, Tailwind CSS 3, i18next |
| Database | SQLite (development, tests) / PostgreSQL 16 (production) |
| Deployment | Single Docker image (FastAPI serves the built SPA), Docker Compose, optional Cloudflare Tunnel |

## Security by design

- **Multi-tenant isolation**: every query is scoped by household (anti-IDOR).
- **Strict input validation**: Pydantic schemas with `extra="forbid"`.
- **Auth hardening**: bcrypt hashes, JWT, per-IP rate limiting with `429` + `Retry-After`; forwarded client-IP headers are honored only from explicitly trusted proxies.
- **Safe configuration**: the app refuses weak or default secrets in production.
- **Hardened container**: non-root image, database port and app port exposure controlled through Compose.

See `docs/ARCHITECTURE.md` (section 6) and `docs/SECURITY_AUDIT.md`.

## Quick start (development)

Requirements: Python 3.14, Node 24.

```bash
# Backend dependencies
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt

# Frontend dependencies and build
cd frontend && npm ci && npm run build && cd ..

# Run API + built SPA on http://localhost:8000
./run_dev.sh
```

Interactive API docs are served at `http://localhost:8000/docs`. With no configuration, development uses a local SQLite file; point `DATABASE_URL` in `.env` to change that.

For frontend hot reload, run `npm run dev` inside `frontend/` while the backend is running.

## Running with Docker Compose (production-like)

```bash
cp .env.example .env
# edit .env: set SECRET_KEY (openssl rand -hex 32), POSTGRES_PASSWORD, CORS_ORIGINS
docker compose up -d --build
```

This starts the app and PostgreSQL 16. Optional remote HTTPS access goes through a Cloudflare Tunnel (`TUNNEL_TOKEN`). Behind a tunnel, set `TRUSTED_PROXY_IPS` to the `cloudflared` container IP as a `/32` so rate limiting sees real client IPs. A sanitized production template is provided in `docker-compose.prod.yml.example`.

Full details: `docs/DEPLOYMENT_RUNBOOK.md` and `docs/DEPLOYMENT_DOCKER_EXTERNAL.md`.

## Configuration

| Variable | Purpose |
| :--- | :--- |
| `ENVIRONMENT` | `production` or `development` |
| `SECRET_KEY` | JWT signing key, at least 32 characters |
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg://...` or SQLite) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Max login/register attempts per client IP per minute |
| `TRUSTED_PROXY_IPS` | Proxies whose forwarded client-IP headers are trusted |
| `TUNNEL_TOKEN` | Optional Cloudflare Tunnel token |

Never commit `.env`, `.env.production`, the real `docker-compose.prod.yml` or database files.

## Testing and quality

```bash
# Backend tests (isolated from your real database by tests/conftest.py)
cd backend && .venv/bin/python -m pytest -q

# Frontend typecheck and build
cd frontend && node_modules/.bin/tsc --noEmit && npm run build
```

Tests run against a throwaway SQLite database, so they can never touch real data. CI, linters and a frontend test harness are planned (see the delivery plan).

## Project structure

```text
backend/app/{routers,schemas,models,services,core,api}   FastAPI application
backend/tests/                                           pytest suite
frontend/src/components/                                 React views and modals
frontend/src/locales/{it,en}.json                        i18n strings
docs/                                                    PRD, architecture, DB schema, ADRs, runbooks
```

API prefix: `/api/v1`. Schema is created at startup; a move to Alembic is decided in [ADR-0001](docs/adr/0001-adopt-alembic-for-migrations.md) and pending implementation.

## Documentation

| Document | Content |
| :--- | :--- |
| `docs/PROJECT_STATE.md` | Current phase, slices, quality gates, index of all specs |
| `docs/PRD.md` | Requirements and user stories |
| `docs/ARCHITECTURE.md` | Architecture, API contracts, threat model |
| `docs/DB_SCHEMA.md` | Data model |
| `docs/adr/` | Architecture Decision Records |
| `docs/DELIVERY_PLAN.md` | Vertical slice plan and roadmap |
| `docs/TEST_PLAN.md`, `docs/SECURITY_AUDIT.md` | QA and security reports |
| `docs/DEPLOYMENT_RUNBOOK.md` | Operations, rate limiting, tunnel setup |

## Development process

The project is built slice by slice with the Bottega workflow (`forge` profile): each vertical slice passes implementation, QA, and security and code-review gates before it is marked done. The backlog lives in GitHub Issues. Commits follow Conventional Commits and reference the issue (`feat(scope): ... (#ID)`).

## Roadmap

Planned work includes CI and linters, a frontend test harness, Alembic migrations, weekly default attendance, multi-user households, guest attendance, automatic weekly menu suggestions and recipe import from a URL. See `docs/DELIVERY_PLAN.md`.

## License

Copyright (c) 2026 Marco Lattanzio. **All rights reserved.** This is proprietary software: no permission is granted to use, copy, modify, distribute or host it without the author's prior written consent. See [LICENSE](LICENSE).
