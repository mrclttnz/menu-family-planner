from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Dish(Base):
    __tablename__ = "dishes"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    status_id = Column(Integer, ForeignKey("dish_statuses.id", ondelete="RESTRICT"), nullable=False, index=True)
    source_type_id = Column(Integer, ForeignKey("source_types.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    source_reference = Column(String(255), nullable=True)
    source_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    household = relationship("Household", back_populates="dishes")
    status = relationship("DishStatus", back_populates="dishes")
    source_type = relationship("SourceType", back_populates="dishes")
    courses = relationship("DishCourse", back_populates="dish", cascade="all, delete-orphan")
    preferences = relationship("DishMemberPreference", back_populates="dish", cascade="all, delete-orphan")
    meal_assignments = relationship("MealSlotDish", back_populates="dish", cascade="all, delete-orphan")


class DishCourse(Base):
    __tablename__ = "dish_courses"

    dish_id = Column(Integer, ForeignKey("dishes.id", ondelete="CASCADE"), primary_key=True)
    course_type_id = Column(Integer, ForeignKey("course_types.id", ondelete="CASCADE"), primary_key=True)

    # Relationships
    dish = relationship("Dish", back_populates="courses")
    course_type = relationship("CourseType", back_populates="dish_courses")


class DishMemberPreference(Base):
    __tablename__ = "dish_member_preferences"

    dish_id = Column(Integer, ForeignKey("dishes.id", ondelete="CASCADE"), primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True)
    rating = Column(String(20), nullable=False, default="neutral")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    dish = relationship("Dish", back_populates="preferences")
    member = relationship("Member", back_populates="preferences")

    __table_args__ = (
        CheckConstraint("rating IN ('favorite', 'neutral', 'dislike')", name="check_valid_preference_rating"),
    )
