# Onboarding Report (`ONBOARDING_REPORT.md`)

> Migration report: Bottega on Antigravity -> `bottega-dev` on Claude Code. Snapshot of the baseline; don't rewrite it later, add a new dated report instead.

## 1. Summary
- **Repository**: `/home/marco/work/menu-design-2` (GitHub `mrclttnz/menu-family-planner`) · **Onboarded on**: 2026-11-21 · 47 commits, branch `chore/migrate-to-claude`
- **What it does**: Family meal-planning web app: dish catalog (multi-course, tags, recipe sources, import/export), per-member preferences, exception-based attendance, meal calendar with compatibility alerts, Today view, weekly print, IT/EN UI, theming. Single household login + member switcher.
- **Profile**: `forge` (unchanged) — multi-tenant authenticated app exposed to the internet via Cloudflare Tunnel, family data only.
- **Mode**: migration. Existing docs were reused; no application code was changed. Added/changed files: `CLAUDE.md`, `docs/PROJECT_STATE.md` (template update), `docs/DELIVERY_PLAN.md`, this report.

## 2. Inventory
| Area | Findings |
| :--- | :--- |
| Languages & runtimes | Python 3.14.4, Node 24.18 (Dockerfile: `python:3.14-slim`, `node:24-alpine`) |
| Frameworks | FastAPI, Pydantic v2, SQLAlchemy 2, pyjwt, bcrypt, openpyxl; React 18, Vite 5, Tailwind 3, i18next |
| Entry points | `backend/app/main.py` (uvicorn, serves API `/api/v1` + built SPA), `run_dev.sh`, `scripts/build_and_push_dockerhub.sh` |
| Modules | `backend/app/{routers,schemas,models,services,core,api}`, `frontend/src/components` (see `docs/ARCHITECTURE.md`) |
| Data layer | SQLite dev / PostgreSQL 16 prod; `create_all` + `app/core/migrations.py` at startup; **no Alembic** |
| Configuration | `.env`, `.env.production` (gitignored, not tracked), `.env.example`, `.env.production.example`; `docker-compose.yml` tracked, `docker-compose.prod.yml` gitignored |
| Tests | pytest, 40 backend tests (API integration, in-memory SQLite); 0 frontend tests |
| Build / CI / Containers | Multi-stage non-root Dockerfile with HEALTHCHECK; compose; **no CI workflows** (`.github/` only has issue templates) |
| Existing docs | PRD, ARCHITECTURE, DB_SCHEMA, TEST_PLAN, SECURITY_AUDIT, DEPLOYMENT_RUNBOOK, DEPLOYMENT_DOCKER_EXTERNAL, PROJECT_STATE; GitHub Issues backlog |
| Git hotspots | `CalendarView.tsx` (23), `DishesView.tsx` (17), `it.json`/`en.json` (16), `App.tsx` (14), `TodayView.tsx` (11) |

## 3. Baseline Health
No dependency was installed and no service started (`backend/.venv` and `frontend/node_modules` already existed).

| Check | Command | Result |
| :--- | :--- | :--- |
| Install | not run | N/A (deps pre-installed) |
| Build | `vite build --outDir <scratch>` (after `tsc`) | PASS (1996 modules, 4 s; output kept out of the repo) |
| Tests | `DATABASE_URL=sqlite:///<scratch>/test.db pytest -q` | PASS 40/40, 1 deprecation warning (starlette TestClient + httpx) |
| Lint | — | N/A, no linter configured |
| Typecheck | `tsc --noEmit` | PASS (no backend typechecker) |
| Security scan | `security-scan.sh . spark` | PASS, zero findings |
| Dependency audit | `pip-audit -r requirements.txt` / `npm audit` | pip: no known vulns · npm: **1 high + 1 moderate** (esbuild <=0.24.2 via vite <=6.4.3, dev-server only; fix needs a vite major bump) |
| Outdated / EOL | not measured | Python 3.14 / Node 24 are current |

