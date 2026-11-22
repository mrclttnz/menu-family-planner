# ADR-0001: Adopt Alembic for schema migrations

- **Status**: Accepted (decision 2026-11-21, slice S29, issue #29). Implemented in S34 (issue #32).
- **Deciders**: project owner (Gate B, `docs/ONBOARDING_REPORT.md`)

## Context
- The schema is created at startup by `Base.metadata.create_all` plus `backend/app/core/migrations.py`, a set of hand-written, idempotent DDL steps with dialect-specific branches (some Postgres-only `SERIAL` branches that SQLite cannot exercise) and a destructive dishes-dedupe step.
- `alembic` is listed in `backend/requirements.txt`, and earlier docs claimed Alembic migrations existed, but there is no `backend/alembic/` directory: docs and code disagreed.
- Upcoming slices change the schema: S33 (weekly default attendance) and S35 (identity model split, every existing household credential migrated).

## Options considered
1. **Document the status quo**: keep runtime `create_all` + `migrations.py`, drop `alembic` from requirements. Cheap, but every schema change needs hand-written dialect-aware DDL with no versioning, no rollback and weak testability.
2. **Adopt Alembic** (chosen): versioned revisions, baseline generated from current models, `alembic stamp` for existing databases, runtime auto-migration removed.

## Decision
Adopt Alembic as the only schema-migration mechanism.

## Consequences
- Migrations become versioned, reviewable and reversible; fresh and legacy databases must both reach `head` with identical schema.
- Existing prod/QNAP databases are stamped automatically by the bootstrap (see below) after a manual backup (procedure in `docs/DEPLOYMENT_RUNBOOK.md`, section 6).
- The container entrypoint (`backend/docker-entrypoint.sh`) runs `python -m app.core.db_bootstrap` (= `alembic upgrade head`) before starting the server; if it fails the server does not start.
- Ordering: S29 (this decision + docs) -> S30 (characterization tests, including `migrations.py`) -> S34 (implementation) -> S33 / S35.

## Implementation (S34)
- `backend/alembic.ini` + `backend/alembic/` (`env.py` takes the URL from `settings.DATABASE_URL`, never from the ini; `render_as_batch` on SQLite). Baseline revision `0001` is the full schema, including the expression index `uq_dishes_household_lower_title` (hand-added: autogenerate skips it, and that index is excluded from autogenerate comparisons because SQLite cannot reflect it and PostgreSQL renders it with different text).
- `app/core/db_bootstrap.py` (`python -m app.core.db_bootstrap`): empty or Alembic-managed DB -> `upgrade head`. **Pre-Alembic ("legacy") DB** -> `create_all` for missing tables + the old idempotent fix-ups in `app/core/migrations.py`, verify nothing is missing against the models (nullability/default drift left by old `ALTER ... ADD COLUMN` is tolerated and logged), `stamp 0001`, then `upgrade head`. If something is missing it refuses to stamp and exits non-zero. If the legacy fix-up would merge/delete duplicate dishes it refuses unless `ALLOW_LEGACY_DEDUP=true` (explicit consent after a backup).
- The app no longer creates or alters schema at startup: the lifespan only checks the DB is at head (`assert_schema_current`) and seeds data. `app/core/migrations.py` survives solely as the legacy bridge and can be deleted once every deployed DB is stamped.
- Legacy DBs are stamped with tolerated nullability/default drift (columns added by old `ALTER ... ADD COLUMN`), so a later autogenerate may show `modify_*` diffs on them; fix with an explicit revision if it matters. The bootstrap is not safe against concurrent runs (single-container deployment assumed). The PostgreSQL path is verified by hand, not in CI (backlog: Postgres service job).
- Rollback: a pre-S34 image is harmless on a stamped DB (it ignores `alembic_version` and runs its own `create_all` + fix-ups); restore the backup only if data was affected.
- Future revisions: `cd backend && alembic revision --autogenerate -m "..."`, always against a throwaway `DATABASE_URL`, then review by hand.
