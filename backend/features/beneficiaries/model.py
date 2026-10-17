from sqlalchemy import String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_name: Mapped[str] = mapped_column(String(160), index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    agreed_amount: Mapped[float] = mapped_column(Float)
    period_limit: Mapped[float] = mapped_column(Float)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
