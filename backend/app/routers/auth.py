from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_household
from app.core.database import get_db
from app.core.rate_limit import rate_limit_login, rate_limit_register
from app.core.security import _DUMMY_HASH, create_access_token, hash_password, verify_password
from app.models.household import Household
from app.schemas.auth import HouseholdLoginRequest, HouseholdRegisterRequest, HouseholdResponse, TokenResponse
from app.services.seed_defaults import seed_household_statuses

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(rate_limit_register)])
def register_household(req: HouseholdRegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    existing = db.query(Household).filter(Household.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A household with this email address is already registered."
        )

    # Hash password & create household
    pwd_hash = hash_password(req.password)
    household = Household(
        name=req.name.strip(),
        email=req.email.lower().strip(),
        password_hash=pwd_hash
    )
    db.add(household)
    db.commit()
    db.refresh(household)

    # Seed default statuses for this new household
    seed_household_statuses(db, household.id)

    # Generate JWT
    token = create_access_token(subject=household.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        household=HouseholdResponse.model_validate(household)
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_login)])
def login_household(req: HouseholdLoginRequest, db: Session = Depends(get_db)):
    household = db.query(Household).filter(Household.email == req.email.lower().strip()).first()
    # Always run one bcrypt verification, even for unknown emails (timing equalization).
    password_ok = verify_password(req.password, household.password_hash if household else _DUMMY_HASH)
    if not household or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=household.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        household=HouseholdResponse.model_validate(household)
    )


@router.get("/me", response_model=HouseholdResponse)
def get_current_household_profile(current_household: Household = Depends(get_current_household)):
    return HouseholdResponse.model_validate(current_household)
