from features.decisions.engine import HOLD, PAY, DecisionResult


def explain(result: DecisionResult, invoice_number: str | None, provider: str | None) -> str:
    who = f"la factura {invoice_number or '(sin número)'} de {provider or 'un proveedor desconocido'}"
    amount = f" por ${result.amount_usd:,.2f}" if result.amount_usd is not None else ""

    if result.decision == PAY:
        return f"Aprobada para pago: {who}{amount} pasó las {len(result.evaluation)} reglas."

    reasons = " ".join(result.reasons)
    if result.decision == HOLD:
        return f"Frenada: {who}{amount} fue detenida. {reasons}"
    return f"Escalada: {who}{amount} requiere aprobación humana. {reasons}"
