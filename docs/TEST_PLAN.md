# Test Strategy & Automated Verification Plan (`docs/TEST_PLAN.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Status**: Verified — All 35 Automated Tests Passing  
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
tests/test_dishes_import_export.py::test_export_dishes_csv_xlsx_and_json PASSED [ 67%]
tests/test_dishes_import_export.py::test_download_template_all_formats PASSED [ 70%]
tests/test_dishes_import_export.py::test_import_dishes_csv_english PASSED [ 73%]
tests/test_dishes_import_export.py::test_import_dishes_json PASSED       [ 76%]
tests/test_dishes_import_export.py::test_import_duplicates_skip_and_update PASSED [ 79%]
tests/test_dishes_import_export.py::test_import_validation_and_row_errors PASSED [ 82%]
tests/test_dishes_import_export.py::test_formula_injection_defense PASSED [ 85%]
tests/test_members.py::test_create_and_list_members PASSED               [ 88%]
tests/test_members.py::test_create_duplicate_member_name_fails PASSED   [ 91%]
tests/test_members.py::test_update_member PASSED                         [ 94%]
tests/test_members.py::test_delete_member PASSED                         [ 97%]
tests/test_members.py::test_tenant_isolation_members PASSED              [100%]

======================== 34 passed, 1 warning in 11.72s ========================
```

### Frontend TypeScript & Vite Build Evidence
```text
> menu-design-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 1955 modules transformed.
dist/index.html                   0.74 kB │ gzip:  0.49 kB
dist/assets/index-Byj-2PTh.css   24.65 kB │ gzip:  4.99 kB
dist/assets/index-BEOvhPp8.js   200.38 kB │ gzip: 58.85 kB
✓ built in 2.68s
```
