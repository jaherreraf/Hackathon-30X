from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON, Index, text, UniqueConstraint 
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

class Rule(Base):
    __tablename__ = "rules"
    __table_args__ = (
        Index("uq_single_active_rule", "active", unique=True,
              sqlite_where=text("active = 1")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(120))
    period: Mapped[str] = mapped_column(String(7))                  # "2026-10"

    per_payment_limit: Mapped[float] = mapped_column(Float)
    human_approval_threshold: Mapped[float] = mapped_column(Float)
    period_budget: Mapped[float] = mapped_column(Float)

    allowed_currencies: Mapped[list] = mapped_column(JSON, default=list)
    amount_tolerance: Mapped[float] = mapped_column(Float, default=0.0)
    duplicate_window_days: Mapped[int] = mapped_column(default=30)
    min_confidence: Mapped[float] = mapped_column(Float, default=0.7)

    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    exchange_rates: Mapped[list["ExchangeRate"]] = relationship(
        back_populates="rule", cascade="all, delete-orphan"
    )

class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("rule_id", "currency", name="uq_rule_currency"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rules.id"))
    currency: Mapped[str] = mapped_column(String(3))
    rate_to_usd: Mapped[float] = mapped_column(Float)

    rule: Mapped["Rule"] = relationship(back_populates="exchange_rates")