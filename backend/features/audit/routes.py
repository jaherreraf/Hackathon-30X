from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from features.audit import service
from features.audit.schema import AuditEntry

router = APIRouter()


@router.get("", response_model=list[AuditEntry])
def list_audit(
    event: str | None = None,
    entity: str | None = None,
    entity_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return service.list_entries(db, event, entity, entity_id, limit, offset)