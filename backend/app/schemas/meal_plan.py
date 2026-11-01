import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.taxonomy import MealTypeResponse


class SlotDishNoteCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class SlotDishNoteResponse(BaseModel):
    id: int
    meal_slot_dish_id: int
    meal_date: datetime.date
    meal_type_name: str
    note: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class SlotDishRatingCreate(BaseModel):
    member_id: int
    rating: str = Field(..., pattern="^(thumbs_up|neutral|thumbs_down)$")

    model_config = ConfigDict(extra="forbid")


class SlotDishRatingResponse(BaseModel):
    id: int
    meal_slot_dish_id: int
    member_id: int
    member_name: str
    avatar_color: Optional[str] = None
    rating: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class SlotDishCreate(BaseModel):
    dish_id: int = Field(..., description="ID of the dish to schedule")
    sort_order: Optional[int] = Field(0, description="Serving order (1=Primo, 2=Secondo, etc.)")
    notes: Optional[str] = Field(None, max_length=255)
    assigned_member_ids: Optional[List[int]] = Field(None, description="Specific diners for alternative dishes; empty means all attending")

    model_config = ConfigDict(extra="forbid")


class SlotDishResponse(BaseModel):
    id: int
    dish_id: int
    dish_title: str
    sort_order: int
    notes: Optional[str]
    compatibility: Dict[str, Any]
    assigned_member_ids: List[int] = []
    notes_list: List[SlotDishNoteResponse] = []
    ratings: List[SlotDishRatingResponse] = []

    model_config = ConfigDict(from_attributes=True)


class MealSlotCreate(BaseModel):
    date: datetime.date = Field(..., description="Date for scheduled meal")
    meal_type_id: int = Field(..., description="Meal type FK (e.g. lunch, dinner, brunch)")
    notes: Optional[str] = Field(None, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class MealSlotNotesUpdate(BaseModel):
    notes: Optional[str] = Field(None, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class MealSlotResponse(BaseModel):
    id: int
    household_id: int
    date: datetime.date
    meal_type: MealTypeResponse
    sort_order: int
    notes: Optional[str]
    dishes: List[SlotDishResponse]
    attendee_count: int
    absent_member_ids: List[int]

    model_config = ConfigDict(from_attributes=True)


class AttendanceToggle(BaseModel):
    is_attending: bool = Field(..., description="True for attending, False for exception/absence")

    model_config = ConfigDict(extra="forbid")


class MemberAttendanceSummary(BaseModel):
    member_id: int
    member_name: str
    avatar_color: Optional[str]
    is_attending: bool


class MealSlotAttendanceResponse(BaseModel):
    meal_slot_id: int
    date: datetime.date
    meal_type_id: int
    meal_type_name: str
    attendee_count: int
    total_household_members: int
    members: List[MemberAttendanceSummary]
