from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Household(Base):
    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    members = relationship("Member", back_populates="household", cascade="all, delete-orphan")
    dishes = relationship("Dish", back_populates="household", cascade="all, delete-orphan")
    dish_statuses = relationship("DishStatus", back_populates="household", cascade="all, delete-orphan")
    meal_slots = relationship("MealSlot", back_populates="household", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="household", cascade="all, delete-orphan")


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    avatar_color = Column(String(20), nullable=True, default="#3B82F6")
    is_child = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    household = relationship("Household", back_populates="members")
    preferences = relationship("DishMemberPreference", back_populates="member", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="member", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("household_id", "name", name="uq_household_member_name"),
    )
