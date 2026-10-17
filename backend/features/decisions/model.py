from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), unique=True)

    decision: Mapped[str] = mapped_column(String(10))
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    applied_rules: Mapped[list] = mapped_column(JSON, default=list)
    evaluation: Mapped[list] = mapped_column(JSON, default=list)
    human_explanation: Mapped[str] = mapped_column(Text, default="")
    rules_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    engine_version: Mapped[str] = mapped_column(String(20), default="1.0.0")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="decision")
    approvals: Mapped[list["Approval"]] = relationship(back_populates="decision")
