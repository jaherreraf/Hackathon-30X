from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from features.invoices import service
from features.invoices.schema import (
    InvoiceData,
    InvoiceDetailOut,
    InvoiceListItem,
)
from features.decisions.schema import DecisionData

router = APIRouter()


@router.get("", response_model=list[InvoiceListItem])
def list_invoices(
    db: Session = Depends(get_db),
):
    invoices = service.list_all(db)
    return [
        InvoiceListItem(
            id=inv.id,
            number=inv.number,
            beneficiary=inv.beneficiary_text,
            amount_usd=inv.amount_usd,
            decision=inv.decision.decision if inv.decision else "escalate",
            reason_summary=(
                inv.decision.reasons[0]
                if inv.decision and inv.decision.reasons
                else None
            ),
            status=inv.status,
            created_at=inv.created_at,
        )
        for inv in invoices
    ]


@router.get("/{invoice_id}", response_model=InvoiceDetailOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):
    invoice = service.get_by_id(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="invoice_not_found")
    if invoice.decision is None:
        raise HTTPException(status_code=500, detail="decision_missing")
    return InvoiceDetailOut(
        id=invoice.id,
        status=invoice.status,
        invoice=InvoiceData.model_validate(invoice),
        decision=DecisionData.model_validate(invoice.decision),
    )
