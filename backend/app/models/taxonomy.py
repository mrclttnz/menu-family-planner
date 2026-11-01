from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class DishStatusLookup(Base):
    __tablename__ = "dish_status_lookups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_default = Column(Boolean, nullable=False, default=False)
    is_system = Column(Boolean, nullable=False, default=True)

    # Relationships
    statuses = relationship("DishStatus", back_populates="lookup")


class DishStatus(Base):
    __tablename__ = "dish_statuses"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    status_lookup_id = Column(Integer, ForeignKey("dish_status_lookups.id", ondelete="RESTRICT"), nullable=False)
    custom_label = Column(String(100), nullable=True)
    color = Column(String(20), nullable=False, default="#10B981")
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    household = relationship("Household", back_populates="dish_statuses")
    lookup = relationship("DishStatusLookup", back_populates="statuses")
    dishes = relationship("Dish", back_populates="status")

    __table_args__ = (
        UniqueConstraint("household_id", "status_lookup_id", name="uq_household_status_lookup"),
    )


class MealType(Base):
    __tablename__ = "meal_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    default_sort_order = Column(Integer, nullable=False, default=0)
    is_default_active = Column(Boolean, nullable=False, default=False)

    # Relationships
    meal_slots = relationship("MealSlot", back_populates="meal_type")


class CourseType(Base):
    __tablename__ = "course_types"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(50), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    dish_courses = relationship("DishCourse", back_populates="course_type", cascade="all, delete-orphan")


class SourceType(Base):
    __tablename__ = "source_types"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(50), nullable=True, default="book")
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    dishes = relationship("Dish", back_populates="source_type")
