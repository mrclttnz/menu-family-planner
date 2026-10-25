from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class HouseholdRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Household family name")
    email: EmailStr = Field(..., description="Household contact email")
    password: str = Field(..., min_length=8, max_length=100, description="Account password")

    model_config = ConfigDict(extra="forbid")


class HouseholdLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Household email")
    password: str = Field(..., description="Account password")

    model_config = ConfigDict(extra="forbid")


class HouseholdResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    household: HouseholdResponse
