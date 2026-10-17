from datetime import datetime, date
from typing import TYPE_CHECKING
from sqlalchemy import String, Float, Date, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from features.decisions.model import Decision


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    beneficiary_text: Mapped[str | None] = mapped_column(String(160), nullable=True)
    beneficiary_id: Mapped[int | None] = mapped_column(ForeignKey("beneficiaries.id"), nullable=True)

    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    amount_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    source: Mapped[str] = mapped_column(String(10))
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_json: Mapped[dict] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)

    status: Mapped[str] = mapped_column(String(20), default="escalated")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    decision: Mapped["Decision | None"] = relationship(
        back_populates="invoice", uselist=False
    )
