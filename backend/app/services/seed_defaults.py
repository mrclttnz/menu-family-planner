from sqlalchemy.orm import Session
from app.models.taxonomy import DishStatusLookup, DishStatus, MealType, CourseType, SourceType


def seed_system_lookups(db: Session) -> None:
    """Seeds global master lookups (dish statuses, meal types, default course types, and source types)."""
    # 1. Dish Status Lookups
    default_status_lookups = [
        {"code": "to_try", "name": "Da provare", "description": "Ricetta nuova da sperimentare", "sort_order": 1},
        {"code": "ok", "name": "OK", "description": "Piatto collaudato e approvato", "sort_order": 2},
        {"code": "discarded", "name": "Scartato", "description": "Non gradito o non replicabile", "sort_order": 3},
        {"code": "retry_with_changes", "name": "Da riprovare con variazioni", "description": "Buona base ma richiede modifiche", "sort_order": 4},
        {"code": "favorite", "name": "Preferito", "description": "Un grande classico di famiglia", "sort_order": 5},
    ]
    for item in default_status_lookups:
        existing = db.query(DishStatusLookup).filter_by(code=item["code"]).first()
        if not existing:
            lookup = DishStatusLookup(**item, is_system=True)
            db.add(lookup)

    # 2. Meal Types
    default_meal_types = [
        {"code": "breakfast", "name": "Colazione", "default_sort_order": 1, "is_default_active": False},
        {"code": "brunch", "name": "Brunch", "default_sort_order": 2, "is_default_active": False},
        {"code": "lunch", "name": "Pranzo", "default_sort_order": 3, "is_default_active": True},
        {"code": "snack", "name": "Merenda", "default_sort_order": 4, "is_default_active": False},
        {"code": "aperitif", "name": "Aperitivo", "default_sort_order": 5, "is_default_active": False},
        {"code": "dinner", "name": "Cena", "default_sort_order": 6, "is_default_active": True},
    ]
    for item in default_meal_types:
        existing = db.query(MealType).filter_by(code=item["code"]).first()
        if not existing:
            meal_type = MealType(**item)
            db.add(meal_type)

    # 3. Default Global Course Types
    default_course_types = [
        {"name": "Antipasto", "sort_order": 1},
        {"name": "Primo", "sort_order": 2},
        {"name": "Secondo", "sort_order": 3},
        {"name": "Contorno", "sort_order": 4},
        {"name": "Piatto unico", "sort_order": 5},
        {"name": "Dolce", "sort_order": 6},
        {"name": "Bevanda", "sort_order": 7},
    ]
    for item in default_course_types:
        existing = db.query(CourseType).filter_by(household_id=None, name=item["name"]).first()
        if not existing:
            course = CourseType(household_id=None, name=item["name"], sort_order=item["sort_order"], is_active=True)
            db.add(course)

    # 4. Default Global Source Types
    default_source_types = [
        {"name": "Libro / Rivista", "icon": "book"},
        {"name": "Sito Web", "icon": "globe"},
        {"name": "Social / Reel", "icon": "video"},
        {"name": "Newsletter", "icon": "mail"},
        {"name": "Note personali", "icon": "edit-3"},
    ]
    for item in default_source_types:
        existing = db.query(SourceType).filter_by(household_id=None, name=item["name"]).first()
        if not existing:
            source = SourceType(household_id=None, name=item["name"], icon=item["icon"], is_active=True)
            db.add(source)

    db.commit()


def seed_household_statuses(db: Session, household_id: int) -> None:
    """Initializes a household with default dish statuses referencing the master lookups."""
    lookups = db.query(DishStatusLookup).all()
    colors = {
        "to_try": "#F59E0B",               # amber
        "ok": "#10B981",                   # emerald
        "discarded": "#EF4444",            # rose
        "retry_with_changes": "#8B5CF6",   # purple
        "favorite": "#EC4899",             # pink
    }
    for lookup in lookups:
        existing = db.query(DishStatus).filter_by(household_id=household_id, status_lookup_id=lookup.id).first()
        if not existing:
            color = colors.get(lookup.code, "#10B981")
            status = DishStatus(
                household_id=household_id,
                status_lookup_id=lookup.id,
                color=color,
                is_active=True
            )
            db.add(status)
    db.commit()
