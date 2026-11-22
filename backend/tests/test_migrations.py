"""S30 / TG-2: characterization of app.core.migrations.run_auto_migrations on legacy-shaped databases.

Only the SQLite dialect can run here. The Postgres-only DDL branches (the `SERIAL` primary keys in the
`tags` / `meal_slot_dish_ratings` CREATE TABLE statements, `ELSE` branch of the tags table) are NOT
exercised by this suite; they need a Postgres service job (tracked as a CI follow-up).
"""
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.migrations import run_auto_migrations
from app.services.seed_defaults import seed_household_statuses, seed_system_lookups

DEDUPE_INDEX = "uq_dishes_household_lower_title"


@pytest.fixture
def legacy_engine():
    """A SQLite database with the current schema (FKs not enforced, like the pre-pragma legacy DBs)."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


def _exec(engine, sql, **params):
    with engine.begin() as conn:
        return conn.execute(text(sql), params)


def _scalar(engine, sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()


def _rows(engine, sql, **params):
    with engine.connect() as conn:
        return [tuple(r) for r in conn.execute(text(sql), params).fetchall()]


def _columns(engine, table):
    return [c["name"] for c in inspect(engine).get_columns(table)]


def _indexes(engine, table):
    # Read sqlite_master directly: the SQLAlchemy inspector cannot reflect the functional (LOWER/TRIM) index.
    return {r[0] for r in _rows(engine, "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = :t", t=table)}


def _seed_household(engine, email="h@example.com"):
    session = sessionmaker(bind=engine)()
    try:
        seed_system_lookups(session)
        _exec(engine, "INSERT INTO households (name, email, password_hash, created_at, updated_at) "
                      "VALUES ('H', :e, 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", e=email)
        household_id = _scalar(engine, "SELECT id FROM households WHERE email = :e", e=email)
        seed_household_statuses(session, household_id)
        return household_id
    finally:
        session.close()


def _first_status_id(engine, household_id):
    return _scalar(engine, "SELECT MIN(id) FROM dish_statuses WHERE household_id = :h", h=household_id)


def _insert_dish(engine, household_id, title):
    _exec(engine,
          "INSERT INTO dishes (household_id, status_id, title, created_at, updated_at) "
          "VALUES (:h, :s, :t, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          h=household_id, s=_first_status_id(engine, household_id), t=title)
    return _scalar(engine, "SELECT MAX(id) FROM dishes")


# --- missing columns ---------------------------------------------------------------------------

def test_adds_missing_is_default_columns_and_marks_ok_status_as_default(legacy_engine):
    household_id = _seed_household(legacy_engine)
    _exec(legacy_engine, "ALTER TABLE dish_status_lookups DROP COLUMN is_default")
    _exec(legacy_engine, "ALTER TABLE dish_statuses DROP COLUMN is_default")
    assert "is_default" not in _columns(legacy_engine, "dish_status_lookups")
    assert "is_default" not in _columns(legacy_engine, "dish_statuses")

    run_auto_migrations(legacy_engine)

    assert "is_default" in _columns(legacy_engine, "dish_status_lookups")
    assert "is_default" in _columns(legacy_engine, "dish_statuses")
    defaults = dict(_rows(legacy_engine, "SELECT code, is_default FROM dish_status_lookups"))
    assert defaults["ok"] == 1
    assert all(v == 0 for code, v in defaults.items() if code != "ok")
    # The household's 'ok' status becomes its (only) default status.
    household_defaults = _rows(
        legacy_engine,
        "SELECT l.code FROM dish_statuses s JOIN dish_status_lookups l ON l.id = s.status_lookup_id "
        "WHERE s.household_id = :h AND s.is_default = 1", h=household_id)
    assert household_defaults == [("ok",)]


def test_existing_household_default_status_is_not_overridden(legacy_engine):
    household_id = _seed_household(legacy_engine)
    # Simulate a household whose default was already set to something other than 'ok'.
    _exec(legacy_engine, "UPDATE dish_statuses SET is_default = 0 WHERE household_id = :h", h=household_id)
    _exec(legacy_engine,
          "UPDATE dish_statuses SET is_default = 1 WHERE household_id = :h AND status_lookup_id = "
          "(SELECT id FROM dish_status_lookups WHERE code = 'favorite')", h=household_id)

    run_auto_migrations(legacy_engine)

    codes = _rows(
        legacy_engine,
        "SELECT l.code FROM dish_statuses s JOIN dish_status_lookups l ON l.id = s.status_lookup_id "
        "WHERE s.household_id = :h AND s.is_default = 1", h=household_id)
    assert codes == [("favorite",)]


# --- missing tables ----------------------------------------------------------------------------

def test_recreates_missing_tags_dish_tags_and_ratings_tables(legacy_engine):
    for table in ("meal_slot_dish_ratings", "dish_tags", "tags"):
        _exec(legacy_engine, f"DROP TABLE {table}")
    assert not {"tags", "dish_tags", "meal_slot_dish_ratings"} & set(inspect(legacy_engine).get_table_names())

    run_auto_migrations(legacy_engine)

    tables = set(inspect(legacy_engine).get_table_names())
    assert {"tags", "dish_tags", "meal_slot_dish_ratings"} <= tables
    assert {"id", "household_id", "name", "color", "created_at"} <= set(_columns(legacy_engine, "tags"))
    assert set(_columns(legacy_engine, "dish_tags")) == {"dish_id", "tag_id"}
    assert {"meal_slot_dish_id", "member_id", "rating"} <= set(_columns(legacy_engine, "meal_slot_dish_ratings"))


def test_recreated_tags_table_enforces_unique_name_per_household_and_default_color(legacy_engine):
    household_id = _seed_household(legacy_engine)
    for table in ("dish_tags", "tags"):
        _exec(legacy_engine, f"DROP TABLE {table}")
    run_auto_migrations(legacy_engine)

    _exec(legacy_engine, "INSERT INTO tags (household_id, name) VALUES (:h, 'Veloce')", h=household_id)
    assert _scalar(legacy_engine, "SELECT color FROM tags WHERE name = 'Veloce'") == "#16a34a"
    with pytest.raises(IntegrityError):
        _exec(legacy_engine, "INSERT INTO tags (household_id, name) VALUES (:h, 'Veloce')", h=household_id)


# --- dedupe of dishes + unique index -----------------------------------------------------------

def _build_duplicate_scenario(engine):
    """Household 1 has three variants of 'Lasagna' plus 'Risotto'; household 2 has its own 'Lasagna'."""
    h1 = _seed_household(engine, "one@example.com")
    h2 = _seed_household(engine, "two@example.com")
    _exec(engine, f"DROP INDEX {DEDUPE_INDEX}")

    keeper = _insert_dish(engine, h1, "Lasagna")
    dup_spaces = _insert_dish(engine, h1, "  lasagna ")
    dup_upper = _insert_dish(engine, h1, "LASAGNA")
    risotto = _insert_dish(engine, h1, "Risotto")
    other_household = _insert_dish(engine, h2, "Lasagna")

    meal_type = _scalar(engine, "SELECT id FROM meal_types WHERE code = 'lunch'")
    for slot_id, day in ((1, "2026-01-01"), (2, "2026-01-02")):
        _exec(engine, "INSERT INTO meal_slots (id, household_id, date, meal_type_id, sort_order, created_at, updated_at) "
                      "VALUES (:i, :h, :d, :m, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
              i=slot_id, h=h1, d=day, m=meal_type)
    # slot 1 holds both keeper and a duplicate (would violate uq_meal_slot_dish if blindly repointed);
    # slot 2 holds only the other duplicate (must be repointed to the keeper).
    _exec(engine, "INSERT INTO meal_slot_dishes (meal_slot_id, dish_id, sort_order) VALUES (1, :d, 1)", d=keeper)
    _exec(engine, "INSERT INTO meal_slot_dishes (meal_slot_id, dish_id, sort_order) VALUES (1, :d, 2)", d=dup_spaces)
    _exec(engine, "INSERT INTO meal_slot_dishes (meal_slot_id, dish_id, sort_order) VALUES (2, :d, 1)", d=dup_upper)

    for member_id, name in ((1, "Anna"), (2, "Bruno")):
        _exec(engine, "INSERT INTO members (id, household_id, name, is_child, created_at, updated_at) "
                      "VALUES (:i, :h, :n, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", i=member_id, h=h1, n=name)
    # Anna rated both keeper and a duplicate (keeper's rating must win); Bruno only the duplicate (repointed).
    for dish_id, member_id, rating in ((keeper, 1, "favorite"), (dup_spaces, 1, "dislike"), (dup_upper, 2, "dislike")):
        _exec(engine, "INSERT INTO dish_member_preferences (dish_id, member_id, rating, updated_at) "
                      "VALUES (:d, :m, :r, CURRENT_TIMESTAMP)", d=dish_id, m=member_id, r=rating)
    return {"h1": h1, "h2": h2, "keeper": keeper, "risotto": risotto, "other_household": other_household}


def test_dedupe_merges_duplicate_dishes_and_repoints_references(legacy_engine):
    ids = _build_duplicate_scenario(legacy_engine)
    assert DEDUPE_INDEX not in _indexes(legacy_engine, "dishes")

    run_auto_migrations(legacy_engine)

    remaining = {r[0] for r in _rows(legacy_engine, "SELECT id FROM dishes")}
    assert remaining == {ids["keeper"], ids["risotto"], ids["other_household"]}  # lowest id kept; tenants not merged

    assert _rows(legacy_engine, "SELECT meal_slot_id, dish_id, sort_order FROM meal_slot_dishes ORDER BY meal_slot_id") == [
        (1, ids["keeper"], 1),  # the duplicate in the same slot was dropped, keeper's row preserved
        (2, ids["keeper"], 1),  # the lone duplicate was repointed
    ]
    assert _rows(legacy_engine, "SELECT dish_id, member_id, rating FROM dish_member_preferences ORDER BY member_id") == [
        (ids["keeper"], 1, "favorite"),  # keeper's own preference wins over the duplicate's
        (ids["keeper"], 2, "dislike"),   # preference only on a duplicate is repointed
    ]
    assert DEDUPE_INDEX in _indexes(legacy_engine, "dishes")


def test_dedupe_does_not_merge_same_title_across_households(legacy_engine):
    ids = _build_duplicate_scenario(legacy_engine)
    run_auto_migrations(legacy_engine)
    assert _scalar(legacy_engine, "SELECT household_id FROM dishes WHERE id = :i", i=ids["other_household"]) == ids["h2"]
    assert _scalar(legacy_engine, "SELECT COUNT(*) FROM dishes WHERE household_id = :h", h=ids["h1"]) == 2


def test_unique_index_rejects_new_case_and_whitespace_duplicates_after_migration(legacy_engine):
    ids = _build_duplicate_scenario(legacy_engine)
    run_auto_migrations(legacy_engine)
    with pytest.raises(IntegrityError):
        _insert_dish(legacy_engine, ids["h1"], "  RISOTTO  ")
    # Same title in another household is still fine.
    _insert_dish(legacy_engine, ids["h2"], "Risotto")


def test_migrations_are_idempotent(legacy_engine):
    ids = _build_duplicate_scenario(legacy_engine)
    _exec(legacy_engine, "ALTER TABLE dish_statuses DROP COLUMN is_default")
    for table in ("meal_slot_dish_ratings", "dish_tags", "tags"):
        _exec(legacy_engine, f"DROP TABLE {table}")

    run_auto_migrations(legacy_engine)
    snapshot = {
        "dishes": _rows(legacy_engine, "SELECT id, household_id, title FROM dishes ORDER BY id"),
        "slot_dishes": _rows(legacy_engine, "SELECT meal_slot_id, dish_id FROM meal_slot_dishes ORDER BY id"),
        "prefs": _rows(legacy_engine, "SELECT dish_id, member_id, rating FROM dish_member_preferences ORDER BY member_id"),
        "tables": sorted(inspect(legacy_engine).get_table_names()),
        "defaults": _rows(legacy_engine, "SELECT id, is_default FROM dish_statuses ORDER BY id"),
    }

    run_auto_migrations(legacy_engine)  # must not raise nor change anything

    assert snapshot == {
        "dishes": _rows(legacy_engine, "SELECT id, household_id, title FROM dishes ORDER BY id"),
        "slot_dishes": _rows(legacy_engine, "SELECT meal_slot_id, dish_id FROM meal_slot_dishes ORDER BY id"),
        "prefs": _rows(legacy_engine, "SELECT dish_id, member_id, rating FROM dish_member_preferences ORDER BY member_id"),
        "tables": sorted(inspect(legacy_engine).get_table_names()),
        "defaults": _rows(legacy_engine, "SELECT id, is_default FROM dish_statuses ORDER BY id"),
    }
    assert ids["keeper"] in {r[0] for r in snapshot["dishes"]}


def test_migrations_on_up_to_date_database_change_nothing(legacy_engine):
    household_id = _seed_household(legacy_engine)
    dish_id = _insert_dish(legacy_engine, household_id, "Pasta")
    before_tables = sorted(inspect(legacy_engine).get_table_names())

    run_auto_migrations(legacy_engine)

    assert sorted(inspect(legacy_engine).get_table_names()) == before_tables
    assert _rows(legacy_engine, "SELECT id, title FROM dishes") == [(dish_id, "Pasta")]


def test_migrations_on_empty_database_only_create_the_three_late_tables():
    """Characterization: without create_all first, only the unconditional CREATE TABLE branches run
    (the app lifespan always runs create_all before the migrations, so this is not a real-world path)."""
    engine = create_engine("sqlite:///:memory:", poolclass=StaticPool)
    run_auto_migrations(engine)
    assert set(inspect(engine).get_table_names()) == {"meal_slot_dish_ratings", "tags", "dish_tags"}
    engine.dispose()
