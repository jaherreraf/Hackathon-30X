from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from features.decisions import service
from features.decisions.schema import ResolveRequest, ResolveResponse

router = APIRouter()


@router.post("/{decision_id}/resolve", response_model=ResolveResponse)
def resolve_decision(decision_id: int, data: ResolveRequest, db: Session = Depends(get_db)):
    try:
        decision, status = service.resolve(db, decision_id, data)
    except service.DecisionNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"error": "decision_not_found", "message": "Decision not found"},
        )
    except service.DecisionNotResolvableError:
        raise HTTPException(
            status_code=409,
            detail={"error": "not_resolvable",
                    "message": "Only escalated decisions pending review can be resolved"},
        )
    return ResolveResponse(
        decision_id=decision.id,
        invoice_id=decision.invoice_id,
        status=status,
        action=data.action,
        user=data.user,
        comment=data.comment,
    )
