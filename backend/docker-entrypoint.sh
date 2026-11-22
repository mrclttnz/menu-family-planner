#!/bin/sh
# Container entrypoint (S34, ADR-0001): migrate the database to Alembic head, then serve.
# Fails closed: if the migration/bootstrap fails, the server does not start.
set -eu
python -m app.core.db_bootstrap
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
