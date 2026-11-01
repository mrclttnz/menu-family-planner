from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.household import Household
from app.models.taxonomy import DishStatusLookup, DishStatus, MealType, CourseType, SourceType
from app.schemas.taxonomy import (
    MealTypeResponse,
    DishStatusResponse,
    DishStatusUpdate,
    CourseTypeCreate,
    CourseTypeResponse,
    SourceTypeCreate,
    SourceTypeResponse,
)
from app.api.deps import get_current_household

router = APIRouter(prefix="/taxonomies", tags=["Taxonomies & Lookups"])


@router.get("/meal-types", response_model=List[MealTypeResponse])
def list_meal_types(db: Session = Depends(get_db)):
    """List all available meal types (ordered by typical daily schedule)."""
    return db.query(MealType).order_by(MealType.default_sort_order.asc()).all()


@router.get("/statuses", response_model=List[DishStatusResponse])
def list_dish_statuses(
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List configured dish statuses for the current household."""
    statuses = (
        db.query(DishStatus)
        .join(DishStatusLookup)
        .filter(DishStatus.household_id == current_household.id)
        .order_by(DishStatusLookup.sort_order.asc())
        .all()
    )
    result = []
    for s in statuses:
        result.append(
            DishStatusResponse(
                id=s.id,
                household_id=s.household_id,
                status_lookup_id=s.status_lookup_id,
                code=s.lookup.code,
                name=s.custom_label if s.custom_label else s.lookup.name,
                custom_label=s.custom_label,
                color=s.color,
                is_default=bool(s.is_default),
                is_active=s.is_active,
            )
        )
    return result


@router.put("/statuses/{status_id}", response_model=DishStatusResponse)
def update_dish_status(
    status_id: int,
    req: DishStatusUpdate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Customize status display color or label for the household."""
    status_obj = db.query(DishStatus).filter(
        DishStatus.id == status_id,
        DishStatus.household_id == current_household.id
    ).first()
    if not status_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish status not found.")

    if req.custom_label is not None:
        status_obj.custom_label = req.custom_label.strip() if req.custom_label else None
    if req.color is not None:
        status_obj.color = req.color.strip()
    if req.is_active is not None:
        status_obj.is_active = req.is_active

    db.commit()
    db.refresh(status_obj)
    return DishStatusResponse(
        id=status_obj.id,
        household_id=status_obj.household_id,
        status_lookup_id=status_obj.status_lookup_id,
        code=status_obj.lookup.code,
        name=status_obj.custom_label if status_obj.custom_label else status_obj.lookup.name,
        custom_label=status_obj.custom_label,
        color=status_obj.color,
        is_default=bool(status_obj.is_default),
        is_active=status_obj.is_active,
    )


@router.get("/courses", response_model=List[CourseTypeResponse])
def list_course_types(
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List available course types (global defaults + household custom)."""
    courses = db.query(CourseType).filter(
        or_(CourseType.household_id.is_(None), CourseType.household_id == current_household.id),
        CourseType.is_active.is_(True)
    ).order_by(CourseType.sort_order.asc(), CourseType.name.asc()).all()

    return [
        CourseTypeResponse(
            id=c.id,
            name=c.name,
            sort_order=c.sort_order,
            is_active=c.is_active,
            is_custom=c.household_id is not None
        )
        for c in courses
    ]


@router.post("/courses", response_model=CourseTypeResponse, status_code=status.HTTP_201_CREATED)
def create_course_type(
    req: CourseTypeCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Add a custom course type for this household."""
    name_clean = req.name.strip()
    existing = db.query(CourseType).filter(
        or_(CourseType.household_id.is_(None), CourseType.household_id == current_household.id),
        CourseType.name.ilike(name_clean)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course type '{name_clean}' already exists."
        )

    course = CourseType(
        household_id=current_household.id,
        name=name_clean,
        sort_order=req.sort_order or 0,
        is_active=True
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseTypeResponse(
        id=course.id,
        name=course.name,
        sort_order=course.sort_order,
        is_active=course.is_active,
        is_custom=True
    )


@router.get("/sources", response_model=List[SourceTypeResponse])
def list_source_types(
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List recipe source types (defaults + household custom)."""
    sources = db.query(SourceType).filter(
        or_(SourceType.household_id.is_(None), SourceType.household_id == current_household.id),
        SourceType.is_active.is_(True)
    ).order_by(SourceType.name.asc()).all()

    return [
        SourceTypeResponse(
            id=s.id,
            name=s.name,
            icon=s.icon,
            is_active=s.is_active,
            is_custom=s.household_id is not None
        )
        for s in sources
    ]


@router.post("/sources", response_model=SourceTypeResponse, status_code=status.HTTP_201_CREATED)
def create_source_type(
    req: SourceTypeCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Add a custom recipe source type for this household."""
    name_clean = req.name.strip()
    existing = db.query(SourceType).filter(
        or_(SourceType.household_id.is_(None), SourceType.household_id == current_household.id),
        SourceType.name.ilike(name_clean)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Source type '{name_clean}' already exists."
        )

    source = SourceType(
        household_id=current_household.id,
        name=name_clean,
        icon=req.icon or "book",
        is_active=True
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return SourceTypeResponse(
        id=source.id,
        name=source.name,
        icon=source.icon,
        is_active=source.is_active,
        is_custom=True
    )
