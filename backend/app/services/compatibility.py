from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.household import Member
from app.models.dish import Dish
from app.models.meal_plan import MealSlot, Attendance


def evaluate_dish_compatibility(
    meal_slot: MealSlot,
    dish: Dish,
    all_household_members: List[Member],
    db: Session,
    assigned_member_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Evaluates dish compatibility against attending members.
    Attendance is exception-based: members are PRESENT by default unless
    an Attendance record with is_attending == False exists for this slot.
    If assigned_member_ids is provided and non-empty (alternative dish scenario),
    compatibility is evaluated only against those assigned members who are attending.
    """
    # 1. Determine absent members
    absent_records = db.query(Attendance).filter(
        Attendance.meal_slot_id == meal_slot.id,
        Attendance.is_attending.is_(False)
    ).all()
    absent_ids = {r.member_id for r in absent_records}

    # 2. Attending members = all members minus absences
    attending_members = [m for m in all_household_members if m.id not in absent_ids]

    # 3. Filter target diners if this dish is an alternative specifically assigned to subset
    if assigned_member_ids:
        assigned_set = set(assigned_member_ids)
        target_members = [m for m in attending_members if m.id in assigned_set]
    else:
        target_members = attending_members

    # 4. Preference lookup for this dish (defaults to 'neutral' if unstated)
    pref_map = {p.member_id: p.rating for p in dish.preferences}

    disliking = []
    loving = []

    for m in target_members:
        rating = pref_map.get(m.id, "neutral")
        if rating == "dislike":
            disliking.append({"member_id": m.id, "name": m.name})
        elif rating == "favorite":
            loving.append({"member_id": m.id, "name": m.name})

    if disliking:
        disliking_names = ", ".join(d["name"] for d in disliking)
        return {
            "status": "warning",
            "severity": "warning",
            "message": f"Attenzione: a {disliking_names} non piace questo piatto!",
            "disliking_members": disliking,
            "loving_members": loving,
            "attendee_count": len(target_members),
            "is_conflict": True,
        }
    elif len(loving) == len(target_members) and target_members:
        return {
            "status": "hit",
            "severity": "success",
            "message": "⭐ Piatto amato da tutti i commensali a cui è destinato!",
            "disliking_members": [],
            "loving_members": loving,
            "attendee_count": len(target_members),
            "is_conflict": False,
        }
    else:
        return {
            "status": "ok",
            "severity": "info",
            "message": "Piatto gradito a tavola.",
            "disliking_members": [],
            "loving_members": loving,
            "attendee_count": len(target_members),
            "is_conflict": False,
        }
