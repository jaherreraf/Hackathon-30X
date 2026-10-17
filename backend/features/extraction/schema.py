from datetime import date
from pydantic import BaseModel


class ExtractedInvoice(BaseModel):
    number: str | None = None
    beneficiary: str | None = None
    amount: float | None = None
    currency: str | None = None
    due_date: date | None = None
    confidence: float = 0.0
    suspicious: bool = False      