from datetime import datetime, date
from pydantic import BaseModel, ConfigDict

# importás el schema de decisión — NO lo dupliques
from features.decisions.schema import DecisionData


class InvoiceData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    number: str | None = None
    beneficiary_text: str | None = None
    beneficiary_id: int | None = None
    amount: float | None = None
    currency: str | None = None
    amount_usd: float | None = None
    due_date: date | None = None
    source: str
    confidence: float | None = None


class InvoiceDetailOut(BaseModel):
    id: int
    status: str                    # o `status` si querés consistencia
    invoice: InvoiceData
    decision: DecisionData


class InvoiceListItem(BaseModel):
    id: int
    number: str | None = None
    beneficiary: str | None = None
    amount_usd: float | None = None
    decision: str                  # "pay" | "hold" | "escalate"
    reason_summary: str | None = None
    status: str
    created_at: datetime
