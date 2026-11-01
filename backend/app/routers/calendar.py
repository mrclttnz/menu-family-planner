from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.household import Household, Member
from app.models.taxonomy import MealType
from app.models.dish import Dish
from app.models.meal_plan import (
    MealSlot,
    MealSlotDish,
    MealSlotDishMember,
    MealSlotDishNote,
    MealSlotDishRating,
    Attendance,
)
from app.schemas.meal_plan import (
    MealSlotCreate,
    MealSlotNotesUpdate,
    MealSlotResponse,
    SlotDishCreate,
    SlotDishResponse,
    SlotDishNoteCreate,
    SlotDishNoteResponse,
    SlotDishRatingCreate,
    SlotDishRatingResponse,
)
from app.schemas.taxonomy import MealTypeResponse
from app.services.compatibility import evaluate_dish_compatibility
from app.api.deps import get_current_household

router = APIRouter(prefix="/calendar", tags=["Meal Plan & Calendar"])


def ensure_default_slots_for_dates(
    household_id: int,
    start_date: date,
    end_date: date,
    db: Session
) -> None:
    """Instantiates default meal slots (e.g. Pranzo and Cena) if a date has no slots yet."""
    default_meal_types = db.query(MealType).filter(MealType.is_default_active.is_(True)).order_by(MealType.default_sort_order.asc()).all()
    if not default_meal_types:
        return

    curr = start_date
    created_any = False
    while curr <= end_date:
        existing_count = db.query(MealSlot).filter(
            MealSlot.household_id == household_id,
            MealSlot.date == curr
        ).count()
        if existing_count == 0:
            for mt in default_meal_types:
                slot = MealSlot(
                    household_id=household_id,
                    date=curr,
                    meal_type_id=mt.id,
                    sort_order=mt.default_sort_order,
                )
                db.add(slot)
            created_any = True
        curr += timedelta(days=1)

    if created_any:
        db.commit()


def build_slot_response(
    slot: MealSlot,
    all_members: List[Member],
    db: Session
) -> MealSlotResponse:
    # 1. Absences
    absent_records = db.query(Attendance).filter(
        Attendance.meal_slot_id == slot.id,
        Attendance.is_attending.is_(False)
    ).all()
    absent_ids = [r.member_id for r in absent_records]
    attendee_count = len(all_members) - len(absent_ids)

    # 2. Dishes with compatibility, assigned members, notes, and ratings
    dishes_out = []
    for d_assign in slot.dishes:
        assigned_ids = [m.member_id for m in d_assign.assigned_members]
        comp = evaluate_dish_compatibility(slot, d_assign.dish, all_members, db, assigned_member_ids=assigned_ids)
        notes_list = [
            SlotDishNoteResponse(
                id=n.id,
                meal_slot_dish_id=n.meal_slot_dish_id,
                meal_date=slot.date,
                meal_type_name=slot.meal_type.name,
                note=n.note,
                created_at=n.created_at,
            )
            for n in d_assign.notes_list
        ]
        ratings_list = [
            SlotDishRatingResponse(
                id=r.id,
                meal_slot_dish_id=r.meal_slot_dish_id,
                member_id=r.member_id,
                member_name=r.member.name if r.member else "Membro",
                avatar_color=r.member.avatar_color if r.member else None,
                rating=r.rating,
                created_at=r.created_at,
            )
            for r in d_assign.ratings
        ]
        dishes_out.append(
            SlotDishResponse(
                id=d_assign.id,
                dish_id=d_assign.dish.id,
                dish_title=d_assign.dish.title,
                sort_order=d_assign.sort_order,
                notes=d_assign.notes,
                compatibility=comp,
                assigned_member_ids=assigned_ids,
                notes_list=notes_list,
                ratings=ratings_list,
            )
        )

    return MealSlotResponse(
        id=slot.id,
        household_id=slot.household_id,
        date=slot.date,
        meal_type=MealTypeResponse.model_validate(slot.meal_type),
        sort_order=slot.sort_order,
        notes=slot.notes,
        dishes=dishes_out,
        attendee_count=max(0, attendee_count),
        absent_member_ids=absent_ids,
    )


