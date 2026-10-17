from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from core.database import get_db

from features.rules import service
from features.rules.schema import RuleResponse, RuleUpdate

router = APIRouter()

@router.get("", response_model=RuleResponse)
def read_rules(db: Session = Depends(get_db)):
    rule = service.get_active(db)
    if rule is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "rules_not_found", "message": "No active rules configured"},
        )
    return rule

@router.put("", response_model=RuleResponse)
def update_rules(data: RuleUpdate, db: Session = Depends(get_db)):
    return service.save(db, data)