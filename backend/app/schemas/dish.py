from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict


class DishSourceInfo(BaseModel):
    source_type_id: Optional[int] = None
    source_type_name: Optional[str] = None
    source_type_icon: Optional[str] = None
    source_reference: Optional[str] = None
    source_url: Optional[str] = None


class CourseSummary(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class StatusSummary(BaseModel):
    id: int
    code: str
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)


class MemberPreferenceSummary(BaseModel):
    member_id: int
    member_name: str
    avatar_color: Optional[str]
    rating: str  # 'favorite' | 'neutral' | 'dislike'


class TagSummary(BaseModel):
    id: int
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)


class DishTagInput(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field("#16a34a", max_length=20)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if "," in clean:
            raise ValueError("Tag name cannot contain commas")
        if not clean:
            raise ValueError("Tag name cannot be empty")
        return clean

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            clean = v.strip()
            if not clean.startswith("#") or len(clean) not in (4, 7):
                raise ValueError("Tag color must be a valid hex color (e.g. #16a34a or #fff)")
            return clean
        return "#16a34a"


class DishCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Dish title")
    description: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=2000)
    status_id: int = Field(..., description="Foreign key to dish_statuses")
    course_ids: List[int] = Field(..., min_length=1, description="One or more course types (Primo, Secondo, etc.)")
    source_type_id: Optional[int] = None
    source_reference: Optional[str] = Field(None, max_length=255)
    source_url: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[DishTagInput]] = Field(default_factory=list, description="Associated tags")

    model_config = ConfigDict(extra="forbid")

    @field_validator("source_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v_clean = v.strip()
            if not (v_clean.startswith("http://") or v_clean.startswith("https://")):
                raise ValueError("source_url must start with http:// or https://")
            return v_clean
        return None


class DishUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    notes: Optional[str] = None
    status_id: Optional[int] = None
    course_ids: Optional[List[int]] = None
    source_type_id: Optional[int] = None
    source_reference: Optional[str] = None
    source_url: Optional[str] = None
    tags: Optional[List[DishTagInput]] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("source_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v_clean = v.strip()
            if not (v_clean.startswith("http://") or v_clean.startswith("https://")):
                raise ValueError("source_url must start with http:// or https://")
            return v_clean
        return None


class DishResponse(BaseModel):
    id: int
    household_id: int
    title: str
    description: Optional[str]
    notes: Optional[str]
    status: StatusSummary
    courses: List[CourseSummary]
    tags: List[TagSummary] = Field(default_factory=list)
    source: DishSourceInfo
    preferences: List[MemberPreferenceSummary]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DishImportRowError(BaseModel):
    row: int
    dish_title: Optional[str] = None
    error: str


class DishImportResult(BaseModel):
    total_rows: int
    created: int
    updated: int
    skipped: int
    errors: List[DishImportRowError]
