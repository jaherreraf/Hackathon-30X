from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.utils import normalize_name
from features.beneficiaries.model import Beneficiary
from features.decisions.engine import (
    HOLD, PAY, BeneficiaryInfo, InvoiceInput, PriorRecord, RulesConfig, decide,
)
from features.invoices.model import Invoice
from features.invoices.service import _period_bounds
from features.rules.schema import RuleUpdate
from features.simulator.schema import SimulationItem, SimulationResponse


def _config(data: RuleUpdate) -> RulesConfig:
    return RulesConfig(
        per_payment_limit=data.per_payment_limit,
        human_approval_threshold=data.human_approval_threshold,
        period_budget=data.period_budget,
        allowed_currencies=tuple(data.allowed_currencies),
        exchange_rates={r.currency: r.rate_to_usd for r in data.exchange_rates},
        amount_tolerance=data.amount_tolerance,
        duplicate_window_days=data.duplicate_window_days,
        min_confidence=data.min_confidence,
    )


def _simulated_status(decision: str, actual_status: str) -> str:
    if decision == PAY:
        return "paid"
    if decision == HOLD:
        return "held"
    if actual_status in ("approved_human", "rejected_human"):
        return actual_status
    return "escalated"


def simulate(db: Session, data: RuleUpdate) -> SimulationResponse:
    config = _config(data)
    start, end = _period_bounds(data.period)

    invoices = db.execute(
        select(Invoice)
        .options(selectinload(Invoice.decision))
        .where(Invoice.created_at >= start, Invoice.created_at < end)
        .order_by(Invoice.created_at, Invoice.id)
    ).scalars().all()
    beneficiaries = {b.id: b for b in db.query(Beneficiary).all()}

    history: list[PriorRecord] = []
    items: list[SimulationItem] = []

    for inv in invoices:
        b = beneficiaries.get(inv.beneficiary_id) if inv.beneficiary_id else None
        key = normalize_name(inv.beneficiary_text) if inv.beneficiary_text else None
        invoice_input = InvoiceInput(
            number=inv.number,
            beneficiary_text=inv.beneficiary_text,
            beneficiary_key=key,
            beneficiary=BeneficiaryInfo(b.normalized_name, b.display_name, b.agreed_amount, b.period_limit) if b else None,
            amount=inv.amount,
            currency=inv.currency,
            due_date=inv.due_date,
            confidence=inv.confidence or 0.0,
            suspicious=bool((inv.extracted_json or {}).get("suspicious", False)),
        )
        result = decide(invoice_input, config, list(history), today=inv.created_at.date())

        current = inv.decision.decision if inv.decision else "escalate"
        items.append(SimulationItem(
            invoice_id=inv.id,
            number=inv.number,
            current_decision=current,
            simulated_decision=result.decision,
            changed=result.decision != current,
            simulated_reasons=result.reasons,
        ))
        history.append(PriorRecord(
            number=inv.number,
            beneficiary_key=key,
            amount_usd=result.amount_usd,
            status=_simulated_status(result.decision, inv.status),
            received_on=inv.created_at.date(),
        ))

    return SimulationResponse(
        total=len(items),
        changed_count=sum(1 for i in items if i.changed),
        results=items,
    )