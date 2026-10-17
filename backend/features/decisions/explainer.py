from features.decisions.engine import HOLD, PAY, DecisionResult


def explain(result: DecisionResult, invoice_number: str | None, provider: str | None) -> str:
    who = f"invoice {invoice_number or '(no number)'} from {provider or 'an unknown provider'}"
    amount = f" for ${result.amount_usd:,.2f}" if result.amount_usd is not None else ""

    if result.decision == PAY:
        return f"Approved for payment: {who}{amount} passed all {len(result.evaluation)} rules."

    reasons = " ".join(result.reasons)
    if result.decision == HOLD:
        return f"Held: {who}{amount} was stopped. {reasons}"
    return f"Escalated: {who}{amount} needs human approval. {reasons}"