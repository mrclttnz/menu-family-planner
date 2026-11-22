# ADR-0001: Adopt Alembic for schema migrations

- **Status**: Accepted (decision 2026-11-21, recorded in slice S29, issue #29). Implementation pending in S34 (issue #32).
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
- Existing prod/QNAP databases need a one-off `alembic stamp` after a backup (procedure to be written in S34 and in `docs/DEPLOYMENT_RUNBOOK.md`).
- The container entrypoint will run `alembic upgrade head` (S34); until then the runtime mechanism stays active.
- Ordering: S29 (this decision + docs) -> S30 (characterization tests, including `migrations.py`) -> S34 (implementation) -> S33 / S35.

## Current state (until S34 is done)
Schema creation and upgrades still run through `create_all` + `app/core/migrations.py` at startup. There is no `backend/alembic/` yet.
