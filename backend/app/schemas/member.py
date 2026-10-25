from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class MemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Member display name")
    avatar_color: Optional[str] = Field(default="#3B82F6", max_length=20, description="Badge/avatar color hex")
    is_child: bool = Field(default=False, description="True if child diner")

    model_config = ConfigDict(extra="forbid")


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_color: Optional[str] = Field(None, max_length=20)
    is_child: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


class MemberResponse(BaseModel):
    id: int
    household_id: int
    name: str
    avatar_color: Optional[str]
    is_child: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
