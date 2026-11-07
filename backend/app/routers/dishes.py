from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.household import Household, Member
from app.models.taxonomy import DishStatus, CourseType, SourceType
from app.models.dish import Dish, DishCourse, DishMemberPreference, Tag, DishTag
from app.models.meal_plan import MealSlot, MealSlotDish, MealSlotDishNote
from app.schemas.dish import (
    DishCreate,
    DishUpdate,
    DishResponse,
    StatusSummary,
    CourseSummary,
    DishSourceInfo,
    MemberPreferenceSummary,
    DishImportResult,
    TagSummary,
    DishTagInput,
)
from app.schemas.preference import PreferenceUpdate, PreferenceResponse
from app.schemas.meal_plan import SlotDishNoteResponse
from app.api.deps import get_current_household
from app.services.dishes_import_export import (
    export_dishes_to_xlsx,
    export_dishes_to_csv,
    export_dishes_to_json,
    generate_import_template,
    import_dishes_from_bytes,
)

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

    # 3. Tags
    tags = [
        TagSummary(id=dt.tag.id, name=dt.tag.name, color=dt.tag.color)
        for dt in dish.tags
    ]

    # 4. Source Info
    source_info = DishSourceInfo(
        source_type_id=dish.source_type.id if dish.source_type else None,
        source_type_name=dish.source_type.name if dish.source_type else None,
        source_type_icon=dish.source_type.icon if dish.source_type else None,
        source_reference=dish.source_reference,
        source_url=dish.source_url,
    )

    # 5. Member Preferences (unspecified defaults to 'neutral')
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
        tags=tags,
        source=source_info,
        preferences=preferences,
        created_at=dish.created_at,
        updated_at=dish.updated_at,
    )


def sync_dish_tags(dish: Dish, tags_input: Optional[List[DishTagInput]], household_id: int, db: Session):
    """Synchronizes dish tags, creating new household tags and validating against inner commas."""
    if tags_input is None:
        return

    # Clear existing associations
    dish.tags.clear()
    db.flush()

    seen_names = set()
    for t_in in tags_input:
        name_clean = t_in.name.strip()
        if not name_clean:
            continue
        if "," in name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag name '{name_clean}' cannot contain commas."
            )
        lower_name = name_clean.lower()
        if lower_name in seen_names:
            continue
        seen_names.add(lower_name)

        tag = db.query(Tag).filter(
            Tag.household_id == household_id,
            Tag.name.ilike(name_clean)
        ).first()

        if not tag:
            tag = Tag(
                household_id=household_id,
                name=name_clean,
                color=t_in.color or "#16a34a"
            )
            db.add(tag)
            db.flush()
        elif t_in.color and t_in.color != tag.color:
            tag.color = t_in.color
            db.flush()

        dish.tags.append(DishTag(dish_id=dish.id, tag_id=tag.id))


