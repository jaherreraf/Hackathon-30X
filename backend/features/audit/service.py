from sqlalchemy.orm import Session

from features.audit.model import AuditLog

def log_event(
    db: Session,
    event: str,
    entity: str,
    entity_id: int,
    detail: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        event=event,
        entity=entity,
        entity_id=entity_id,
        detail=detail or {},
    )
    db.add(entry)
    return entry

def list_entries(
    db: Session,
    event: str | None = None,
    entity: str | None = None,
    entity_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    query = db.query(AuditLog)
    if event:
        query = query.filter(AuditLog.event == event)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if entity_id is not None:
        query = query.filter(AuditLog.entity_id == entity_id)
    return (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )