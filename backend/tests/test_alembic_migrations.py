"""S34 (ADR-0001): Alembic revisions and the deploy-time bootstrap (app.core.db_bootstrap).

SQLite only (the Postgres-only DDL of the legacy path is verified by hand, see docs/TEST_PLAN.md).
"""
import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

import app.models  # noqa: F401
from app.core.database import Base
from app.core.db_bootstrap import (
    BASELINE_REVISION,
    DatabaseBootstrapError,
    alembic_config,
    assert_schema_current,
    current_revision,
    head_revision,
    include_object,
    upgrade_database,
)

FUNCTIONAL_INDEX = "uq_dishes_household_lower_title"


@pytest.fixture
def make_engine(tmp_path):
    engines = []

    def _make(name="db.sqlite"):
        engine = create_engine(f"sqlite:///{tmp_path / name}")
        engines.append(engine)
        return engine

    yield _make
    for engine in engines:
        engine.dispose()


def _fingerprint(engine):
    """Comparable description of the whole schema (tables, columns, FKs, unique constraints, indexes)."""
    insp = inspect(engine)
    with engine.connect() as conn:
        index_rows = conn.execute(
            text("SELECT tbl_name, name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
        ).fetchall()
    result = {}
    for table in sorted(insp.get_table_names()):
        if table == "alembic_version":
            continue
        result[table] = {
            "columns": sorted((c["name"], str(c["type"]), c["nullable"]) for c in insp.get_columns(table)),
            "pk": sorted(insp.get_pk_constraint(table)["constrained_columns"]),
            "fks": sorted(
                (tuple(f["constrained_columns"]), f["referred_table"], f["options"].get("ondelete"))
                for f in insp.get_foreign_keys(table)
            ),
            "uniques": sorted(tuple(u["column_names"]) for u in insp.get_unique_constraints(table)),
            "indexes": sorted(name for tbl, name in index_rows if tbl == table),
        }
    return result


def _diff(engine):
    with engine.connect() as conn:
        return compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True, "include_object": include_object}), Base.metadata)


def _exec(engine, sql, **params):
    with engine.begin() as conn:
        conn.execute(text(sql), params)


def test_fresh_database_reaches_head_and_matches_the_models(make_engine):
    engine = make_engine()
    upgrade_database(engine)

    with engine.connect() as conn:
        assert current_revision(conn) == head_revision()
    assert _diff(engine) == []
    assert set(inspect(engine).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
    # The inspector cannot reflect expression indexes on SQLite: check sqlite_master directly.
    with engine.connect() as conn:
        sql = conn.execute(text("SELECT sql FROM sqlite_master WHERE name = :n"), {"n": FUNCTIONAL_INDEX}).scalar()
    assert sql is not None and "lower(trim(title))" in sql.lower() and "UNIQUE" in sql.upper()


def test_upgrade_is_idempotent(make_engine):
    engine = make_engine()
    upgrade_database(engine)
    before = _fingerprint(engine)
    upgrade_database(engine)
    assert _fingerprint(engine) == before


def test_downgrade_to_base_then_upgrade_again_round_trips(make_engine):
    engine = make_engine()
    upgrade_database(engine)
    expected = _fingerprint(engine)

    with engine.begin() as conn:
        command.downgrade(alembic_config(conn), "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}

    upgrade_database(engine)
    assert _fingerprint(engine) == expected


def test_legacy_database_is_stamped_and_ends_identical_to_a_fresh_one(make_engine):
    fresh, legacy = make_engine("fresh.sqlite"), make_engine("legacy.sqlite")
    upgrade_database(fresh)
    Base.metadata.create_all(bind=legacy)  # what the pre-S34 app did at startup: no alembic_version
    assert "alembic_version" not in inspect(legacy).get_table_names()

    upgrade_database(legacy)

    with legacy.connect() as conn:
        assert current_revision(conn) == head_revision()
    assert _fingerprint(legacy) == _fingerprint(fresh)


def test_legacy_database_with_missing_late_columns_and_tables_is_repaired_and_keeps_data(make_engine):
    fresh, legacy = make_engine("fresh.sqlite"), make_engine("legacy.sqlite")
    upgrade_database(fresh)
    Base.metadata.create_all(bind=legacy)
    _exec(legacy, "INSERT INTO households (name, email, password_hash, created_at, updated_at) "
                  "VALUES ('H', 'h@example.com', 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    _exec(legacy, "ALTER TABLE dish_statuses DROP COLUMN is_default")
    for table in ("meal_slot_dish_ratings", "dish_tags", "tags"):
        _exec(legacy, f"DROP TABLE {table}")

    upgrade_database(legacy)

    assert _fingerprint(legacy).keys() == _fingerprint(fresh).keys()
    # Only nullability/default drift is left (ALTER TABLE ADD COLUMN cannot add NOT NULL): nothing missing.
    ops = [op for d in _diff(legacy) for op in (d if isinstance(d, list) else [d])]
    assert all(op[0].startswith("modify") for op in ops)
    with legacy.connect() as conn:
        assert conn.execute(text("SELECT email FROM households")).scalar() == "h@example.com"
        assert current_revision(conn) == head_revision()


def test_legacy_database_with_an_unrecoverable_gap_is_not_stamped(make_engine):
    legacy = make_engine()
    Base.metadata.create_all(bind=legacy)
    _exec(legacy, "ALTER TABLE members DROP COLUMN avatar_color")  # no legacy fix-up restores this

    with pytest.raises(DatabaseBootstrapError, match="NOT stamped"):
        upgrade_database(legacy)

    assert "alembic_version" not in inspect(legacy).get_table_names()


def test_baseline_revision_id_is_the_stamp_target():
    assert BASELINE_REVISION == "0001"


def test_assert_schema_current_rejects_empty_and_accepts_head(make_engine):
    engine = make_engine()
    with pytest.raises(DatabaseBootstrapError, match="db_bootstrap"):
        assert_schema_current(engine)
    upgrade_database(engine)
    assert_schema_current(engine)
