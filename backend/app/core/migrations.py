from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_auto_migrations(engine: Engine) -> None:
    """Safely adds missing columns and tables to existing SQLite/Postgres databases."""
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    with engine.begin() as conn:
        if "dish_status_lookups" in table_names:
            columns = [c["name"] for c in inspector.get_columns("dish_status_lookups")]
            if "is_default" not in columns:
                conn.execute(text("ALTER TABLE dish_status_lookups ADD COLUMN is_default BOOLEAN DEFAULT FALSE"))

        if "dish_statuses" in table_names:
            columns = [c["name"] for c in inspector.get_columns("dish_statuses")]
            if "is_default" not in columns:
                conn.execute(text("ALTER TABLE dish_statuses ADD COLUMN is_default BOOLEAN DEFAULT FALSE"))

        if "dish_status_lookups" in table_names and "dish_statuses" in table_names:
            conn.execute(text("UPDATE dish_status_lookups SET is_default = TRUE WHERE code = 'ok'"))
            conn.execute(text("UPDATE dish_status_lookups SET is_default = FALSE WHERE code != 'ok'"))
            conn.execute(text("""
                UPDATE dish_statuses 
                SET is_default = TRUE 
                WHERE status_lookup_id IN (SELECT id FROM dish_status_lookups WHERE code = 'ok')
                  AND household_id NOT IN (SELECT household_id FROM dish_statuses WHERE is_default = TRUE)
            """))

        if "meal_slot_dish_ratings" not in table_names:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS meal_slot_dish_ratings (
                    id SERIAL PRIMARY KEY,
                    meal_slot_dish_id INTEGER NOT NULL REFERENCES meal_slot_dishes(id) ON DELETE CASCADE,
                    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                    rating VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_slot_dish_member_rating UNIQUE (meal_slot_dish_id, member_id)
                )
            """))

        if "tags" not in table_names:
            if engine.dialect.name == "sqlite":
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tags (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
                        name VARCHAR(50) NOT NULL,
                        color VARCHAR(20) NOT NULL DEFAULT '#16a34a',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_household_tag_name UNIQUE (household_id, name)
                    )
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tags (
                        id SERIAL PRIMARY KEY,
                        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
                        name VARCHAR(50) NOT NULL,
                        color VARCHAR(20) NOT NULL DEFAULT '#16a34a',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_household_tag_name UNIQUE (household_id, name)
                    )
                """))

        if "dish_tags" not in table_names:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dish_tags (
                    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (dish_id, tag_id)
                )
            """))
