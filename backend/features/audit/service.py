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