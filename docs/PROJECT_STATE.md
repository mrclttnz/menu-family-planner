# Project State & Context Index (`PROJECT_STATE.md`)

> Single source of truth maintained by **Bottega Orchestrator**.

## 1. Project Identity & Profile
- **Project Name**: Menu Design
- **One-Line Vision**: Family-first meal planning web application to catalog favorite dishes, track recipe sources, manage diner attendance by exception, and eliminate mealtime friction.
- **Active Bottega Profile**: `forge`
- **Rationale for Profile**: Authenticated multi-tenant (household) data, internet-exposed via Cloudflare Tunnel, personal/family data (no payments, no regulated PII) -> `forge`. Unchanged from original Phase 0 triage.
- **Current Phase**: `Evolution`
- **Origin**: `greenfield` (built with Bottega on Antigravity; tooling migrated to Claude Code / `bottega-dev` on 2026-11-21, see `docs/ONBOARDING_REPORT.md`)

## 2. Key Technology & Architecture Decisions
| Layer | Chosen Technology | Rationale / Trade-off | Status |
| :--- | :--- | :--- | :--- |
| **Language / Runtime** | Python 3.14 (Virtualenv in `backend/.venv`) / TypeScript Node 24 | Clean separation, high performance, robust types | Implemented |
| **Frontend / UI** | React 18 + Vite + Tailwind CSS + Lucide React | Highly responsive, mobile-first kitchen dashboard, fast interaction | Implemented |
| **Backend / API** | FastAPI + Pydantic v2 + Uvicorn | Async REST API, automatic OpenAPI docs, strict schema validation | Implemented |
| **Database & Cache** | PostgreSQL 16 (Docker container) con accesso LAN (porta 5432) | Dati persistenti, supporto concorrenza, accesso diretto locale tramite DBeaver/pgAdmin | Implemented |
| **AuthN / AuthZ** | JWT Bearer + Household Scoping (Anti-IDOR) + Member Profile | Single household login + member switcher, zero trust boundaries | Implemented |
| **Deployment Target** | Self-Hosted Docker Compose (App + Postgres 16) + Cloudflare Tunnel | Accesso locale LAN + accesso sicuro HTTPS remoto senza esporre porte router | Implemented |

