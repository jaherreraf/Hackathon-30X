from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from features.invoices.model import Invoice


def get_by_id(db: Session, invoice_id: int) -> Invoice | None:
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.decision))
        .where(Invoice.id == invoice_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def list_all(db: Session, status: str | None = None) -> list[Invoice]:
    stmt = select(Invoice).options(selectinload(Invoice.decision))
    if status is not None:
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.created_at.desc())
    return list(db.execute(stmt).scalars().all())
