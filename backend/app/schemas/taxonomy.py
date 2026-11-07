from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MealTypeResponse(BaseModel):
    id: int
    code: str
    name: str
    default_sort_order: int
    is_default_active: bool

    model_config = ConfigDict(from_attributes=True)


class DishStatusLookupResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class DishStatusResponse(BaseModel):
    id: int
    household_id: int
    status_lookup_id: int
    code: str
    name: str
    custom_label: Optional[str]
    color: str
    is_default: bool = False
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class DishStatusUpdate(BaseModel):
    custom_label: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


class CourseTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    sort_order: Optional[int] = Field(default=0)

    model_config = ConfigDict(extra="forbid")


class CourseTypeResponse(BaseModel):
    id: int
    name: str
    sort_order: int
    is_active: bool
    is_custom: bool

    model_config = ConfigDict(from_attributes=True)


class SourceTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    icon: Optional[str] = Field(default="book", max_length=50)

    model_config = ConfigDict(extra="forbid")


class SourceTypeResponse(BaseModel):
    id: int
    name: str
    icon: Optional[str]
    is_active: bool
    is_custom: bool

    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field("#16a34a", max_length=20)

    model_config = ConfigDict(extra="forbid")

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


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=20)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if "," in clean:
                raise ValueError("Tag name cannot contain commas")
            if not clean:
                raise ValueError("Tag name cannot be empty")
            return clean
        return None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            clean = v.strip()
            if not clean.startswith("#") or len(clean) not in (4, 7):
                raise ValueError("Tag color must be a valid hex color (e.g. #16a34a or #fff)")
            return clean
        return None


class TagResponse(BaseModel):
    id: int
    household_id: int
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)

