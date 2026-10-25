from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.household import Household, Member
from app.models.taxonomy import DishStatus, CourseType, SourceType
from app.models.dish import Dish, DishCourse, DishMemberPreference
from app.schemas.dish import (
    DishCreate,
    DishUpdate,
    DishResponse,
    StatusSummary,
    CourseSummary,
    DishSourceInfo,
    MemberPreferenceSummary,
)
from app.schemas.preference import PreferenceUpdate, PreferenceResponse
from app.api.deps import get_current_household

router = APIRouter(prefix="/dishes", tags=["Dish Catalog & Preferences"])


def build_dish_response(dish: Dish, household_members: List[Member]) -> DishResponse:
    # 1. Status Summary
    status_summary = StatusSummary(
        id=dish.status.id,
        code=dish.status.lookup.code,
        name=dish.status.custom_label if dish.status.custom_label else dish.status.lookup.name,
        color=dish.status.color,
    )

    # 2. Courses
    courses = [
        CourseSummary(id=dc.course_type.id, name=dc.course_type.name)
        for dc in dish.courses
    ]

    # 3. Source Info
    source_info = DishSourceInfo(
        source_type_id=dish.source_type.id if dish.source_type else None,
        source_type_name=dish.source_type.name if dish.source_type else None,
        source_type_icon=dish.source_type.icon if dish.source_type else None,
        source_reference=dish.source_reference,
        source_url=dish.source_url,
    )

    # 4. Member Preferences (unspecified defaults to 'neutral')
    pref_map = {p.member_id: p.rating for p in dish.preferences}
    preferences = [
        MemberPreferenceSummary(
            member_id=m.id,
            member_name=m.name,
            avatar_color=m.avatar_color,
            rating=pref_map.get(m.id, "neutral")
        )
        for m in household_members
    ]

    return DishResponse(
        id=dish.id,
        household_id=dish.household_id,
        title=dish.title,
        description=dish.description,
        notes=dish.notes,
        status=status_summary,
        courses=courses,
        source=source_info,
        preferences=preferences,
        created_at=dish.created_at,
        updated_at=dish.updated_at,
    )


