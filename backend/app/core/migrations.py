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

        # Issue #17: Case-insensitive, whitespace-trimmed unique index on dishes per household
        if "dishes" in table_names:
            # Deduplicate any pre-existing duplicate dishes per household before creating the unique index
            duplicates = conn.execute(text("""
                SELECT household_id, LOWER(TRIM(title)) AS norm_title
                FROM dishes
                GROUP BY household_id, LOWER(TRIM(title))
                HAVING COUNT(*) > 1
            """)).fetchall()

            for dup_row in duplicates:
                h_id = dup_row[0]
                norm_title = dup_row[1]
                dish_rows = conn.execute(
                    text("""
                        SELECT id FROM dishes
                        WHERE household_id = :h_id AND LOWER(TRIM(title)) = :norm_title
                        ORDER BY id ASC
                    """),
                    {"h_id": h_id, "norm_title": norm_title}
                ).fetchall()

                if len(dish_rows) > 1:
                    keeper_id = dish_rows[0][0]
                    dup_ids = [r[0] for r in dish_rows[1:]]
                    for dup_id in dup_ids:
                        conn.execute(
                            text("""
                                DELETE FROM meal_slot_dishes
                                WHERE dish_id = :dup_id
                                  AND meal_slot_id IN (SELECT meal_slot_id FROM meal_slot_dishes WHERE dish_id = :keeper_id)
                            """),
                            {"dup_id": dup_id, "keeper_id": keeper_id}
                        )
                        conn.execute(
                            text("UPDATE meal_slot_dishes SET dish_id = :keeper_id WHERE dish_id = :dup_id"),
                            {"dup_id": dup_id, "keeper_id": keeper_id}
                        )
                        conn.execute(
                            text("""
                                DELETE FROM dish_member_preferences
                                WHERE dish_id = :dup_id
                                  AND member_id IN (SELECT member_id FROM dish_member_preferences WHERE dish_id = :keeper_id)
                            """),
                            {"dup_id": dup_id, "keeper_id": keeper_id}
                        )
                        conn.execute(
                            text("UPDATE dish_member_preferences SET dish_id = :keeper_id WHERE dish_id = :dup_id"),
                            {"dup_id": dup_id, "keeper_id": keeper_id}
                        )
                        conn.execute(text("DELETE FROM dishes WHERE id = :dup_id"), {"dup_id": dup_id})

            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_dishes_household_lower_title ON dishes (household_id, LOWER(TRIM(title)))"))

