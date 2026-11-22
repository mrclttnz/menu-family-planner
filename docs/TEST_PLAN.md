# Test Strategy & Automated Verification Plan (`docs/TEST_PLAN.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Status**: Verified — 219 backend tests passing (S34) + 7 frontend tests; per-slice evidence in `docs/PROJECT_STATE.md`  
> **Author**: Bottega QA Engineer (`qa-engineer`)

---

## 1. Test Strategy Overview

The testing strategy ensures high test confidence without brittle mocks:
- **Fast, Deterministic In-Memory SQLite Isolation**: Each test run uses an isolated in-memory SQLite database (`sqlite:///:memory:`) initialized with master lookups and cleaned up after execution.
- **Strict Traceability**: Every requirement from `docs/PRD.md` maps to dedicated test cases.
- **Negative & Security Shift-Left Gates**: Verifies input bounds, unique constraints, invalid URLs, and strict tenant isolation (Anti-IDOR).

---

## 2. Test Suite Mapping to PRD Requirements

| Requirement / User Story | Test File | Verified Scenarios | Status |
| :--- | :--- | :--- | :--- |
| **`US-01` Household Setup & Auth** | `backend/tests/test_auth.py` | Registration, duplicate email rejection (409), password length validation (422), login success, invalid password rejection (401), protected `/auth/me`. | **PASS** |
| **`US-01` Family Members Management** | `backend/tests/test_members.py` | Create adult/child members, duplicate name rejection in same household (409), list members, update member profile, delete member. | **PASS** |
| **`SEC-01` Tenant Boundary (Anti-IDOR)** | `backend/tests/test_members.py`, `backend/tests/test_dishes_and_preferences.py` | Household B cannot read or delete members or dishes belonging to Household A (returns 404/403). | **PASS** |
| **`US-02` Multi-Course Dish Catalog** | `backend/tests/test_dishes_and_preferences.py` | Assigning multiple courses (e.g., `Primo` + `Piatto unico`), recipe source bookmarking, catalog search and filtering. | **PASS** |
| **`US-03` Per-Member Preferences** | `backend/tests/test_dishes_and_preferences.py` | Default preference evaluates to `neutral`, explicit updates for `favorite` and `dislike` recorded per `(Dish, Member)`. | **PASS** |
| **`US-04` Exception-Based Attendance** | `backend/tests/test_calendar_and_attendance.py` | All household members are `is_attending = True` by default without manual setup. Toggling off records an absence exception. | **PASS** |
| **`US-05` Smart Compatibility Warnings** | `backend/tests/test_calendar_and_attendance.py` | Warning badge shown when dish disliked by attending member; warning disappears when disliker is absent (clearance); "Hit" badge when loved by all attendees. | **PASS** |
| **`US-06` Dynamic Daily Meal Slots** | `backend/tests/test_calendar_and_attendance.py` | Adding a custom meal slot (e.g. `Brunch`) to a date, deleting default `Lunch` slot for special days. | **PASS** |
| **`US-08` Attendance Date Range Validation** | `backend/tests/test_calendar_and_attendance.py` | Validates strict date ordering (`start_date <= end_date`) and maximum query window limits. | **PASS** |
| **`US-09` Alternative Dishes & Targeted Compatibility (`P002`)** | `backend/tests/test_calendar_and_attendance.py` | Dishes assigned to specific diners evaluate compatibility exclusively against those targeted attendees. | **PASS** |
| **`US-10` Decoupled Per-Meal Ratings (`J001`-`J003`)** | `backend/tests/test_calendar_and_attendance.py` | Testing meal satisfaction rating thumbs up/down and ensuring zero side-effects on permanent member preferences. | **PASS** |
| **`US-11` Meal Type Slot Deletion (`P009`)** | `backend/tests/test_calendar_and_attendance.py` | Deleting a meal type slot from the calendar when no dishes are assigned. | **PASS** |
| **`US-12` Meal Slot Notes (`P010`)** | `backend/tests/test_calendar_and_attendance.py` | Updating, retrieving, and clearing general meal slot notes (e.g. "Pranzo dalla nonna"). | **PASS** |
| **`US-13` Dish Course Update Validation** | `backend/tests/test_dishes_and_preferences.py` | Updating dish courses ensuring validated relational consistency and non-empty categories. | **PASS** |
| **`US-14` Default Dish Status OK (`D001`)** | `backend/tests/test_dishes_and_preferences.py` | Verifies default `is_default` flag on `'ok'` status when creating new dishes. | **PASS** |
| **`US-15` Optional Source Type (`D002`)** | `backend/tests/test_dishes_and_preferences.py` | Creating dishes without specifying a recipe source type. | **PASS** |
| **`US-16` Dish Consumption Feedback Notes** | `backend/tests/test_dishes_and_preferences.py` | Adding multiple timestamped notes to a meal slot dish and retrieving historical feedback via `/dishes/{id}/notes`. | **PASS** |
| **`US-17` Export Dishes (CSV, XLSX, JSON)** | `backend/tests/test_dishes_import_export.py` | Exporting dishes across all 3 formats with English headers, quoting commas, list courses, lookup resolutions, and search filter. | **PASS** |
| **`US-17` Download Import Templates** | `backend/tests/test_dishes_import_export.py` | Downloading example templates for XLSX, CSV, and JSON with canonical English headers. | **PASS** |
| **`US-17` CSV Dish Import (English)** | `backend/tests/test_dishes_import_export.py` | Parsing CSV with English headers, multi-course formats, lookup resolution, and DB persistence. | **PASS** |
| **`US-17` JSON Dish Import** | `backend/tests/test_dishes_import_export.py` | Parsing JSON array of dishes with English keys and native course lists. | **PASS** |
| **`US-17` Duplicate Conflict Resolution** | `backend/tests/test_dishes_import_export.py` | Verifying skip mode preserves existing dish vs update mode overwriting attributes. | **PASS** |
| **`US-17` Row Error Reporting** | `backend/tests/test_dishes_import_export.py` | Reporting missing title, invalid status, and missing course types per row. | **PASS** |
| **`US-17` Formula Injection Sanitization** | `backend/tests/test_dishes_import_export.py` | Verifying formula triggers (=, +, -, @) are neutralized on export and import. | **PASS** |
| **`US-18` Meal Planner Attendance Indicator & Modal (`S11` / Issue #8)** | `frontend/` build & UI validation | Concise `Users` icon + textual summary ("solo...", "no...") in lower-left cell corner across matrix views (`compact_h`, `compact_v`) and slot header (`detailed`); interactive attendance modal matching `TodayView` styling with live preview, batch toggle diff, and save/cancel. | **PASS** |
| **`US-19` Meal Planner Edit Assigned Dish & Diners (`S12` / Issue #9)** | `backend/tests/test_calendar_and_attendance.py`, `frontend/` build | Clickable dish title in all matrix views (`compact_h`, `compact_v`, `detailed`) opening edit modal to modify diner assignment (`PATCH /calendar/slots/{id}/dishes/{dish_id}` or all diners). | **PASS** |
| **`US-22` Prevent Duplicate Dish Name (`S17` / Issue #17)** | `backend/tests/test_dishes_and_preferences.py`, `frontend/` build | Case-insensitive and trimmed duplicate rejection on creation (400) and title rename (400); identical title allowed across different households (multi-tenant isolation); client-side instant validation on both catalog modal and quick create form. | **PASS** |
| **`QF-4` Frontend test harness (`S27` / Issue #27)** | `frontend/src/dateUtils.test.ts`, `frontend/src/components/TagColorPicker.test.tsx` | Vitest + React Testing Library + jsdom run by `npm test` locally and in CI; smoke tests: pure util (date range/format) and i18n-rendered component (language switch, localized validation error). Characterization coverage follows in S31. | **PASS** |
| **`NPM-AUDIT` Frontend toolchain upgrade (`S28` / Issue #28)** | `frontend/` lint, typecheck, `npm test`, build, `npm audit`, Docker build | vite 8 / vitest 5 upgrade: `npm audit` 0 vulnerabilities, 7 frontend tests pass, production build and Docker image build OK, CI audit step enforcing. Manual browser check of print/theme/i18n done by the user on 2026-11-22: OK. | **PASS** |
| **`TG-1` Config & JWT characterization (`S30` / Issue #30)** | `backend/tests/test_config_and_jwt.py` | `SECRET_KEY` validator (min 32 chars, default rejected in production for any case/whitespace, marker substring check; SEC-F01 regression), rate-limit and CORS settings parsing; JWT expired / wrong secret / tampered payload and signature / `alg=none` / other HMAC algorithm / missing or non-integer `sub` / unknown or deleted household / malformed `Authorization` header. Pinned: a validly signed token without `exp` is accepted. Header/CORS tests already live in `test_security_headers_cors.py` (S25). | **PASS** |
| **`S34` Alembic revisions and bootstrap (Issue #32)** | `backend/tests/test_alembic_migrations.py` | Fresh DB reaches head with no diff vs the models and with the expression index; idempotent upgrade; downgrade to base then upgrade round-trip; legacy (pre-Alembic) DB is stamped and ends identical to a fresh one; legacy DB with missing columns/tables repaired with data kept; unrecoverable gap is not stamped; duplicate dishes need explicit `ALLOW_LEGACY_DEDUP` consent; `assert_schema_current`. Every pytest run also migrates the throwaway lifespan DB via Alembic (`conftest.py`). Verified manually on PostgreSQL 16: fresh vs legacy `pg_dump -s` identical, `alembic check` clean, Docker image end to end (empty DB, legacy DB, restart, fail-closed on bad credentials). | **PASS** |
| **`TG-2` Startup migrations characterization (`S30` / Issue #30)** | `backend/tests/test_migrations.py` | `run_auto_migrations` (now only the legacy bridge used by `app.core.db_bootstrap`) on legacy-shaped SQLite databases: missing `is_default` columns added and `ok` status marked default (existing household default preserved), missing `tags` / `dish_tags` / `meal_slot_dish_ratings` recreated, dish dedupe (case/whitespace-insensitive, lowest id kept, per household, slot and preference references repointed or dropped without unique violations), unique index created and enforced, idempotent second run, no-op on up-to-date DB. **Not covered**: PostgreSQL `SERIAL` DDL branches (SQLite-only suite; a Postgres CI job is a follow-up, to be decided with S34). | **PASS** |
| **`TG-3` Import/export, taxonomies and tenant isolation characterization (`S30` / Issue #30)** | `backend/tests/test_import_export_edge_cases.py`, `backend/tests/test_taxonomies_and_tenant_isolation.py` | Empty / malformed / oversize (5 MB) files, wrong extension, BOM, header aliases, numeric xlsx cells, course formats, status by code/name/label, unknown course/source auto-creation, partial failure, in-file duplicates, formula injection on export (csv/xlsx/json, tags, custom status label), lossless round-trip, tag creation on import; course/source/status/tag CRUD edge cases (duplicates, validation, delete of an in-use tag); tenant isolation on taxonomies, tags, statuses, slot notes, ratings, assignments and note history. Defects found are tracked as issues #49-#56 (not fixed in S30); #49-#54 and #56 are pinned by characterization tests marked `# pins #NN` (usually named `*_currently_*`), #55 (size checked after full read) is not pinned by a test. | **PASS** |
| **`US-07` Frontend SPA Verification** | `frontend/` build pipeline | TypeScript compile (`tsc`), JSX bundling with Vite, production assets generated without errors, static mount verified on FastAPI. | **PASS** |

---

## 3. Fresh Execution Evidence

### Backend Pytest Execution Evidence
```text
============================= test session starts ==============================
platform linux -- Python 3.14.4, pytest-9.1.1, pluggy-1.7.0 -- /home/marco/work/menu-design-2/backend/.venv/bin/python3
cachedir: .pytest_cache
rootdir: /home/marco/work/menu-design-2/backend
configfile: pytest.ini
testpaths: tests
plugins: asyncio-1.4.0, anyio-4.15.1
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 34 items

tests/test_auth.py::test_register_success PASSED                         [  2%]
tests/test_auth.py::test_register_duplicate_email PASSED                 [  5%]
tests/test_auth.py::test_register_weak_password PASSED                   [  8%]
tests/test_auth.py::test_login_success PASSED                            [ 11%]
tests/test_auth.py::test_login_invalid_password PASSED                   [ 14%]
tests/test_auth.py::test_get_me PASSED                                   [ 17%]
tests/test_auth.py::test_get_me_unauthorized PASSED                      [ 20%]
tests/test_calendar_and_attendance.py::test_default_calendar_and_exception_based_attendance PASSED [ 23%]
tests/test_calendar_and_attendance.py::test_custom_slot_brunch_and_delete_lunch PASSED [ 26%]
tests/test_calendar_and_attendance.py::test_smart_compatibility_alert_and_absence_clearance PASSED [ 29%]
tests/test_calendar_and_attendance.py::test_attendance_date_range_validation PASSED [ 32%]
tests/test_calendar_and_attendance.py::test_alternative_dishes_targeted_compatibility PASSED [ 35%]
tests/test_calendar_and_attendance.py::test_slot_dish_ratings_and_independence_from_dish_preferences PASSED [ 38%]
tests/test_calendar_and_attendance.py::test_delete_slots_by_meal_type_p009 PASSED [ 41%]
tests/test_calendar_and_attendance.py::test_meal_slot_notes_p010 PASSED   [ 44%]
tests/test_dishes_and_preferences.py::test_taxonomies PASSED             [ 47%]
tests/test_dishes_and_preferences.py::test_create_dish_with_multi_courses_and_preferences PASSED [ 50%]
tests/test_dishes_and_preferences.py::test_dish_tenant_isolation PASSED [ 52%]
tests/test_dishes_and_preferences.py::test_update_dish_validates_courses PASSED [ 55%]
tests/test_dishes_and_preferences.py::test_default_status_ok_flag PASSED [ 58%]
tests/test_dishes_and_preferences.py::test_optional_source_type_dish_creation PASSED [ 61%]
tests/test_dishes_and_preferences.py::test_slot_dish_multiple_notes_and_history PASSED [ 64%]
tests/test_dishes_and_preferences.py::test_tags_taxonomy_crud_and_validation PASSED [ 66%]
tests/test_dishes_and_preferences.py::test_dishes_with_tags_and_filtering_and_search PASSED [ 69%]
tests/test_dishes_import_export.py::test_export_dishes_csv_xlsx_and_json PASSED [ 71%]
tests/test_dishes_import_export.py::test_download_template_all_formats PASSED [ 74%]
tests/test_dishes_import_export.py::test_import_dishes_csv_english PASSED [ 76%]
tests/test_dishes_import_export.py::test_import_dishes_json PASSED       [ 79%]
tests/test_dishes_import_export.py::test_import_duplicates_skip_and_update PASSED [ 82%]
tests/test_dishes_import_export.py::test_import_validation_and_row_errors PASSED [ 84%]
tests/test_dishes_import_export.py::test_formula_injection_defense PASSED [ 87%]
tests/test_dishes_import_export.py::test_import_and_export_dishes_with_tags PASSED [ 89%]
tests/test_dishes_and_preferences.py::test_prevent_duplicate_dish_names PASSED [ 90%]
tests/test_members.py::test_create_and_list_members PASSED               [ 92%]
tests/test_members.py::test_create_duplicate_member_name_fails PASSED   [ 95%]
tests/test_members.py::test_update_member PASSED                         [ 97%]
tests/test_members.py::test_delete_member PASSED                         [100%]

======================== 40 passed, 1 warning in 15.33s ========================
```

### S30 Backend Evidence (2026-11-22)
```text
cd backend && .venv/bin/python -m pytest -q   -> 219 passed (210 after S30, +9 Alembic tests in S34)
cd backend && .venv/bin/ruff check .          -> All checks passed
```
Production code untouched: the diff of S30 is limited to `backend/tests/` and docs. Findings: #49 (title length on import), #50 (JSON tags list), #51 (update mode in-file duplicates), #52 (formula title round-trip), #53 (blank taxonomy names), #54 (CSV separator / Italian headers / silent course creation), #55 (upload size checked after full read), #56 (JWT `exp` not required).

### Frontend TypeScript & Vite Build Evidence
```text
> menu-design-frontend@1.0.0 build
> tsc && vite build

vite v8.3.8 building client environment for production...
✓ 1977 modules transformed.
dist/index.html                   0.76 kB │ gzip:   0.50 kB
dist/assets/index-B6IgYBJ6.css   44.85 kB │ gzip:   7.97 kB
dist/assets/index-CKb5S8Aq.js   415.36 kB │ gzip: 110.36 kB
✓ built in 1.04s
```