@router.get("", response_model=List[MealSlotResponse])
def get_calendar_slots(
    start_date: date = Query(..., description="Start date YYYY-MM-DD"),
    end_date: date = Query(..., description="End date YYYY-MM-DD"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Retrieve scheduled meal slots for a date range with compatibility warnings."""
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be >= start_date")
    if (end_date - start_date).days > 31:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date range maximum is 31 days")

    # Auto-populate defaults if needed
    ensure_default_slots_for_dates(current_household.id, start_date, end_date, db)

    slots = (
        db.query(MealSlot)
        .filter(
            MealSlot.household_id == current_household.id,
            MealSlot.date >= start_date,
            MealSlot.date <= end_date
        )
        .order_by(MealSlot.date.asc(), MealSlot.sort_order.asc())
        .all()
    )
    members = db.query(Member).filter(Member.household_id == current_household.id).all()

    return [build_slot_response(s, members, db) for s in slots]


@router.post("/slots", response_model=MealSlotResponse, status_code=status.HTTP_201_CREATED)
def create_custom_slot(
    req: MealSlotCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Add a meal slot for a day (e.g. add Brunch, Merenda, Colazione)."""
    meal_type = db.query(MealType).filter(MealType.id == req.meal_type_id).first()
    if not meal_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meal_type_id.")

    existing = db.query(MealSlot).filter(
        MealSlot.household_id == current_household.id,
        MealSlot.date == req.date,
        MealSlot.meal_type_id == req.meal_type_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A {meal_type.name} slot already exists for {req.date}."
        )

    slot = MealSlot(
        household_id=current_household.id,
        date=req.date,
        meal_type_id=req.meal_type_id,
        sort_order=meal_type.default_sort_order,
        notes=req.notes.strip() if req.notes else None
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.delete("/slots/by-meal-type", status_code=status.HTTP_204_NO_CONTENT)
def delete_slots_by_meal_type(
    meal_type_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Delete all slots of a given meal type within date range if none have dishes attached (P009)."""
    slots = (
        db.query(MealSlot)
        .filter(
            MealSlot.household_id == current_household.id,
            MealSlot.meal_type_id == meal_type_id,
            MealSlot.date >= start_date,
            MealSlot.date <= end_date,
        )
        .all()
    )
    if not slots:
        return None

    for s in slots:
        if s.dishes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete meal type slots because some slots have dishes assigned."
            )

    for s in slots:
        db.delete(s)
    db.commit()
    return None


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slot(
    slot_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Delete a meal slot entirely (e.g. skip Sunday dinner or delete custom slot)."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    db.delete(slot)
    db.commit()
    return None


@router.patch("/slots/{slot_id}/notes", response_model=MealSlotResponse)
def update_slot_notes(
    slot_id: int,
    req: MealSlotNotesUpdate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Update or clear the general note for a meal slot (P010)."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    slot.notes = req.notes.strip() if req.notes and req.notes.strip() else None
    db.commit()
    db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.post("/slots/{slot_id}/dishes", response_model=MealSlotResponse)
def assign_dish_to_slot(
    slot_id: int,
    req: SlotDishCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Assign a catalog dish to a meal slot, optionally targeted to specific diners (alternative dish)."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    dish = db.query(Dish).filter(
        Dish.id == req.dish_id,
        Dish.household_id == current_household.id
    ).first()
    if not dish:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish not found in catalog.")

    existing_assign = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish.id).first()
    if existing_assign:
        assignment = existing_assign
        existing_assign.sort_order = req.sort_order or 0
        existing_assign.notes = req.notes
    else:
        assignment = MealSlotDish(
            meal_slot_id=slot.id,
            dish_id=dish.id,
            sort_order=req.sort_order or 0,
            notes=req.notes
        )
        db.add(assignment)
        db.flush()

    # Update assigned members (alternative dish diners)
    if req.assigned_member_ids is not None:
        db.query(MealSlotDishMember).filter_by(meal_slot_dish_id=assignment.id).delete()
        for mid in req.assigned_member_ids:
            if any(m.id == mid for m in slot.household.members):
                db.add(MealSlotDishMember(meal_slot_dish_id=assignment.id, member_id=mid))

    db.commit()
    db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.post("/slots/{slot_id}/dishes/{dish_id}/notes", response_model=MealSlotResponse)
def add_note_to_slot_dish(
    slot_id: int,
    dish_id: int,
    req: SlotDishNoteCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Add a timestamped feedback note to a dish consumed in this meal slot."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    assignment = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish is not assigned to this meal slot.")

    new_note = MealSlotDishNote(
        meal_slot_dish_id=assignment.id,
        note=req.note.strip()
    )
    db.add(new_note)
    db.commit()
    db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.delete("/slots/{slot_id}/dishes/{dish_id}/notes/{note_id}", response_model=MealSlotResponse)
def delete_note_from_slot_dish(
    slot_id: int,
    dish_id: int,
    note_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Delete a feedback note from a dish consumed in this meal slot."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    assignment = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish is not assigned to this meal slot.")

    note_obj = db.query(MealSlotDishNote).filter(
        MealSlotDishNote.id == note_id,
        MealSlotDishNote.meal_slot_dish_id == assignment.id
    ).first()
    if note_obj:
        db.delete(note_obj)
        db.commit()
        db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.post("/slots/{slot_id}/dishes/{dish_id}/ratings", response_model=MealSlotResponse)
def set_slot_dish_rating(
    slot_id: int,
    dish_id: int,
    req: SlotDishRatingCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Set or update a diner's rating for a dish in this specific meal slot (J002)."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    assignment = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish is not assigned to this meal slot.")

    member = db.query(Member).filter(Member.id == req.member_id, Member.household_id == current_household.id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    rating_obj = db.query(MealSlotDishRating).filter_by(
        meal_slot_dish_id=assignment.id,
        member_id=req.member_id
    ).first()

    if rating_obj:
        rating_obj.rating = req.rating
    else:
        rating_obj = MealSlotDishRating(
            meal_slot_dish_id=assignment.id,
            member_id=req.member_id,
            rating=req.rating
        )
        db.add(rating_obj)

    db.commit()
    db.refresh(slot)
    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.delete("/slots/{slot_id}/dishes/{dish_id}/ratings/{member_id}", response_model=MealSlotResponse)
def delete_slot_dish_rating(
    slot_id: int,
    dish_id: int,
    member_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Remove a diner's rating for a dish in this specific meal slot (J003 toggle off)."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    assignment = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dish is not assigned to this meal slot.")

    rating_obj = db.query(MealSlotDishRating).filter_by(
        meal_slot_dish_id=assignment.id,
        member_id=member_id
    ).first()
    if rating_obj:
        db.delete(rating_obj)
        db.commit()
        db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)


@router.delete("/slots/{slot_id}/dishes/{dish_id}", response_model=MealSlotResponse)
def remove_dish_from_slot(
    slot_id: int,
    dish_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Remove a dish from a meal slot."""
    slot = db.query(MealSlot).filter(
        MealSlot.id == slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    assignment = db.query(MealSlotDish).filter_by(meal_slot_id=slot.id, dish_id=dish_id).first()
    if assignment:
        db.delete(assignment)
        db.commit()
        db.refresh(slot)

    members = db.query(Member).filter(Member.household_id == current_household.id).all()
    return build_slot_response(slot, members, db)
