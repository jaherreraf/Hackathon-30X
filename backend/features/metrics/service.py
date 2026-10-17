from sqlalchemy.orm import Session, joinedload

from features.invoices.model import Invoice
from features.rules.model import Rule
from features.metrics.schema import MetricsResponse

DECISION_PAY = "pay"
DECISION_HOLD = "hold"
DECISION_ESCALATE = "escalate"
STATUS_PAID = "paid"
STATUS_ESCALATED = "escalated"
STATUS_APPROVED_HUMAN = "approved_human"
STATUS_REJECTED_HUMAN = "rejected_human"


def _violates_rules(decision) -> bool:
    if not decision:
        return True
    if decision.applied_rules:
        return True
    if not decision.evaluation:
        return True
    return any(not step.get("passed", False) for step in decision.evaluation)

def calculate_metrics(db: Session) -> MetricsResponse:
    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.decision))
        .all()
    )

    paid = held = escalated = 0
    pending = human_approved = human_rejected = 0
    payments_outside_rules = 0
    spent_budget = 0.0

    for inv in invoices:
        status = (inv.status or "").lower()
        decision = inv.decision
        agent_decision = (decision.decision if decision else "").lower()

        if agent_decision == DECISION_PAY:
            paid += 1
        elif agent_decision == DECISION_HOLD:
            held += 1
        else:
            escalated += 1

        if status == STATUS_ESCALATED:
            pending += 1
        elif status == STATUS_APPROVED_HUMAN:
            human_approved += 1
        elif status == STATUS_REJECTED_HUMAN:
            human_rejected += 1

        if status in (STATUS_PAID, STATUS_APPROVED_HUMAN) and inv.amount_usd is not None:
            spent_budget += inv.amount_usd

        if agent_decision == DECISION_PAY and _violates_rules(decision):
            payments_outside_rules += 1

    total = len(invoices)
    autonomy = round((paid + held) / total, 4) if total else 0.0

    active_rule = db.query(Rule).filter(Rule.active.is_(True)).first()
    period_budget = active_rule.period_budget if active_rule else 0.0

    spent_budget = round(spent_budget, 2)
    available_budget = round(period_budget - spent_budget, 2)

    return MetricsResponse(
        total=total,
        paid=paid,
        held=held,
        escalated=escalated,
        pending=pending,
        human_approved=human_approved,
        human_rejected=human_rejected,
        autonomy=autonomy,
        payments_outside_rules=payments_outside_rules,
        period_budget=period_budget,
        spent_budget=spent_budget,
        available_budget=available_budget,
    )