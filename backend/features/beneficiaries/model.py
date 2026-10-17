from sqlalchemy import String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base

from sqlalchemy import CheckConstraint


class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    __table_args__ = (
        CheckConstraint("period_limit >= agreed_amount", name="ck_limit_covers_agreed"),
        CheckConstraint("agreed_amount >= 0", name="ck_agreed_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    agreed_amount: Mapped[float] = mapped_column(Float)
    period_limit: Mapped[float] = mapped_column(Float)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
