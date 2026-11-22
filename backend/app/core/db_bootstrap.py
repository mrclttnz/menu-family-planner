"""Database bootstrap for deploys (S34, ADR-0001): `python -m app.core.db_bootstrap`.

Brings the configured database (`settings.DATABASE_URL`) to the Alembic `head` revision:

* fresh / empty database            -> `alembic upgrade head`
* database already under Alembic    -> `alembic upgrade head`
* pre-Alembic ("legacy") database   -> legacy fix-ups (`run_auto_migrations`), verify nothing is
  missing compared with the models, `alembic stamp` the baseline revision, then `upgrade head`.

The legacy path is the only user of `app.core.migrations`; it is a one-way bridge that can be deleted
once every deployed database has been stamped. TAKE A BACKUP BEFORE THE FIRST RUN on a real database
(see docs/DEPLOYMENT_RUNBOOK.md): the legacy fix-ups include a destructive dishes de-duplication.
"""
import logging
import sys
from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, pool, text
from sqlalchemy.engine import Connection, Engine

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.core.config import settings
from app.core.database import Base
from app.core.migrations import run_auto_migrations

logger = logging.getLogger("app.db_bootstrap")

BACKEND_DIR = Path(__file__).resolve().parents[2]
BASELINE_REVISION = "0001"
VERSION_TABLE = "alembic_version"

# Diff operations meaning "the database lacks something the models have": not safe to stamp over.
# (Nullability/default/type drifts left by the old ALTER-based fix-ups are tolerated and only logged.)
_FATAL_DIFFS = {"add_table", "add_column", "add_index", "add_fk", "add_constraint"}


# Expression index that autogenerate cannot compare: SQLite cannot reflect it, and PostgreSQL reports it as
# `lower(TRIM(BOTH FROM title))`, which never equals the model's `lower(trim(title))` text (false diff).
# It is declared in the model and in the baseline revision and checked by hand / by tests instead.
UNCOMPARABLE_INDEXES = {"uq_dishes_household_lower_title"}


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """`include_object` hook for Alembic comparisons (env.py and the legacy check)."""
    return not (type_ == "index" and name in UNCOMPARABLE_INDEXES)


class DatabaseBootstrapError(RuntimeError):
    pass


def alembic_config(connection: Connection | None = None) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    if connection is not None:
        cfg.attributes["connection"] = connection
    return cfg


def head_revision() -> str:
    return ScriptDirectory.from_config(alembic_config()).get_current_head()


def current_revision(connection: Connection) -> str | None:
    return MigrationContext.configure(connection).get_current_revision()


def _is_legacy(connection: Connection) -> bool:
    """Has application tables but is not under Alembic control (no version table or no revision)."""
    tables = set(inspect(connection).get_table_names())
    if VERSION_TABLE in tables and current_revision(connection) is not None:
        return False
    return bool(tables - {VERSION_TABLE})


def _describe(op: tuple) -> str:
    kind = op[0]
    if kind == "add_table":
        return f"{kind} {op[1].name}"
    if kind == "add_column":
        return f"{kind} {op[2]}.{op[3].name}"
    return f"{kind} {getattr(op[1], 'name', op[1])}"


def _legacy_schema_problems(connection: Connection) -> list[str]:
    context = MigrationContext.configure(connection, opts={"compare_type": True, "include_object": include_object})
    fatal: list[str] = []
    for diff in compare_metadata(context, Base.metadata):
        for op in diff if isinstance(diff, list) else [diff]:
            if op[0] in _FATAL_DIFFS:
                fatal.append(_describe(op))
            else:
                logger.warning("legacy schema drift tolerated: %s", _describe(op))
    return fatal


def _count_duplicate_dishes(connection: Connection) -> int:
    if "dishes" not in inspect(connection).get_table_names():
        return 0
    return connection.execute(text(
        "SELECT COALESCE(SUM(n - 1), 0) FROM ("
        " SELECT COUNT(*) AS n FROM dishes GROUP BY household_id, LOWER(TRIM(title)) HAVING COUNT(*) > 1) d"
    )).scalar_one()


def upgrade_database(engine: Engine | None = None) -> None:
    """Bring `engine` (default: built from settings.DATABASE_URL) to head. Idempotent."""
    own_engine = engine is None
    if engine is None:
        url = settings.DATABASE_URL
        engine = create_engine(
            url, poolclass=pool.NullPool,
            connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
        )
    try:
        with engine.connect() as probe:
            legacy = _is_legacy(probe)
        if legacy:
            with engine.connect() as conn:
                duplicates = _count_duplicate_dishes(conn)
            if duplicates and not settings.ALLOW_LEGACY_DEDUP:
                raise DatabaseBootstrapError(
                    f"Pre-Alembic database has {duplicates} duplicate dish(es) that the legacy fix-up would "
                    "merge and DELETE. Nothing was changed. Take a backup, then set ALLOW_LEGACY_DEDUP=true "
                    "for this one start (docs/DEPLOYMENT_RUNBOOK.md, section 5b)."
                )
            logger.warning("Pre-Alembic database detected: applying legacy fix-ups, then stamping %s", BASELINE_REVISION)
            # Same order as the pre-S34 startup: missing tables first (create_all never alters existing
            # ones), then the idempotent column/index fix-ups.
            Base.metadata.create_all(bind=engine)
            run_auto_migrations(engine)
            with engine.connect() as conn:
                problems = _legacy_schema_problems(conn)
            if problems:
                raise DatabaseBootstrapError(
                    "Legacy database does not match the models and was NOT stamped. Missing: "
                    + "; ".join(problems)
                    + ". Restore from backup or fix manually (docs/DEPLOYMENT_RUNBOOK.md, 'Database migrations')."
                )
            with engine.begin() as conn:
                command.stamp(alembic_config(conn), BASELINE_REVISION)
        with engine.begin() as conn:
            command.upgrade(alembic_config(conn), "head")
    finally:
        if own_engine:
            engine.dispose()


def assert_schema_current(engine: Engine) -> None:
    """Refuse to serve on a database that is not at head (used by the app lifespan)."""
    with engine.connect() as conn:
        current = current_revision(conn)
    head = head_revision()
    if current != head:
        raise DatabaseBootstrapError(
            f"Database schema is at revision {current!r} but the application needs {head!r}. "
            "Run `python -m app.core.db_bootstrap` (the container entrypoint does it) after taking a backup."
        )


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        upgrade_database()
    except DatabaseBootstrapError as exc:
        logger.error("%s", exc)
        return 1
    logger.info("Database is at Alembic head (%s).", head_revision())
    return 0


if __name__ == "__main__":
    sys.exit(main())
