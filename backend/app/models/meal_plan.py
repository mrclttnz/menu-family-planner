from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Date, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class MealSlot(Base):
    __tablename__ = "meal_slots"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    meal_type_id = Column(Integer, ForeignKey("meal_types.id", ondelete="RESTRICT"), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    household = relationship("Household", back_populates="meal_slots")
    meal_type = relationship("MealType", back_populates="meal_slots")
    dishes = relationship("MealSlotDish", back_populates="meal_slot", cascade="all, delete-orphan", order_by="MealSlotDish.sort_order")
    attendances = relationship("Attendance", back_populates="meal_slot", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("household_id", "date", "meal_type_id", name="uq_household_date_meal_type"),
    )


class MealSlotDish(Base):
    __tablename__ = "meal_slot_dishes"

    id = Column(Integer, primary_key=True, index=True)
    meal_slot_id = Column(Integer, ForeignKey("meal_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    dish_id = Column(Integer, ForeignKey("dishes.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    notes = Column(String(255), nullable=True)

    # Relationships
    meal_slot = relationship("MealSlot", back_populates="dishes")
    dish = relationship("Dish", back_populates="meal_assignments")
    assigned_members = relationship("MealSlotDishMember", back_populates="slot_dish", cascade="all, delete-orphan")
    notes_list = relationship("MealSlotDishNote", back_populates="slot_dish", cascade="all, delete-orphan", order_by="MealSlotDishNote.created_at.asc()")
    ratings = relationship("MealSlotDishRating", back_populates="slot_dish", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("meal_slot_id", "dish_id", name="uq_meal_slot_dish"),
    )


class MealSlotDishMember(Base):
    """Specific diner assignment for a dish in a slot (supporting alternative dishes)."""
    __tablename__ = "meal_slot_dish_members"

    meal_slot_dish_id = Column(Integer, ForeignKey("meal_slot_dishes.id", ondelete="CASCADE"), primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True)

    # Relationships
    slot_dish = relationship("MealSlotDish", back_populates="assigned_members")
    member = relationship("Member")


class MealSlotDishNote(Base):
    """Multiple timestamped notes/reviews for each time a dish is consumed."""
    __tablename__ = "meal_slot_dish_notes"

    id = Column(Integer, primary_key=True, index=True)
    meal_slot_dish_id = Column(Integer, ForeignKey("meal_slot_dishes.id", ondelete="CASCADE"), nullable=False, index=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    slot_dish = relationship("MealSlotDish", back_populates="notes_list")


class MealSlotDishRating(Base):
    """Per-member rating for a specific meal consumption of a dish (J002)."""
    __tablename__ = "meal_slot_dish_ratings"

    id = Column(Integer, primary_key=True, index=True)
    meal_slot_dish_id = Column(Integer, ForeignKey("meal_slot_dishes.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(String(20), nullable=False)  # 'thumbs_up', 'neutral', 'thumbs_down'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    slot_dish = relationship("MealSlotDish", back_populates="ratings")
    member = relationship("Member")

    __table_args__ = (
        UniqueConstraint("meal_slot_dish_id", "member_id", name="uq_slot_dish_member_rating"),
    )


class Attendance(Base):
    """
    Tracks diner presence per planned meal slot.
    Operates on an Exception-Based Model: household members are considered
    PRESENT by default unless an explicit record with is_attending = False exists.
    """
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_slot_id = Column(Integer, ForeignKey("meal_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    is_attending = Column(Boolean, nullable=False, default=False)  # False records the absence exception
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    household = relationship("Household", back_populates="attendances")
    meal_slot = relationship("MealSlot", back_populates="attendances")
    member = relationship("Member", back_populates="attendances")

    __table_args__ = (
        UniqueConstraint("meal_slot_id", "member_id", name="uq_meal_slot_member_attendance"),
    )
