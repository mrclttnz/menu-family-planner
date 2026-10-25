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
| **Database & Cache** | SQLite 3 (WAL mode) in dev -> PostgreSQL in prod | Seamless transition via SQLAlchemy 2.0 ORM & Alembic | Implemented |
| **AuthN / AuthZ** | JWT Bearer + Household Scoping (Anti-IDOR) + Member Profile | Single household login + member switcher, zero trust boundaries | Implemented |
| **Deployment Target** | Multi-stage Docker + Docker Compose (PaaS / VPS ready) | Lightweight, non-root, portable, reproducible environments | Implemented |

## 3. Artifact Index
- **Requirements Spec**: `docs/PRD.md` — `[Approved - Gate 1]`
- **System Architecture**: `docs/ARCHITECTURE.md` — `[Approved - Gate 2]`
- **Threat Model**: Inline in `docs/ARCHITECTURE.md` (§6) — `[Approved - Gate 2]`
- **Database Design**: `docs/DB_SCHEMA.md` — `[Approved - Gate 3]`
- **Test Plan**: `docs/TEST_PLAN.md` — `[Approved - Gate 5 (20/20 Tests Passing)]`
- **Security Audit Report**: `docs/SECURITY_AUDIT.md` — `[Approved - Gate 6 (PASS_WITH_WARNINGS)]`
- **Deployment Runbook**: `docs/DEPLOYMENT_RUNBOOK.md` — `[Approved - Gate 7 (Ready)]`

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

## 5. Quality & Security Gate Log
- [x] **Gate 1 (Requirements Approved)**: PRD signed off with multi-course support, configurable classifications, and member dish preferences.
- [x] **Gate 2 (Architecture & Threat Model Approved)**: Decoupled FastAPI + React SPA with SQLite/Postgres and Option 1 (`favorite` / `neutral` / `dislike`).
- [x] **Gate 3 (DB Schema & Modules Approved)**: Normalized `dish_status_lookups`, dynamic daily `meal_types`, and exception-based attendance (present by default).
- [x] **Gate 5 (Automated Tests Passing — Evidence Recorded)**: 20 automated tests passing with 100% success rate in `backend/tests/`.
- [x] **Gate 6 (Security Audit & Adversarial Code Review Passed)**:
  - `security-engineer`: **`PASS_WITH_WARNINGS`** (0 Critical, 0 High). Report in `docs/SECURITY_AUDIT.md`.
  - `code-reviewer`: **`APPROVE`** (All 3 blockers remediated and verified).
- [x] **Gate 7 (Deployment Verified)**: Hardened non-root `Dockerfile`, `docker-compose.yml`, `run_dev.sh`, and `docs/DEPLOYMENT_RUNBOOK.md` verified.