## 3. Artifact Index
- **Project Context (stack, commands, conventions, rules)**: `CLAUDE.md` — `[Created - commands verified 2026-11-21; install/lint/migrations TBD]`
- **Requirements Spec**: `docs/PRD.md` — `[Approved - Gate 1]`
- **System Architecture**: `docs/ARCHITECTURE.md` — `[Approved - Gate 2]`
- **Threat Model**: Inline in `docs/ARCHITECTURE.md` (§6) — `[Approved - Gate 2]`
- **Database Design**: `docs/DB_SCHEMA.md` — `[Approved - Gate 3]`
- **Test Plan**: `docs/TEST_PLAN.md` — `[Approved - Gate 5 (40/40 backend tests passing, re-verified 2026-11-21; no frontend tests)]`
- **Security Audit Report**: `docs/SECURITY_AUDIT.md` — `[Approved - Gate 6 (PASS_WITH_WARNINGS); dated 2026-10-25, stale: predates S8-S23, SEC-F01 already fixed in code]`
- **ADR-0001 (Alembic adoption)**: `docs/adr/0001-adopt-alembic-for-migrations.md` — `[Accepted; implemented in S34]`
- **Deployment Runbook**: `docs/DEPLOYMENT_RUNBOOK.md` — `[Approved - Gate 7 (Ready)]`
- **External Docker Runbook (QNAP & Docker Hub)**: `docs/DEPLOYMENT_DOCKER_EXTERNAL.md` — `[Production Ready]`
- **Delivery Plan**: `docs/DELIVERY_PLAN.md` — `[Approved - Gate B]`
- **Onboarding Report**: `docs/ONBOARDING_REPORT.md` — `[Approved - Gate B]`
- **Dynamic Work-Item Backlog**: GitHub Issues ([mrclttnz/menu-family-planner/issues](https://github.com/mrclttnz/menu-family-planner/issues)) — `[Active Backlog]`
- **Archived Suggestions & Feedback**: `docs/archive/suggerimenti.md` — `[Migrated to Issues #1-#4]`

## 4. Vertical Slices & Implementation Backlog
Each slice runs the slice loop (Phases 4–6) and is `DONE` only when its gates have passed. `N/A` = step not required by the profile (Red Tests outside `citadel`).
S1–S23 were delivered before the per-slice gate columns existed: their Gate 4/5/6 values are carried over from the legacy table; Covers/Depends/Size/Docs Sync were not recorded (`—`). S24+ planned by `delivery-planner` (details in `docs/DELIVERY_PLAN.md`).

| Slice ID | Issue Ref | Feature / Module | Covers (US / AC) | Depends On | Size | Sec-Sensitive | Status | Red Tests (4a) | Gate 4 Impl | Docs Sync | Gate 5 QA | Gate 6 Review & Sec |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `S1` | `N/A` | Household Setup, Auth & Member Profiles | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S2` | `N/A` | Master Lookups (`meal_types`, `dish_status_lookups`) & Configurable Taxonomies | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S3` | `N/A` | Multi-Course Dish Catalog & Recipe Sources | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S4` | `N/A` | Member Dish Preferences (`favorite` / `neutral` / `dislike`) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S5` | `N/A` | Dynamic Daily Meal Slots (Pranzo/Cena/Brunch/Merenda) & Exception-Based Attendance | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S6` | `N/A` | Meal Calendar & Smart Preference/Attendance Compatibility Alerts | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S7` | `N/A` | Mobile Dashboard & Kitchen Overview (React SPA) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S8` | `N/A` | Usability & Planning Extensions (Alternative Dishes, Meal Notes, Multi-Views, Quick Create, Meal Ratings) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S9` | `#2` | Dish Catalog Import & Export (Excel, CSV, JSON) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S10` | `#1` | Multi-language Support (i18n: IT/EN) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S11` | `#8` | Meal Planner Attendance Indicator & Modal | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S12` | `#9` | Meal Planner: Edit Assigned Dish & Diners | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S13` | `#10` | Compact Card View for Dish Catalog | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S14` | `#7` | Dish Tags & Cross-View Filtered Selection | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S15` | `#13` | Responsive Mobile Optimization & Compact Vertical Single-Column Flow | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S16` | `#16` | Dish Name Trimming & Whitespace Sanitization | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S17` | `#17` | Prevent Duplicate Dish Name in Catalog | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S18` | `#18` | User-Friendly Localized Error Messages & Validation Feedback | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S19` | `#12` | Dynamic UI Theme & Base Color Palette Customization | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S20` | `#21` | Remove Fake Default Credentials from Login Form | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S21` | `#22` | Weekly Menu Print & Fridge Planner (tech debt: #23) | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S22` | `#20` | Clarify Dish Description vs Notes in Forms & Catalog Views | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S23` | `#19` | Today View Meal Slot Notes & Full Dish Details Visibility | — | — | — | — | `DONE` | `N/A` | `DONE` | `N/A (legacy)` | `PASS` | `APPROVE` |
| `S23a` | `#34` | Test isolation from the real database by default (prerequisite of S24) | — | — | `S` | no | `DONE` | `N/A` | `DONE` | `DONE` | `PASS` | `APPROVE_WITH_NITS (reviewed with S24)` |
| `S24` | `#24` | Auth endpoint rate limiting (SEC-F02) | SEC-F02 | S23a | `M` | yes | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (59/59)` | `PASS_WITH_WARNINGS + APPROVE_WITH_NITS (MEDIUM findings fixed; LOW backlog)` |
| `S25` | `#25` | Security hardening batch + audit report refresh (SEC-F01 close, F03, F04) | SEC-F01/3/4 | — | `S` | yes | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (70/70)` | `PASS_WITH_WARNINGS + APPROVE_WITH_NITS (warnings fixed)` |
| `S26` | `#26` | Quality foundation I: CI, linters, typecheck | QF-1..3 | — | `M` | partly | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (70/70; CI green, red on deliberate failure)` | `PASS_WITH_WARNINGS + APPROVE_WITH_NITS (LOW findings fixed; action SHA pinning/Dependabot and npm audit enforcement go to S28)` |
| `S27` | `#27` | Quality foundation II: frontend test harness | QF-4 | S26 | `S` | no | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (7 frontend tests, 70/70 backend; CI green)` | `APPROVE_WITH_NITS (nits fixed)` |
| `S28` | `#28` | Frontend toolchain upgrade (vite/esbuild advisories) | NPM-AUDIT | S26, S27 | `S` | yes | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (7 frontend tests, 70/70 backend; npm audit 0 vulns)` | `APPROVE_WITH_NITS + PASS (docs nits fixed; manual print/theme/i18n browser check done by the user 2026-11-22)` |
| `S29` | `#29` | Decision (Alembic, ADR) + docs: duplicate psycopg, prod compose | DOC-1..3 | — | `S` | no | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (60/60, Docker build OK)` | `APPROVE_WITH_NITS` |
| `S30` | `#30` | Backend characterization tests (config, headers, migrations, import/export, auth) | TG-1..3 | S24, S25 | `M` | yes | `DONE` | `N/A` | `DONE` | `DONE` | `PASS (210/210; 8 defects logged as #49-#56, not fixed)` | `APPROVE_WITH_NITS + PASS_WITH_WARNINGS (nits fixed; MEDIUM warnings #55, #56 and a cross-tenant IDOR matrix test are follow-ups)` |
| `S31` | `#31` | Frontend characterization tests (print, theme, i18n, utils) | TG-4, TG-5 | S27 | `M` | no | `READY` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S32` | `#23` | Print layout tech debt | GH#23 AC | S31 | `M` | no | `READY after S31` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S33` | `#11` | Weekly default attendance | GH#11 (AC derived, confirm at start) | S29, S30, S34 | `M` | no | `READY` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S34` | `#32` | Migrations tooling implementation (Alembic) | DOC-1 | S29, S30 | `M` | yes | `READY` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S35` | `#5` | User management I: identity model split + auth refactor | GH#5 AC | S24, S34, S30 | `M` | yes | `BLOCKED: questions asked before coding` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S36` | `#5` | User management II: manage users in a household | GH#5 AC | S35 | `M` | yes | `BLOCKED: questions asked before coding` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S37` | `#3` | Guest attendance in planned meals | — | — | `—` | — | `BLOCKED: needs spec` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S38` | `#4` | Automatic weekly menu suggestion | — | — | `—` | — | `BLOCKED: needs spec` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S39` | `#6` | Recipe scraping from source URL | — | — | `—` | yes (SSRF) | `BLOCKED: needs spec` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |
| `S40` | `#14, #15` | Native Android / iOS apps | — | — | `—` | — | `OUT OF SCOPE (epic only)` | `N/A` | `TODO` | `TODO` | `TODO` | `TODO` |

## Release Prerequisites
Actions that must be done in an environment before (or during) the next release. Whoever introduces one adds a row in the same task (e.g. a production variable with no safe default, an external setup step, a one-off data migration, a secret to rotate). Gate 7 can't pass while a row for the target environment is `OPEN`.

| ID | Action before release | Environment | Introduced by | Status |
| :--- | :--- | :--- | :--- | :--- |
| `RP-02` | Take a database backup, then deploy the S34 image: its first start stamps the existing prod/QNAP DB with the Alembic baseline (after the legacy fix-ups, incl. the dishes de-duplication). Check logs for `Database is at Alembic head`. See `docs/DEPLOYMENT_RUNBOOK.md` section 5b. | `prod` | `S34` | `OPEN` |
| `RP-01` | Set `TRUSTED_PROXY_IPS` to the exact IP of the cloudflared container as `/32` (never the whole docker subnet); if `docker-compose.prod.yml` is separate from `docker-compose.yml`, also pass `TRUSTED_PROXY_IPS` and `AUTH_RATE_LIMIT_PER_MINUTE` through to the `app` service. See `docs/DEPLOYMENT_RUNBOOK.md` (rate limiting section). Prod compose now pins the tunnel IP and no longer publishes port 8000 (templates: `docker-compose.prod.yml.example`, `.env.production.example`); Closed 2026-11-22 at the user's request. Verified in prod by the user: tunnel IP pinned, port 8000 closed, and rate limiting counted per real client IP behind the tunnel (tested from two different IPs). | `prod` | `S24` | `DONE` |

## 5. Quality & Security Gate Log
- **[x] Gate B (Baseline Approved)**: 2026-11-21. User confirmed profile `forge`, existing PRD kept (no reconstruction), backlog priorities (security S24/S25 first, then S26–S28), decision to adopt Alembic (S29/S34). Questions on #5 deferred to just before coding S35. Baseline in `docs/ONBOARDING_REPORT.md`.
- [x] **Gate 1 (Requirements Approved)**: PRD signed off with multi-course support, configurable classifications, and member dish preferences.
- [x] **Gate 2 (Architecture & Threat Model Approved)**: Decoupled FastAPI + React SPA with SQLite/Postgres and Option 1 (`favorite` / `neutral` / `dislike`).
- [x] **Gate 3 (DB Schema & Modules Approved)**: Normalized `dish_status_lookups`, dynamic daily `meal_types`, exception-based attendance, and normalized `tags`/`dish_tags`.
- [x] **Gate 5 (Automated Tests Passing — Evidence Recorded; historical, global)**: 40 automated tests passing with 100% success rate in `backend/tests/` and frontend bundle verified with dynamic CSS variable theme generation and localized UI error handling.
- [x] **Gate 6 (Security Audit & Adversarial Code Review Passed)**:
  - `security-engineer`: **`PASS_WITH_WARNINGS`** (0 Critical, 0 High). Report in `docs/SECURITY_AUDIT.md`.
  - `code-reviewer`: **`APPROVE`** (All 3 blockers remediated and verified).
- [x] **Gate 7 (Deployment Verified)**: Hardened non-root `Dockerfile`, `docker-compose.yml` con PostgreSQL 16 Alpine e Cloudflare Tunnel verificati. Servizi `app` e `postgres` attivi e testati con esito `healthy` su porta 8000 e 5432.
