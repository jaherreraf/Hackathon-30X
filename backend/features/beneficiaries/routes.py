from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from core.database import get_db

from features.beneficiaries import service
from features.beneficiaries.schema import (
    BeneficiaryCreate,
    BeneficiaryResponse,
    BeneficiaryUpdate,
)

router = APIRouter()

@router.get("", response_model=list[BeneficiaryResponse])
def list_beneficiaries(db: Session = Depends(get_db)):
    return service.list_all(db)

@router.post("", response_model=BeneficiaryResponse, status_code=201)
def create_beneficiary(data: BeneficiaryCreate, db: Session = Depends(get_db)):
    try:
        return service.create(db, data)
    except service.BeneficiaryExistsError:
        raise HTTPException(
            status_code=409,
            detail={"error": "beneficiary_exists", "message": "A beneficiary with that name already exists"},
        )

@router.put("/{beneficiary_id}", response_model=BeneficiaryResponse)
def update_beneficiary(beneficiary_id: int, data: BeneficiaryUpdate, db: Session = Depends(get_db)):
    try:
        return service.update(db, beneficiary_id, data)
    except service.BeneficiaryNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"error": "beneficiary_not_found", "message": "Beneficiary not found"},
        )
    except service.BeneficiaryExistsError:
        raise HTTPException(
            status_code=409,
            detail={"error": "beneficiary_exists", "message": "A beneficiary with that name already exists"},
        )