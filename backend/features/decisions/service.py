from sqlalchemy.orm import Session

from features.approvals.model import Approval          # SUPUESTO: ver nota 1
from features.audit.service import log_event
from features.decisions.engine import DecisionResult
from features.decisions.model import Decision
from features.decisions.schema import ResolveRequest

STATUS_BY_DECISION = {"pay": "paid", "hold": "held", "escalate": "escalated"}


class DecisionNotFoundError(Exception):
    pass


class DecisionNotResolvableError(Exception):
    pass


def save_decision(
    db: Session, invoice, result: DecisionResult, rules_snapshot: dict, explanation: str
) -> Decision:
    data = result.to_dict()
    decision = Decision(
        invoice_id=invoice.id,
        decision=result.decision,
        reasons=data["reasons"],
        applied_rules=data["applied_rules"],
        evaluation=data["evaluation"],
        human_explanation=explanation,
        rules_snapshot=rules_snapshot,
        engine_version=result.engine_version,
    )
    db.add(decision)
    invoice.status = STATUS_BY_DECISION.get(result.decision, "escalated")
    db.flush()
    log_event(
        db, "decision_made", "invoice", invoice.id,
        {"decision_id": decision.id, "decision": result.decision, "rules": result.applied_rules},
    )
    return decision


def resolve(db: Session, decision_id: int, data: ResolveRequest) -> tuple[Decision, str]:
    try:
        decision = db.get(Decision, decision_id)
        if decision is None:
            raise DecisionNotFoundError(decision_id)

        invoice = decision.invoice
        if decision.decision != "escalate" or invoice.status != "escalated":
            raise DecisionNotResolvableError(decision_id)

        new_status = "approved_human" if data.action == "approve" else "rejected_human"
        invoice.status = new_status
        db.add(Approval(
            decision_id=decision.id,
            action=data.action,
            user=data.user,
            comment=data.comment,
        ))
        db.flush()
        log_event(
            db, "human_resolution", "invoice", invoice.id,
            {"decision_id": decision.id, "action": data.action, "user": data.user, "comment": data.comment},
        )
        db.commit()
        return decision, new_status
    except Exception:
        db.rollback()
        raise