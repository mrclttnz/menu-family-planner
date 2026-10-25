from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.household import Household, Member
from app.models.meal_plan import MealSlot, Attendance
from app.schemas.meal_plan import (
    AttendanceToggle,
    MealSlotAttendanceResponse,
    MemberAttendanceSummary,
)
from app.routers.calendar import ensure_default_slots_for_dates
from app.api.deps import get_current_household

router = APIRouter(prefix="/attendance", tags=["Meal Attendance"])


def build_slot_attendance_response(
    slot: MealSlot,
    all_members: List[Member],
    db: Session
) -> MealSlotAttendanceResponse:
    # Fetch recorded absences for this slot
    absent_records = db.query(Attendance).filter(
        Attendance.meal_slot_id == slot.id,
        Attendance.is_attending.is_(False)
    ).all()
    absent_ids = {r.member_id for r in absent_records}

    member_summaries = [
        MemberAttendanceSummary(
            member_id=m.id,
            member_name=m.name,
            avatar_color=m.avatar_color,
            is_attending=(m.id not in absent_ids)  # Default: True (Present) unless in absent_ids
        )
        for m in all_members
    ]

    attendee_count = sum(1 for m in member_summaries if m.is_attending)

    return MealSlotAttendanceResponse(
        meal_slot_id=slot.id,
        date=slot.date,
        meal_type_id=slot.meal_type.id,
        meal_type_name=slot.meal_type.name,
        attendee_count=attendee_count,
        total_household_members=len(all_members),
        members=member_summaries,
    )


@router.get("", response_model=List[MealSlotAttendanceResponse])
def get_attendance_matrix(
    start_date: date = Query(..., description="Start date YYYY-MM-DD"),
    end_date: date = Query(..., description="End date YYYY-MM-DD"),
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Returns attendance matrix across all planned meals for date range.
    Operates on Exception-Based Model: everyone is marked Present unless
    an explicit absence is recorded.
    """
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be >= start_date")
    if (end_date - start_date).days > 31:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date range maximum is 31 days")

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
    members = db.query(Member).filter(Member.household_id == current_household.id).order_by(Member.name.asc()).all()

    return [build_slot_attendance_response(s, members, db) for s in slots]


@router.put("/{meal_slot_id}/members/{member_id}", response_model=MealSlotAttendanceResponse)
def toggle_member_attendance(
    meal_slot_id: int,
    member_id: int,
    req: AttendanceToggle,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Toggles a member's presence for a meal slot.
    - Setting is_attending=False records an absence exception.
    - Setting is_attending=True clears the absence exception (restoring default Present).
    """
    # Verify slot belongs to household
    slot = db.query(MealSlot).filter(
        MealSlot.id == meal_slot_id,
        MealSlot.household_id == current_household.id
    ).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal slot not found.")

    # Verify member belongs to household
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.household_id == current_household.id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    existing_att = db.query(Attendance).filter_by(meal_slot_id=slot.id, member_id=member.id).first()

    if req.is_attending is False:
        # Record absence exception
        if existing_att:
            existing_att.is_attending = False
        else:
            new_att = Attendance(
                household_id=current_household.id,
                meal_slot_id=slot.id,
                member_id=member.id,
                is_attending=False
            )
            db.add(new_att)
    else:
        # Present: remove absence record
        if existing_att:
            db.delete(existing_att)

    db.commit()

    all_members = db.query(Member).filter(Member.household_id == current_household.id).order_by(Member.name.asc()).all()
    return build_slot_attendance_response(slot, all_members, db)
