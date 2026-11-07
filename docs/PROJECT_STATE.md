# Project State & Context Index (`PROJECT_STATE.md`)

> Single source of truth maintained by **Bottega Orchestrator**.

## 1. Project Identity & Profile
- **Project Name**: Menu Design
- **One-Line Vision**: Family-first meal planning web application to catalog favorite dishes, track recipe sources, manage diner attendance by exception, and eliminate mealtime friction.
- **Active Bottega Profile**: `forge`
- **Current Phase**: `Phase 7: Deployment & Delivery Complete`

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
- **Requirements Spec**: `docs/PRD.md` — `[Approved - Gate 1]`
- **System Architecture**: `docs/ARCHITECTURE.md` — `[Approved - Gate 2]`
- **Threat Model**: Inline in `docs/ARCHITECTURE.md` (§6) — `[Approved - Gate 2]`
- **Database Design**: `docs/DB_SCHEMA.md` — `[Approved - Gate 3]`
- **Test Plan**: `docs/TEST_PLAN.md` — `[Approved - Gate 5 (27/27 Tests Passing)]`
- **Security Audit Report**: `docs/SECURITY_AUDIT.md` — `[Approved - Gate 6 (PASS_WITH_WARNINGS)]`
- **Deployment Runbook**: `docs/DEPLOYMENT_RUNBOOK.md` — `[Approved - Gate 7 (Ready)]`
- **External Docker Runbook (QNAP & Docker Hub)**: `docs/DEPLOYMENT_DOCKER_EXTERNAL.md` — `[Production Ready]`
- **Dynamic Work-Item Backlog**: GitHub Issues ([mrclttnz/menu-family-planner/issues](https://github.com/mrclttnz/menu-family-planner/issues)) — `[Active Backlog]`
- **Archived Suggestions & Feedback**: `docs/archive/suggerimenti.md` — `[Migrated to Issues #1-#4]`

## 4. Vertical Slices & Implementation Backlog
| Slice ID | Feature / Module | Owner Role | Dev Status | QA Status | Review & Sec Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `S1` | Household Setup, Auth & Member Profiles | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S2` | Master Lookups (`meal_types`, `dish_status_lookups`) & Configurable Taxonomies | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S3` | Multi-Course Dish Catalog & Recipe Sources | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S4` | Member Dish Preferences (`favorite` / `neutral` / `dislike`) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S5` | Dynamic Daily Meal Slots (Pranzo/Cena/Brunch/Merenda) & Exception-Based Attendance | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S6` | Meal Calendar & Smart Preference/Attendance Compatibility Alerts | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S7` | Mobile Dashboard & Kitchen Overview (React SPA) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S8` | Usability & Planning Extensions (Alternative Dishes, Meal Notes, Multi-Views, Quick Create, Meal Ratings) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S9` | Dish Catalog Import & Export (Excel, CSV, JSON) ([#2](https://github.com/mrclttnz/menu-family-planner/issues/2)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S10` | Multi-language Support (i18n: IT/EN) ([#1](https://github.com/mrclttnz/menu-family-planner/issues/1)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S11` | Meal Planner Attendance Indicator & Modal ([#8](https://github.com/mrclttnz/menu-family-planner/issues/8)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S12` | Meal Planner: Edit Assigned Dish & Diners ([#9](https://github.com/mrclttnz/menu-family-planner/issues/9)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S13` | Compact Card View for Dish Catalog ([#10](https://github.com/mrclttnz/menu-family-planner/issues/10)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S14` | Dish Tags & Cross-View Filtered Selection ([#7](https://github.com/mrclttnz/menu-family-planner/issues/7)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S15` | Responsive Mobile Optimization & Compact Vertical Single-Column Flow ([#13](https://github.com/mrclttnz/menu-family-planner/issues/13)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S16` | Dish Name Trimming & Whitespace Sanitization ([#16](https://github.com/mrclttnz/menu-family-planner/issues/16)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |
| `S17` | Prevent Duplicate Dish Name in Catalog ([#17](https://github.com/mrclttnz/menu-family-planner/issues/17)) | `software-craftsman` | `DONE` | `PASS` | `APPROVE` |

## 5. Quality & Security Gate Log
- [x] **Gate 1 (Requirements Approved)**: PRD signed off with multi-course support, configurable classifications, and member dish preferences.
- [x] **Gate 2 (Architecture & Threat Model Approved)**: Decoupled FastAPI + React SPA with SQLite/Postgres and Option 1 (`favorite` / `neutral` / `dislike`).
- [x] **Gate 3 (DB Schema & Modules Approved)**: Normalized `dish_status_lookups`, dynamic daily `meal_types`, exception-based attendance, and normalized `tags`/`dish_tags`.
- [x] **Gate 5 (Automated Tests Passing — Evidence Recorded)**: 40 automated tests passing with 100% success rate in `backend/tests/` (including tag taxonomy, search, import/export, title whitespace trimming, and duplicate dish name prevention tests).
- [x] **Gate 6 (Security Audit & Adversarial Code Review Passed)**:
  - `security-engineer`: **`PASS_WITH_WARNINGS`** (0 Critical, 0 High). Report in `docs/SECURITY_AUDIT.md`.
  - `code-reviewer`: **`APPROVE`** (All 3 blockers remediated and verified).
- [x] **Gate 7 (Deployment Verified)**: Hardened non-root `Dockerfile`, `docker-compose.yml` con PostgreSQL 16 Alpine e Cloudflare Tunnel verificati. Servizi `app` e `postgres` attivi e testati con esito `healthy` su porta 8000 e 5432.
