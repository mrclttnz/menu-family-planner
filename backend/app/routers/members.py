from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.household import Household, Member
from app.schemas.member import MemberCreate, MemberUpdate, MemberResponse
from app.api.deps import get_current_household

router = APIRouter(prefix="/members", tags=["Family Members"])


@router.get("", response_model=List[MemberResponse])
def list_members(
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """List all family members in the authenticated household."""
    members = db.query(Member).filter(Member.household_id == current_household.id).order_by(Member.name.asc()).all()
    return members


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    req: MemberCreate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Add a new family member to the household."""
    # Check duplicate name within this household
    name_clean = req.name.strip()
    existing = db.query(Member).filter(
        Member.household_id == current_household.id,
        Member.name.ilike(name_clean)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A member named '{name_clean}' already exists in your household."
        )

    member = Member(
        household_id=current_household.id,
        name=name_clean,
        avatar_color=req.avatar_color,
        is_child=req.is_child
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Get member details with strict tenant boundary check."""
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.household_id == current_household.id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
    return member


@router.put("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: int,
    req: MemberUpdate,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Update member profile with strict tenant boundary check."""
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.household_id == current_household.id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    if req.name is not None:
        name_clean = req.name.strip()
        existing = db.query(Member).filter(
            Member.household_id == current_household.id,
            Member.name.ilike(name_clean),
            Member.id != member_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another member named '{name_clean}' already exists."
            )
        member.name = name_clean

    if req.avatar_color is not None:
        member.avatar_color = req.avatar_color
    if req.is_child is not None:
        member.is_child = req.is_child

    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(
    member_id: int,
    current_household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """Remove a family member from the household."""
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.household_id == current_household.id
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    db.delete(member)
    db.commit()
    return None
