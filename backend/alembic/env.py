"""Alembic environment (ADR-0001, S34).

- The URL comes from `settings.DATABASE_URL` (never from alembic.ini, never logged).
- The engine is built directly (no `config.set_main_option`) so `%` in URL-encoded passwords is safe.
- A caller can pass an open connection via `config.attributes["connection"]` (used by tests and by
  `app.core.db_bootstrap`), otherwise a fresh engine is created.
"""
from alembic import context
from sqlalchemy import create_engine, pool

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.core.config import settings
from app.core.database import Base
from app.core.db_bootstrap import include_object

config = context.config
target_metadata = Base.metadata


def _configure(**kwargs) -> None:
    context.configure(target_metadata=target_metadata, compare_type=True, include_object=include_object, **kwargs)


def run_migrations_offline() -> None:
    _configure(
        url=settings.DATABASE_URL,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=settings.DATABASE_URL.startswith("sqlite"),
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    _configure(connection=connection, render_as_batch=connection.dialect.name == "sqlite")
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(settings.DATABASE_URL, poolclass=pool.NullPool, connect_args=connect_args)
    try:
        with engine.connect() as conn:
            _run(conn)
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