@router.get("", response_model=List[DishResponse])
def list_dishes(
    status_id: Optional[int] = Query(None, description="Filter by dish status"),
    course_id: Optional[int] = Query(None, description="Filter by course type"),
    search: Optional[str] = Query(None, description="Search in title or notes"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List dishes with multi-course and status filtering."""
    query = db.query(Dish).filter(Dish.household_id == current_household.id)

    if status_id:
        query = query.filter(Dish.status_id == status_id)

    if course_id:
        query = query.join(Dish.courses).filter(DishCourse.course_type_id == course_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Dish.title.ilike(term), Dish.notes.ilike(term)))

    dishes = query.order_by(Dish.title.asc()).all()
    members = db.query(Member).filter(Member.household_id == current_household.id).all()

    return [build_dish_response(d, members) for d in dishes]


@router.post("", response_model=DishResponse, status_code=status.HTTP_201_CREATED)
def create_dish(
    req: DishCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Create a new dish with courses and recipe source."""
    # Verify status belongs to household
    status_obj = db.query(DishStatus).filter(
        DishStatus.id == req.status_id,
        DishStatus.household_id == current_household.id
    ).first()
    if not status_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status_id for this household.")

    # Verify course types exist
    course_objs = db.query(CourseType).filter(
        CourseType.id.in_(req.course_ids),
        or_(CourseType.household_id.is_(None), CourseType.household_id == current_household.id)
    ).all()
    if len(course_objs) != len(req.course_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more course_ids are invalid.")

    # Verify source type if provided
    if req.source_type_id:
        source_obj = db.query(SourceType).filter(
            SourceType.id == req.source_type_id,
            or_(SourceType.household_id.is_(None), SourceType.household_id == current_household.id)
        ).first()
        if not source_obj:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source_type_id.")

    dish = Dish(
        household_id=current_household.id,
        status_id=req.status_id,
        source_type_id=req.source_type_id,
        title=req.title.strip(),
        description=req.description.strip() if req.description else None,
        notes=req.notes.strip() if req.notes else None,
        source_reference=req.source_reference.strip() if req.source_reference else None,
        source_url=req.source_url.strip() if req.source_url else None,
    )
    db.add(dish)
    db.flush()  # assign dish.id

    # Associate courses
    for cid in req.course_ids:
        db.add(DishCourse(dish_id=dish.id, course_type_id=cid))

    db.commit()
    db.refresh(dish)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_dish_response(dish, members)


@router.get("/{dish_id}", response_model=DishResponse)
def get_dish(
    dish_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Retrieve full details of a dish."""
    dish = db.query(Dish).filter(
        Dish.id == dish_id,
        Dish.household_id == current_household.id
    ).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found.")

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_dish_response(dish, members)


@router.put("/{dish_id}", response_model=DishResponse)
def update_dish(
    dish_id: int,
    req: DishUpdate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Update dish details and courses."""
    dish = db.query(Dish).filter(
        Dish.id == dish_id,
        Dish.household_id == current_household.id
    ).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found.")

    if req.title is not None:
        dish.title = req.title.strip()
    if req.description is not None:
        dish.description = req.description.strip() if req.description else None
    if req.notes is not None:
        dish.notes = req.notes.strip() if req.notes else None
    if req.source_reference is not None:
        dish.source_reference = req.source_reference.strip() if req.source_reference else None
    if req.source_url is not None:
        dish.source_url = req.source_url.strip() if req.source_url else None

    if req.status_id is not None:
        status_obj = db.query(DishStatus).filter(
            DishStatus.id == req.status_id,
            DishStatus.household_id == current_household.id
        ).first()
        if not status_obj:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status_id.")
        dish.status_id = req.status_id

    if req.source_type_id is not None:
        source_obj = db.query(SourceType).filter(
            SourceType.id == req.source_type_id,
            or_(SourceType.household_id.is_(None), SourceType.household_id == current_household.id)
        ).first()
        if not source_obj:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source_type_id.")
        dish.source_type_id = req.source_type_id

    if req.course_ids is not None:
        if len(req.course_ids) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dish must have at least one course.")
        course_objs = db.query(CourseType).filter(
            CourseType.id.in_(req.course_ids),
            or_(CourseType.household_id.is_(None), CourseType.household_id == current_household.id)
        ).all()
        if len(course_objs) != len(set(req.course_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more course_ids are invalid.")
        # Delete existing courses and re-add
        db.query(DishCourse).filter(DishCourse.dish_id == dish.id).delete()
        for cid in req.course_ids:
            db.add(DishCourse(dish_id=dish.id, course_type_id=cid))

    db.commit()
    db.refresh(dish)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_dish_response(dish, members)


@router.delete("/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dish(
    dish_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Delete dish from catalog."""
    dish = db.query(Dish).filter(
        Dish.id == dish_id,
        Dish.household_id == current_household.id
    ).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found.")

    db.delete(dish)
    db.commit()
    return None


@router.put("/{dish_id}/preferences/{member_id}", response_model=PreferenceResponse)
def set_member_preference(
    dish_id: int,
    member_id: int,
    req: PreferenceUpdate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Record or update a member's preference ('favorite', 'neutral', 'dislike') for a dish."""
    # Verify dish belongs to household
    dish = db.query(Dish).filter(Dish.id == dish_id, Dish.household_id == current_household.id).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found.")

    # Verify member belongs to household
    member = db.query(Member).filter(Member.id == member_id, Member.household_id == current_household.id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    pref = db.query(DishMemberPreference).filter_by(dish_id=dish_id, member_id=member_id).first()
    if not pref:
        pref = DishMemberPreference(
            dish_id=dish_id,
            member_id=member_id,
            rating=req.rating
        )
        db.add(pref)
    else:
        pref.rating = req.rating

    db.commit()
    db.refresh(pref)
    return PreferenceResponse(
        dish_id=pref.dish_id,
        member_id=pref.member_id,
        rating=pref.rating,
        updated_at=pref.updated_at
    )
