# Delivery Plan (`DELIVERY_PLAN.md`)

> Maintained by the Delivery Planner. Profile: `forge`. Origin: brownfield. Slices S1-S23 are DONE (see `docs/PROJECT_STATE.md` section 4) and are not re-planned here. This plan covers only S24 onwards.
> Status: PROPOSED, awaiting user approval. `docs/PROJECT_STATE.md` is intentionally not edited by this plan.

## 1. Planning Notes and Assumptions

- Sources: `docs/SECURITY_AUDIT.md`, onboarding baseline findings, the open-issue list supplied in the request, and a read of `backend/app/routers/auth.py`, `backend/app/core/migrations.py`, `backend/requirements.txt` and `frontend/src`.
- **Limitation**: the planner had no shell access, so `gh issue list` and issue bodies were NOT read. Issue content comes from the request summary only. Every issue-backed slice must have its AC copied from the issue body before development starts. No acceptance criteria are invented here (`AC-` IDs are `TBD`).
- IDs: no `US-`/`AC-` IDs exist for these items. Baseline findings use their own IDs (`SEC-F02`, `NPM-AUDIT`, `QF-1..`, `DOC-1..`, `TG-1..`). Issue slices use `GH#n`.
- Print engine (Issue #22 / S21) lives almost entirely in `frontend/src/components/CalendarView.tsx` (about 157 print-related matches, plus `index.css` print rules). There is no backend print code.
- `alembic>=1.13.0` is in `backend/requirements.txt` but no `backend/alembic/` exists. Runtime auto-migration in `backend/app/core/migrations.py` is hand-written DDL (some Postgres-only `SERIAL` branches) and includes a destructive dedupe step for dishes. Both facts feed S29 and S31.
- Deployment is exposed through Cloudflare Tunnel: the client IP seen by the app is the tunnel/proxy IP unless forwarded headers are handled correctly. This drives S24 design.
- Size rule: `S` or `M` only; `L` is split. Size is an estimate.

## 2. Slice Table

Order is the recommended execution order. "Sec" = security-sensitive.

| Order | Slice | Title | Issue | Covers | Depends on | Size | Sec | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | `S24` | Auth endpoint rate limiting | N/A | SEC-F02 | none | M | Yes | READY |
| 2 | `S25` | Security hardening batch and audit report refresh | N/A | SEC-F01 (close), SEC-F03, SEC-F04 | none (S24 recommended first, same files) | S | Yes | READY |
| 3 | `S26` | Quality foundation I: CI, linters, typecheck | N/A | QF-1, QF-2, QF-3 | none | M | Partly (supply chain scan) | READY |
| 4 | `S27` | Quality foundation II: frontend test harness | N/A | QF-4 | S26 | S | No | READY |
| 5 | `S28` | Frontend toolchain upgrade (vite/esbuild advisories) | N/A | NPM-AUDIT | S26, S27 | S | Yes (dev server only) | READY |
| 6 | `S29` | Decision and docs: migrations strategy, deps, prod compose | N/A | DOC-1, DOC-2, DOC-3 | none | S | No | READY (Alembic decided 2026-11-21) |
| 7 | `S30` | Backend characterization tests (config, headers, migrations, import/export, auth edges) | N/A | TG-1, TG-2, TG-3 | S24, S25 (so new behavior is in baseline) | M | Yes | READY |
| 8 | `S31` | Frontend characterization tests (print helpers, theme, i18n, utils) | N/A | TG-4, TG-5 | S27 | M | No | READY |
| 9 | `S32` | Print layout tech debt | #23 | GH#23 | S31 | M | No | READY after S31 |
| 10 | `S33` | Weekly default attendance | #11 | GH#11 (AC derived from issue text, confirm before start) | S29, S30, S34 | M | No | READY |
| 11 | `S34` | Migrations tooling implementation (conditional) | N/A | DOC-1 follow-up | S29, S30 | M | Yes (schema) | READY after S29/S30 |
| 12 | `S35` | User management I: identity model split and auth refactor | #5 | GH#5 | S24, S34, S30 | M | Yes | BLOCKED: questions to ask just before coding |
| 13 | `S36` | User management II: manage users in a household (UI and API) | #5 | GH#5 AC | S35 | M | Yes | BLOCKED: questions before coding |
| - | `S37` | Guest attendance in planned meals | #3 | not defined | - | - | - | BLOCKED: needs spec |
| - | `S38` | Automatic weekly menu suggestion | #4 | not defined | - | - | - | BLOCKED: needs spec |
| - | `S39` | Recipe scraping from source URL | #6 | not defined | - | - | Yes (SSRF) | BLOCKED: needs spec |
| - | `S40` | Native Android / iOS apps | #14, #15 | not defined | - | - | - | OUT OF SCOPE (epic only) |

Dependency graph (no cycles): S24, S25, S26, S29 are roots. S27 <- S26. S28 <- S26, S27. S30 <- S24, S25. S31 <- S27. S32 <- S31. S33 <- S29, S30, S34. S34 <- S29, S30. S35 <- S24, S30, S34. S36 <- S35.

Parallelism: S24, S26, S29 can run in parallel (different files). S25 touches `backend/app/main.py`; run it after or together with S24 to avoid conflicts.

## 3. Slice Cards

### S24 - Auth endpoint rate limiting (SEC-F02)
- **Goal**: Throttle brute-force and bcrypt CPU exhaustion on `POST /api/v1/auth/login` and `POST /api/v1/auth/register` (and any new auth endpoint).
- **Modules**: `backend/app/routers/auth.py`, `backend/app/main.py` (or a new `backend/app/core/rate_limit.py`), `backend/app/core/config.py` (limits as settings), `backend/requirements.txt`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/ARCHITECTURE.md` (threat model section 6).
- **Design points to decide in the slice (trade-offs)**:
  - Option A: in-app limiter (`slowapi` or small custom in-memory limiter). Works without edge config; per-process state (single uvicorn worker assumed, confirm).
  - Option B: Cloudflare WAF rate rule only. No code, but not testable in repo and bypassed on LAN access (port 8000 is reachable on the LAN).
  - Recommendation: A as the baseline (covers LAN and tunnel), optionally plus B at the edge.
  - Client identity behind the tunnel: key on `CF-Connecting-IP` / `X-Forwarded-For` ONLY when the request comes from a trusted proxy; otherwise every user shares the tunnel IP (global lockout) or an attacker can spoof the header (bypass). Also consider a per-account (email) failure counter, since IP-only limits are weak.
- **Definition of Done**:
  - Login and register return `429` with a `Retry-After` header after the configured threshold (default in the audit range: 5-10 per minute per client).
  - Limits are configurable via settings and can be disabled/raised in the test environment so the existing 40 tests keep passing.
  - New tests: threshold hit gives 429; window reset allows requests again; spoofed forwarded header is ignored when the proxy is untrusted; a different client is unaffected.
  - Error message does not reveal whether the account exists (keep the existing generic 401 text).
  - Frontend `AuthModal.tsx` shows a localized (IT/EN) message on 429 (via `errorUtils.ts`).
  - Runbook documents the Cloudflare/proxy header configuration. `SECURITY_AUDIT.md` SEC-F02 marked remediated (status edit may be folded into S25 if run together).
  - Security review gate (forge: `security-engineer` + `code-reviewer`).
- **Characterization tests needed**: existing `test_auth.py` (7 tests) covers happy and failure paths and is the safety net; add the register/login lockout tests first.

### S25 - Security hardening batch and audit refresh
- **Goal**: Close the remaining low findings and make the audit report truthful.
- **Covers**: `SEC-F03` (replace `allow_methods=["*"]` / `allow_headers=["*"]` in `backend/app/main.py` with explicit lists), `SEC-F04` (HSTS header when `ENVIRONMENT == production`, or documented as set by the proxy), `SEC-F01` (already remediated by the validator in `backend/app/core/config.py`: update the report status from OPEN to REMEDIATED with evidence).
- **Also**: update A06 in `docs/SECURITY_AUDIT.md`, which currently says "no vulnerable libraries" while `npm audit` reports 1 high and 1 moderate (tracked in S28); update the "Condition for Production Release" and the audit date/verdict.
- **Definition of Done**:
  - CORS preflight test for allowed and disallowed methods/headers (the frontend must keep working: verify `Authorization`, `Content-Type`, and any `Accept-Language` header used by `api.ts`).
  - Header test for HSTS in production mode and absence in development.
  - `SECURITY_AUDIT.md` findings table reflects reality, reviewed by `security-engineer`.
- **Characterization tests needed**: none beyond the headers/CORS tests; SEC-F01 regression test lives in S30.

### S26 - Quality foundation I: CI, linters, typecheck
- **Goal**: Automated gate on every push/PR; currently `.github/` has only `ISSUE_TEMPLATE`.
- **Scope**:
  - `.github/workflows/ci.yml`: backend job (Python 3.14 matching the project, install requirements, `pytest`), frontend job (Node 24, `npm ci`, typecheck, build), security job (`pip-audit`, `npm audit --audit-level=high`; initially report-only for the known vite/esbuild advisory until S28 lands, then enforcing).
  - Backend linter config (`ruff`, minimal rule set, in `backend/pyproject.toml` or `ruff.toml`) with an initial pass that fixes or baselines existing findings without behavior changes.
  - Frontend: separate `typecheck` script (`tsc --noEmit`) in `frontend/package.json` and ESLint config (React + TypeScript). Baseline existing warnings, then fail on new ones.
  - Optional: secret scanning (gitleaks) and Dependabot config. Keep out unless cheap.
- **Definition of Done**: workflow runs green on the branch; a deliberate failing test or type error makes CI fail (verify once); `README`/`CLAUDE.md` document the local equivalents of the CI commands; no application behavior change (diff limited to lint autofixes).
- **Risk**: Python 3.14 availability on hosted runners; fall back to a pinned setup action or document the compatibility choice.
- **Characterization tests needed**: none (tooling only). Lint autofixes in untested frontend code are kept minimal because there are no frontend tests yet; run the build and a manual smoke check.

### S27 - Quality foundation II: frontend test harness
- **Goal**: Make frontend code testable.
- **Scope**: Vitest + React Testing Library + jsdom in `frontend/`, `npm test` script, one smoke test per kind (pure util, component render with i18n), added to CI (S26 workflow).
- **Definition of Done**: `npm test` green locally and in CI; test conventions documented in `CLAUDE.md`/`docs/TEST_PLAN.md`; coverage reporting optional and non-blocking.
- **Note**: Vite-native Vitest couples to the vite version. If S28 will bump vite major, keep the Vitest version compatible with the target vite (decide in S27 to avoid double work).

### S28 - Frontend toolchain upgrade (npm audit)
- **Goal**: Remove `esbuild <= 0.24.2` / `vite <= 6.4.3` advisories (1 high, 1 moderate, dev-server only; the production image serves the built `dist`, so runtime exposure is low, but fix anyway and keep the CI audit green).
- **Scope**: bump `vite` (major) and `@vitejs/plugin-react` together, re-check Tailwind/PostCSS and Vitest compatibility, update the Dockerfile build stage if the Node requirement changes.
- **Definition of Done**: `npm audit --audit-level=high` clean (or residual documented with justification); production build output verified (bundle loads, theme CSS variables, i18n, print layout checked manually, plus S27 tests); CI audit step switched to enforcing; Docker image builds.
- **Characterization tests needed**: frontend has none today. This slice must not start until S27 exists; S31 tests add more coverage, so manual verification of print and theme is required in the DoD if S28 runs before S31 (recommended: run S28 after S31 if the user wants a stronger net; the order shown prioritizes closing the high advisory early).

### S29 - Decision and docs: migrations strategy, dependencies, prod compose
- **Goal**: Resolve documentation drift with an explicit decision rather than silent edits.
- **Decision (taken by the user 2026-11-21): Option B, adopt Alembic.** Record it as an ADR in `docs/ARCHITECTURE.md` or `docs/adr/`. Options considered:
  - Option A: document the status quo (runtime `create_all` + `app/core/migrations.py`), remove `alembic` from requirements and the `alembic/` mention from `docs/ARCHITECTURE.md` / `docs/DB_SCHEMA.md`. Cheap; but every schema change keeps needing hand-written, dialect-aware DDL, and slice S33/S35 both change the schema.
  - Option B: adopt Alembic (baseline revision from current models, stamp existing prod DBs, drop runtime auto-migration) via S34. Safer for S33/S35; costs a migration of the QNAP/prod DB.
  - Recommendation: B before S35 (identity model change is a real schema migration); A is acceptable if S35/S36 are deferred.
- **Other fixes in this slice**:
  - Requirements: keep only one Postgres driver (compose uses `postgresql+psycopg://`, so `psycopg[binary]`; verify nothing imports `psycopg2`, then drop `psycopg2-binary`).
  - `docker-compose.prod.yml` is gitignored but documented: either commit a sanitized `docker-compose.prod.example.yml` (no secrets, env-driven) or remove the references from `docs/DEPLOYMENT_RUNBOOK.md` / `docs/DEPLOYMENT_DOCKER_EXTERNAL.md`.
  - Fix stale facts in `PRD`/`ARCHITECTURE`/`DB_SCHEMA` noticed during the edit (for example the SQLite/Postgres statement in the Gate 2 log; the DB design is now Postgres 16 in compose).
- **Definition of Done**: ADR recorded (Alembic); docs describe the planned Alembic flow and flag it as pending S34; docs match code; Docker build and `pytest` unaffected; no secrets committed.
- **Characterization tests needed**: none (docs and requirements); run the full suite after the driver change.

### S30 - Backend characterization tests
- **Goal**: Pin current behavior of untested backend areas before further schema/auth work. Tests only (no production code change; if a bug is found, record it as a new issue instead of fixing it here).
- **Current coverage**: 40 tests (the file read counts 41 `def test_`): auth 7, members 5, dishes/preferences/tags 12, import/export 8, calendar/attendance 9. No tests exist for `config.py`, `security.py` token edge cases, security headers/CORS, `migrations.py`, `taxonomies` beyond one test, or the `compatibility` service in isolation.
- **Test areas**:
  - TG-1 config/security: SECRET_KEY validator (rejects default in production, rejects < 32 chars; regression for SEC-F01); JWT expired, tampered, wrong algorithm (`alg=none`), missing `sub`, unknown household.
  - TG-2 migrations: run `run_auto_migrations` on an old-shape SQLite database: missing columns added, idempotent second run, and the destructive dedupe path (duplicate dish titles merged, `meal_slot_dishes` and `dish_member_preferences` repointed, no unique-violation). Note that the `SERIAL` DDL branches are Postgres-only, so SQLite cannot exercise them; document or add a Postgres service job in CI.
  - TG-3 import/export edge cases: empty file, wrong extension/content type, oversize upload (check whether a size limit exists; if not, file a finding), malformed xlsx/json, BOM/semicolon CSV, Italian headers, unknown course/status codes, very long cells, formula injection on export for all formats, tag creation on import, partial-failure reporting.
  - Taxonomy and tag CRUD edge cases (delete of an in-use item), tenant isolation on tags/ratings/notes endpoints.
- **Definition of Done**: new tests pass on the current code; CI runs them; any discovered defect logged as an issue (not silently fixed).

### S31 - Frontend characterization tests
- **Goal**: Pin behavior of pure and print-related frontend logic before refactoring (S32) and before the vite bump.
- **Test areas**:
  - TG-4 pure utils: `themeUtils.ts` (palette to CSS variables, invalid color input, persistence), `dateUtils.ts` (week boundaries, Monday/Sunday start, DST/month/year edges), `errorUtils.ts` (API error to localized message mapping, unknown errors), `taxonomyUtils.ts`.
  - TG-5 i18n: key parity between `locales/it.json` and `locales/en.json`, no empty values, interpolation placeholders match, fallback behavior in `i18n.ts`; print-related keys (20 print matches in each locale).
  - Print engine (Issue #22): characterize the weekly print data shaping and markup currently inside `CalendarView.tsx` (days x meal slots, notes, alternatives, empty slots, long dish names). Where logic is not extractable without refactor, use component-render snapshot tests and document the gap; extraction itself happens in S32.
- **Definition of Done**: tests green in CI; test list added to `docs/TEST_PLAN.md`; no production code change except minimal test hooks, if unavoidable (flag them in review).

### S32 - Print layout tech debt (GH #23)
- **Goal**: Pay down the tech debt recorded in #23 for the weekly print/fridge planner delivered in S21 (low priority).
- **AC (from issue #23, objectives checklist)**: (1) study/implement automatic font-size and padding adaptation based on the number of lines in each day box (larger with 1-2 dishes, compact only on busy days/notes); (2) refine the look of the handwriting reminder-box lines and the daily boxes of the fridge planner (e.g. contrasted Lunch/Dinner cards, airier icons); (3) evaluate a monochrome high-contrast / ink-saving print profile. Items 1 and 3 are opt-in/evaluation: decide scope with the user before starting. Print stays single-page A4 with the existing Normal/Large/XL selector. Likely first step: extract print code from `CalendarView.tsx` into dedicated component(s)/CSS without changing the output.
- **Definition of Done**: all S31 characterization tests still pass unchanged; manual print preview comparison before/after on at least one populated week (A4 portrait and landscape as supported); IT and EN checked.
- **Characterization tests needed**: yes, S31 is a hard prerequisite (print code is untested).

### S33 - Weekly default attendance (GH #11)
- **Goal**: Per the issue title, allow a default attendance pattern for the week. Exact behavior (per member/weekday/meal type, interaction with the existing exception-based model from S5 and the compatibility alerts from S6) is defined by the issue body.
- **AC**: issue #11 has no formal AC; the following are derived from its description and must be confirmed by the user before the slice starts: (1) a form shows a vertical table, weekdays as rows and default meal types as columns; each cell has the attendance selector, same layout/behavior as 'Presenze al Pasto' in the Meal Planner; (2) a meal with no explicit attendance gets its attendance from the weekly default; (3) if attendance was explicitly set for that meal, the explicit value wins; (4) a button restores the default for a given meal on a given day; (5) compatibility alerts use the effective attendance. Open details (to ask at start): per-member storage, effect on past slots, where the form is opened from.
- **Modules (expected)**: `backend/app/models/meal_plan.py`, `backend/app/routers/attendance.py` and `calendar.py`, `backend/app/services/compatibility.py`, `frontend/src/components/MembersView.tsx` / `CalendarView.tsx`, `locales/*.json`, `docs/DB_SCHEMA.md`.
- **Dependencies**: S34 (Alembic in place, since this adds a table or column), S29 and S30 (calendar/attendance regression net, notably the compatibility alerts).
- **Definition of Done**: AC covered by tests; existing 9 calendar/attendance tests unchanged and green; schema change migrated safely for existing data; IT/EN strings; tenant isolation test for new endpoints.
- **Characterization tests needed**: compatibility service in isolation (S30) before touching it.

### S34 - Migrations tooling implementation (Alembic)
- **Decided 2026-11-21: Alembic adopted. Runs after S29 and S30, before S33 and S35.**
- **Scope**: `backend/alembic/` with env wired to `settings.DATABASE_URL`; baseline revision generated from current models; `alembic stamp` procedure for existing prod/QNAP databases; remove runtime auto-migration (or keep it behind a flag for one release); container entrypoint runs `alembic upgrade head`; runbook updated.
- **Definition of Done**: fresh DB and a copy of a legacy DB both reach `head` with identical schema; S30 migration characterization tests converted to revision tests; rollback procedure written; a backup step precedes the first prod migration; Docker image tested end to end.
- **Sec**: schema/privilege change in the DB startup path; review by `code-reviewer` and `security-engineer` (DB credentials handling).

### S35 - User management I: identity model split and auth refactor (GH #5)
- **Status**: BLOCKED: the questions below will be asked to the user just before coding starts (user decision 2026-11-21: too early now).
- **AC from issue #5**: (1) an email and password can be entered for each family member; (2) a user can change their own password; (3) each family member authenticates with their own email/password and all users of the same household access the whole household's data.
- **Why it is sensitive**: today the household IS the login identity (`Household.email`, `password_hash`; JWT `sub` = household id; `Member` is a non-login profile). Multi-user per household means a new user/credential entity, an authorization model, and a data migration of every existing household. Touches IDOR scoping used by every router (`get_current_household` in `backend/app/api/deps.py`).
- **Questions for the user (options and recommendation)**:
  1. Roles: single role (everyone equal) or owner/admin + regular user? Recommendation: owner + member roles minimal (owner manages users), keep everything else shared.
  2. Onboarding: owner creates users with a temporary password, or email invite link, or shared join code? Recommendation: owner creates user and sets a temporary password (no email infrastructure exists).
  3. Is a login user linked 1:1 to a `Member` profile (the existing "member switcher")? Recommendation: optional link.
  4. Existing households: convert the household credential into its first owner user (backward compatible logins)? Recommendation: yes.
  5. Password reset / email verification: in scope?
  6. Token: keep `sub` = household id plus add user id claim; revocation/deactivation of a user (token lifetime today).
- **Draft scope (pending answers)**: new `users` table, migration of existing credentials, login by user, token carries `user_id` and `household_id`, `get_current_household` derives from user, no behavior change for existing single-user households.
- **Definition of Done (draft)**: existing 7 auth tests and all tenant-isolation tests green without modification (or with documented changes); migration tested on a copy of production-shaped data; S24 rate limiting covers the new login path; threat model updated; security review gate.
- **Characterization tests needed**: yes: S30 (auth/JWT edges) first. Also add cross-tenant tests for every router before changing the dependency.

### S36 - User management II: manage users in a household (GH #5)
- **Status**: BLOCKED until S35 questions answered.
- **Draft scope**: API and UI to list/add/deactivate users, change own password, role enforcement on user-management endpoints only; IT/EN strings.
- **Definition of Done (draft)**: AC from issue; authorization tests (non-owner cannot manage users, cannot escalate role, cannot touch other households); last owner cannot be removed; rate limit and audit-friendly logging without secrets.

### S37 - Guest attendance in planned meals (GH #3) - BLOCKED: needs spec
Do not slice further until a spec exists. Questions:
1. What is a guest: a named person, an anonymous count ("+2"), or a reusable guest profile?
2. Should guests have dish preferences/dislikes that feed the compatibility alerts, or only count toward headcount?
3. Scope per meal slot only, or also in the weekly default attendance (#11, which is why S33 comes first)?
4. Impact on print/fridge planner and Today view?
5. Any quantity/portion output expected (shopping list)? (Not in the product today.)
Likely dependencies: S29/S34, S33, S30.

### S38 - Automatic weekly menu suggestion (GH #4) - BLOCKED: needs spec
Questions:
1. Rule-based (preferences, tags, attendance, repetition avoidance, meal type) or LLM/external service? An LLM raises a privacy question because family data would leave the host. Recommendation: rule-based first.
2. Which inputs count: member preferences, dish status (`ok`), tags, last-planned date, per-meal ratings from S8?
3. Output: fills the week automatically or proposes a draft the user accepts per slot?
4. Constraints: variety limits, course-type structure (multi-course), alternative dishes, slots already planned?
5. How is quality measured (needed for a testable AC)?
Likely dependencies: S33, S37 (if guests matter), S30/S31.

### S39 - Recipe scraping (GH #6) - BLOCKED: needs spec
Low priority. Note the security impact: the audit's A10 (SSRF) currently passes only because the backend never fetches user-supplied URLs. Scraping introduces SSRF and parsing risk. Questions:
1. Fetch server-side or in the browser (CORS limits)? Recommendation if server-side: allowlist/denylist of private IP ranges, redirect and size/time limits, no credentials.
2. Which sites/formats: schema.org `Recipe` JSON-LD only, or arbitrary HTML?
3. Which fields are imported (title, description, ingredients, source URL, image)? The dish model has no ingredient or image fields today.
4. Copyright/ToS stance on storing scraped content.
5. Does it prefill the dish form for review, or create dishes automatically?
Requires a threat-model update and a `security-engineer` gate. Likely dependencies: S25, S30.

### S40 - Native Android / iOS apps (GH #14, #15) - OUT OF SCOPE
Epics only; do not slice. The responsive SPA from S15 is the current mobile answer. Suggested triage questions: is a PWA (installable, offline shell, home-screen icon) enough? If native is truly required: wrapper (Capacitor) versus separate codebase; store accounts and costs; token storage on device; push notifications. If the answer is PWA, open one new small slice then. Keep issues labeled `epic`/`triage`.

## 4. Traceability Matrix

| Source item | Slice(s) | Notes |
| :-- | :-- | :-- |
| SEC-F01 (default SECRET_KEY) | S25 (report update), S30 (regression test) | Code already remediated in `config.py` validator; report stale |
| SEC-F02 (auth rate limiting) | S24 | Highest priority, public via Cloudflare Tunnel |
| SEC-F03 (CORS wildcards) | S25 | |
| SEC-F04 (HSTS) | S25 | |
| NPM-AUDIT (vite/esbuild) | S26 (detect in CI), S28 (fix) | pip-audit clean |
| QF-1 CI workflow | S26 | |
| QF-2 backend linter | S26 | |
| QF-3 frontend lint and typecheck script | S26 | |
| QF-4 frontend test harness | S27 | |
| DOC-1 Alembic vs auto-migrations | S29 (decision), S34 (conditional implementation) | |
| DOC-2 duplicate psycopg drivers | S29 | |
| DOC-3 gitignored prod compose documented | S29 | |
| TG-1 config/JWT tests | S30 | |
| TG-2 migrations tests | S30 | Destructive dedupe path is untested |
| TG-3 import/export edge cases | S30 | |
| TG-4 theme/date/error/taxonomy utils tests | S31 | |
| TG-5 i18n parity and print engine tests | S31 | |
| #23 print tech debt | S32 | |
| #11 weekly default attendance | S33 | AC to be copied from issue |
| #5 user management | S35, S36 | Blocked pending decisions |
| #3 guest attendance | S37 | Blocked: needs spec |
| #4 weekly menu suggestion | S38 | Blocked: needs spec |
| #6 recipe scraping | S39 | Blocked: needs spec |
| #14, #15 native apps | S40 | Out of scope |

Every in-scope item belongs to exactly one slice (#5 is intentionally split across S35/S36 with disjoint scope).

## 5. Validation Checklist

- [x] Numbering continues from S24; S1-S23 untouched.
- [x] No dependency cycles (see graph above).
- [x] All slices are `S` or `M`; no `L` remains (user management pre-split).
- [x] Security-sensitive slices flagged (S24, S25, S28, S30, S34, S35, S36, S39).
- [x] Needs-spec/triage items are not given invented AC; questions listed.
- [ ] Issue bodies for #11, #23, #5 read and AC copied (NOT possible for the planner: no shell/`gh`). Must be done before S32, S33, S35.
- [ ] User approval of order and of the S29 decision.
- [x] No application code or `docs/PROJECT_STATE.md` modified.

## Issue Map (created 2026-11-21)
S24 #24 · S25 #25 · S26 #26 · S27 #27 · S28 #28 · S29 #29 · S30 #30 · S31 #31 · S34 #32 · S32 #23 · S33 #11 · S35/S36 #5 · S37 #3 · S38 #4 · S39 #6 · S40 #14/#15