@router.get("", response_model=List[DishResponse])
def list_dishes(
    status_id: Optional[int] = Query(None, description="Filter by dish status"),
    course_id: Optional[int] = Query(None, description="Filter by course type"),
    tag_id: Optional[List[int]] = Query(None, description="Filter by tag IDs (AND logic)"),
    search: Optional[str] = Query(None, description="Search in title, notes, or tags"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List dishes with multi-course, tag (AND logic), and status filtering."""
    query = db.query(Dish).filter(Dish.household_id == current_household.id)

    if status_id:
        query = query.filter(Dish.status_id == status_id)

    if course_id:
        query = query.join(Dish.courses).filter(DishCourse.course_type_id == course_id)

    if tag_id:
        for tid in tag_id:
            query = query.filter(Dish.tags.any(DishTag.tag_id == tid))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Dish.title.ilike(term),
                Dish.notes.ilike(term),
                Dish.description.ilike(term),
                Dish.tags.any(DishTag.tag.has(Tag.name.ilike(term)))
            )
        )

    dishes = query.order_by(Dish.title.asc()).all()
    members = db.query(Member).filter(Member.household_id == current_household.id).all()

    return [build_dish_response(d, members) for d in dishes]


@router.post("", response_model=DishResponse, status_code=status.HTTP_201_CREATED)
def create_dish(
    req: DishCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Create a new dish with courses, tags, and recipe source."""
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

    # Synchronize tags
    if req.tags:
        sync_dish_tags(dish, req.tags, current_household.id, db)

    db.commit()
    db.refresh(dish)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_dish_response(dish, members)


@router.get("/export")
def export_dishes(
    format: str = Query("xlsx", pattern="^(xlsx|csv|json)$", description="Export format (xlsx, csv, or json)"),
    status_id: Optional[int] = Query(None, description="Filter by dish status"),
    course_id: Optional[int] = Query(None, description="Filter by course type"),
    tag_id: Optional[List[int]] = Query(None, description="Filter by tag IDs (AND logic)"),
    search: Optional[str] = Query(None, description="Search in title, notes, or tags"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Exports filtered dishes to Excel (.xlsx), CSV (.csv), or JSON (.json)."""
    query = db.query(Dish).filter(Dish.household_id == current_household.id)

    if status_id:
        query = query.filter(Dish.status_id == status_id)
    if course_id:
        query = query.join(Dish.courses).filter(DishCourse.course_type_id == course_id)
    if tag_id:
        for tid in tag_id:
            query = query.filter(Dish.tags.any(DishTag.tag_id == tid))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Dish.title.ilike(term),
                Dish.notes.ilike(term),
                Dish.description.ilike(term),
                Dish.tags.any(DishTag.tag.has(Tag.name.ilike(term)))
            )
        )

    dishes = query.order_by(Dish.title.asc()).all()
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    fmt = format.lower()
    if fmt == "xlsx":
        content = export_dishes_to_xlsx(dishes)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"piatti_{today_str}.xlsx"
    elif fmt == "json":
        content = export_dishes_to_json(dishes)
        media_type = "application/json; charset=utf-8"
        filename = f"piatti_{today_str}.json"
    else:
        content = export_dishes_to_csv(dishes)
        media_type = "text/csv; charset=utf-8"
        filename = f"piatti_{today_str}.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/import-template")
def download_import_template(
    format: str = Query("xlsx", pattern="^(xlsx|csv|json)$", description="Template format (xlsx, csv, or json)"),
    current_household: Household = Depends(get_current_household),
):
    """Downloads an import template with sample rows and valid English headers."""
    content, media_type, filename = generate_import_template(format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/import", response_model=DishImportResult)
async def import_dishes(
    file: UploadFile = File(...),
    mode: str = Form("skip", description="'skip' to ignore existing dishes, 'update' to overwrite them"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Imports dishes from an uploaded Excel (.xlsx) or CSV (.csv) file."""
    if mode not in ("skip", "update"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Modalità di import non valida. Utilizzare 'skip' o 'update'."
        )

    file_bytes = await file.read()
    filename = file.filename or "import.xlsx"

    result = import_dishes_from_bytes(
        db=db,
        household_id=current_household.id,
        file_bytes=file_bytes,
        filename=filename,
        mode=mode
    )
    return result


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

    if req.tags is not None:
        sync_dish_tags(dish, req.tags, current_household.id, db)

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


@router.get("/{dish_id}/notes", response_model=List[SlotDishNoteResponse])
def get_dish_notes(
    dish_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Retrieve historical meal notes for this dish across all planned/consumed meals."""
    dish = db.query(Dish).filter(Dish.id == dish_id, Dish.household_id == current_household.id).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found.")

    notes_query = (
        db.query(MealSlotDishNote, MealSlot.date, MealSlot)
        .join(MealSlotDish, MealSlotDishNote.meal_slot_dish_id == MealSlotDish.id)
        .join(MealSlot, MealSlotDish.meal_slot_id == MealSlot.id)
        .filter(MealSlotDish.dish_id == dish_id, MealSlot.household_id == current_household.id)
        .order_by(MealSlot.date.desc(), MealSlotDishNote.created_at.desc())
        .all()
    )

    results = []
    for note_obj, slot_date, slot in notes_query:
        results.append(
            SlotDishNoteResponse(
                id=note_obj.id,
                meal_slot_dish_id=note_obj.meal_slot_dish_id,
                meal_date=slot_date,
                meal_type_name=slot.meal_type.name,
                note=note_obj.note,
                created_at=note_obj.created_at,
            )
        )
    return results