Note (resolved by S23a, #34: `conftest.py` now forces a throwaway DB): tests were run with `DATABASE_URL` overridden because the app lifespan runs `create_all` + seeding against the engine from `.env` (possibly the real DB) even under `TestClient`.

## 4. Findings
| ID | Severity | Area | Finding | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `OB-01` | HIGH | security | No rate limiting on `/auth/login` and `/auth/register` (SEC-F02 still open); app is reachable via Cloudflare Tunnel and on LAN :8000; bcrypt cost 12 makes bursts a CPU DoS | `backend/app/routers/auth.py`; no limiter in `backend/app` |
| `OB-02` | MEDIUM | security | SEC-F03 (CORS methods/headers) and SEC-F04 (HSTS) open | `docs/SECURITY_AUDIT.md`, `backend/app/main.py:39-52` |
| `OB-03` | MEDIUM | dependencies | esbuild/vite advisories (dev server only) | `npm audit` |
| `OB-04` | MEDIUM | build | No CI: tests, build and scanner never run automatically | `.github/` |
| `OB-05` | MEDIUM | tests | No frontend tests; print engine (Issue #22) lives in `CalendarView.tsx` untested; no tests for migrations, config validator, security headers | `frontend/`, `backend/tests/` |
| `OB-06` | MEDIUM | architecture | `migrations.py` runs destructive/DDL steps at every startup (dish de-dupe, Postgres-only `SERIAL`), untested | `backend/app/core/migrations.py` (per delivery-planner review) |
| `OB-07` | LOW | docs | Docs drift, see §5 | |
| `OB-08` | LOW | dependencies | Both `psycopg` and `psycopg2-binary` in requirements | `backend/requirements.txt` |
| `OB-09` | LOW | build | No linter / backend typecheck; `package.json` has no `typecheck`/`lint`/`test` scripts | `frontend/package.json` |
| `OB-10` | LOW | operations | `docker-compose.prod.yml` is documented but gitignored (`*prod*.yml`), so not reproducible from the repo | `.gitignore:27` |
| `OB-11` | LOW | security | JWT lifetime 7 days, stored client-side; no revocation | `backend/app/core/config.py:11` |

## 5. Documentation vs Code Alignment
| # | Document | Says | Code reality |
| :--- | :--- | :--- | :--- |
| 1 | ARCHITECTURE §1/§2/§4, DB_SCHEMA §1 | Alembic migrations, `backend/alembic/` | No `alembic/` dir; real mechanism is `create_all` + `app/core/migrations.py` |
| 2 | SECURITY_AUDIT SEC-F01 `OPEN` | Default SECRET_KEY not blocked in production | Validator exists (`config.py:21-28`); finding is fixed, report stale |
| 3 | SECURITY_AUDIT (dated 2026-10-25) | Gate 6 covers the system | Audit predates S8–S23 (import/export, print, tags, themes...); per-slice "APPROVE" is not backed by an updated report |
| 4 | PROJECT_STATE index (before this update) | Test Plan "27/27 passing" | 40/40 (gate log already said 40). Fixed |
| 5 | PROJECT_STATE | Gate 4 never recorded | Slice table had one combined column; now per-slice columns, legacy values carried over |
| 6 | DB_SCHEMA | Section numbers 3.7/3.8 used twice | Cosmetic |
| 7 | ARCHITECTURE | Jumps from §7 to §11 | Cosmetic |
| 8 | DEPLOYMENT_RUNBOOK | `docker-compose.prod.yml` | Exists locally but untracked |
| 9 | ARCHITECTURE §1/PROJECT_STATE | "SQLite dev / Postgres prod" | Consistent, but PROJECT_STATE row says only PostgreSQL; local dev default is SQLite |
| 10 | PROJECT_STATE (previous) | Threat model inline in ARCHITECTURE §6 | OK for forge; no standalone file |
| 11 | DEPLOYMENT docs | Mix of Italian and English | Language policy says English for artifacts |
| 12 | PRD/TEST_PLAN | US-01…US-17 | Slices S18–S23 (errors, theme, print, notes) have no matching US/TEST_PLAN rows (not verified exhaustively) |

I did not edit these docs (items 1–3, 6–12 are scheduled in S25/S29 or need your call).

## 6. Inferred Requirements to Confirm
The PRD already exists and was approved at Gate 1, so none were reconstructed. Please only confirm that PRD US-01…US-17 still reflect intent, and whether S18–S23 behaviors need PRD entries (row 12 above).

## 7. Test Gaps on Critical Paths
- Frontend: nothing (print engine, theme, date, error/taxonomy utils, i18n key parity IT/EN).
- Backend: config/JWT edge cases, security headers/CORS, startup migrations, import/export edge cases, auth lockout (n/a until S24).
- Characterization tests required before touching `CalendarView.tsx` (S32) and `migrations.py` (S34).

## 8. Prioritized Backlog (see `docs/DELIVERY_PLAN.md`)
1. **S24** auth rate limiting (OB-01) · **S25** CORS/HSTS + audit refresh (OB-02)
2. **S26** CI + linters · **S27** frontend test harness · **S28** vite upgrade (OB-03/04/09)
3. **S29** migrations decision + docs/deps/prod compose (OB-06/07/08/10) · **S30/S31** characterization tests
4. Features: **S32** #23, **S33** #11, **S34** Alembic (conditional), **S35–36** #5 (blocked: decisions)
5. Blocked/out of scope: S37 (#3), S38 (#4), S39 (#6), S40 (#14/#15)

Open questions from the planner: Alembic vs documenting status quo (S29, planner recommends Alembic); S28 before or after S31; answers for #5 (roles, onboarding, member link, existing-household migration, password reset, token claims); acceptance criteria of #11, #23, #5 (planner had no shell and could not read the issues).

## 9. Antigravity / Bottega Leftovers
Searched the repo (excluding `node_modules`, `.venv`, `.git`): **no `.agents/`, no `GEMINI.md`/`AGENTS.md`, no copies of Bottega scripts, no CI using the scanner.** Only textual mentions of "Bottega" inside docs (kept; they are accurate). Proposal:
| Item | Proposal |
| :--- | :--- |
| `scripts/build_and_push_dockerhub.sh` | Keep (project script, not Bottega) |
| `last-modified-files.sh` | Personal helper, keep or delete at your choice (not Bottega) |
| `workfiles/` (gitignored: menu.odt, import samples) | Keep local, no action |
| `.pytest_cache/`, `app.db`, `backend/app.db`, `backend/menu_design.db` | Untracked/ignored; no action |
| `docs/legacy/` (empty dir) | Remove (git doesn't track it) — optional |
| Security scanner | The plugin's scanner is used from `${CLAUDE_PLUGIN_ROOT}`; no local copy to keep. Add it to CI in S26 |

## 10. Gate B — Baseline Approved
- [x] Profile confirmed (`forge`) · [x] Inferred requirements reviewed (PRD kept as is) · [x] Backlog priorities agreed — 2026-11-21. Decisions: Alembic adopted (S29/S34); #5 questions asked before S35 coding; acceptance criteria for #11/#23/#5 taken from GitHub; issues #24–#32 created for S24–S31 and S34.
