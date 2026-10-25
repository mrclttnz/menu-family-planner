from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class PreferenceUpdate(BaseModel):
    rating: Literal["favorite", "neutral", "dislike"] = Field(
        ...,
        description="Rating preference: 'favorite', 'neutral', or 'dislike'"
    )

    model_config = ConfigDict(extra="forbid")


class PreferenceResponse(BaseModel):
    dish_id: int
    member_id: int
    rating: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
