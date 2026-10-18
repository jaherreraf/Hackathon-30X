"""Pure decision engine. NO database, NO FastAPI, NO LLM."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, timedelta

ENGINE_VERSION = "1.0.0"

PAY, HOLD, ESCALATE = "pay", "hold", "escalate"
SPENT_STATUSES = {"paid", "approved_human"}
EPS = 0.005


# ---------- Inputs ----------

@dataclass(frozen=True)
class BeneficiaryInfo:
    key: str
    display_name: str
    agreed_amount: float
    period_limit: float


@dataclass(frozen=True)
class InvoiceInput:
    number: str | None
    beneficiary_text: str | None
    beneficiary_key: str | None
    beneficiary: BeneficiaryInfo | None
    amount: float | None
    currency: str | None
    due_date: date | None
    confidence: float = 0.0
    suspicious: bool = False


@dataclass(frozen=True)
class PriorRecord:
    number: str | None
    beneficiary_key: str | None
    amount_usd: float | None
    status: str
    received_on: date


@dataclass(frozen=True)
class RulesConfig:
    per_payment_limit: float
    human_approval_threshold: float
    period_budget: float
    allowed_currencies: tuple[str, ...]
    exchange_rates: dict[str, float]
    amount_tolerance: float = 0.0
    duplicate_window_days: int = 30
    min_confidence: float = 0.7

    @classmethod
    def from_snapshot(cls, snap: dict) -> "RulesConfig":
        return cls(
            per_payment_limit=snap["per_payment_limit"],
            human_approval_threshold=snap["human_approval_threshold"],
            period_budget=snap["period_budget"],
            allowed_currencies=tuple(c.upper() for c in snap["allowed_currencies"]),
            exchange_rates={r["currency"].upper(): r["rate_to_usd"] for r in snap["exchange_rates"]},
            amount_tolerance=snap["amount_tolerance"],
            duplicate_window_days=snap["duplicate_window_days"],
            min_confidence=snap["min_confidence"],
        )


# ---------- Output ----------

@dataclass
class RuleResult:
    rule: str
    passed: bool
    effect: str | None
    detail: str


@dataclass
class DecisionResult:
    decision: str
    reasons: list[str]
    applied_rules: list[str]
    evaluation: list[RuleResult]
    amount_usd: float | None = None
    engine_version: str = ENGINE_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


# ---------- Engine ----------

def decide(
    invoice: InvoiceInput,
    rules: RulesConfig,
    history: list[PriorRecord],
    today: date | None = None,
) -> DecisionResult:
    today = today or date.today()
    try:
        return _decide(invoice, rules, history, today)
    except Exception as exc:
        return DecisionResult(
            decision=ESCALATE,
            reasons=[f"Error interno, se escala por seguridad: {exc}"],
            applied_rules=["ENGINE_ERROR"],
            evaluation=[RuleResult("ENGINE_ERROR", False, ESCALATE, str(exc))],
        )


def _usd(x: float) -> str:
    return f"${x:,.2f}"


def _spent(records) -> float:
    return sum((r.amount_usd or 0.0) for r in records if r.status in SPENT_STATUSES)


def _convert(invoice, rules) -> float | None:
    try:
        cur = (invoice.currency or "").strip().upper()
        rate = rules.exchange_rates.get(cur)
        if invoice.amount is None or invoice.amount <= 0 or not rate or rate <= 0:
            return None
        return round(invoice.amount * rate, 2)
    except Exception:
        return None


def _resolve(results: list[RuleResult], amount_usd: float | None) -> DecisionResult:
    failed = [r for r in results if not r.passed]
    if any(r.effect == HOLD for r in failed):
        decision = HOLD
    elif failed:
        decision = ESCALATE
    else:
        decision = PAY
    return DecisionResult(
        decision=decision,
        reasons=[r.detail for r in failed],
        applied_rules=[r.rule for r in failed],
        evaluation=results,
        amount_usd=amount_usd,
    )


def _decide(invoice, rules, history, today) -> DecisionResult:
    results: list[RuleResult] = []
    amount_usd = _convert(invoice, rules)

    def add(rule, passed, effect, fail_msg, ok_msg="OK") -> bool:
        results.append(RuleResult(rule, passed, None if passed else effect,
                                  ok_msg if passed else fail_msg))
        return passed

    missing = []
    if not (invoice.number or "").strip():
        missing.append("número")
    if not (invoice.beneficiary_text or "").strip() or not invoice.beneficiary_key:
        missing.append("beneficiario")
    if invoice.amount is None or invoice.amount <= 0:
        missing.append("monto")
    if not (invoice.currency or "").strip():
        missing.append("moneda")
    if not add("INCOMPLETE_DATA", not missing, ESCALATE,
               f"Datos faltantes o inválidos: {', '.join(missing)}."):
        return _resolve(results, amount_usd)

    if not add("SUSPICIOUS_CONTENT", not invoice.suspicious, ESCALATE,
               "La factura contenía instrucciones dirigidas al agente; fueron ignoradas."):
        return _resolve(results, amount_usd)

    if not add("LOW_CONFIDENCE", invoice.confidence >= rules.min_confidence, ESCALATE,
               f"La confianza de extracción {invoice.confidence:.2f} está por debajo del mínimo "
               f"{rules.min_confidence:.2f}."):
        return _resolve(results, amount_usd)

    currency = invoice.currency.strip().upper()
    rate = rules.exchange_rates.get(currency)
    if not add("CURRENCY", currency in rules.allowed_currencies and rate is not None and rate > 0,
               ESCALATE, f"La moneda {currency} no está permitida o no tiene tasa de cambio."):
        return _resolve(results, amount_usd)

    amount_usd = round(invoice.amount * rate, 2)

    beneficiary = invoice.beneficiary
    key = invoice.beneficiary_key
    same = [r for r in history if r.beneficiary_key == key]
    window_start = today - timedelta(days=rules.duplicate_window_days)

    number = invoice.number.strip().lower()
    exact = any((r.number or "").strip().lower() == number for r in same)
    near = any(
        r.amount_usd is not None
        and abs(r.amount_usd - amount_usd) < EPS
        and r.received_on >= window_start
        for r in same
    )
    add("DUPLICATE", not (exact or near), HOLD,
        "Ya se recibió una factura con el mismo número de este proveedor." if exact
        else f"Este proveedor ya envió el mismo monto en los últimos "
             f"{rules.duplicate_window_days} días bajo un número distinto.")

    add("BENEFICIARY", beneficiary is not None, ESCALATE,
        f"'{invoice.beneficiary_text}' no está en la lista de beneficiarios permitidos.")

    if beneficiary:
        add("AGREED_AMOUNT",
            abs(amount_usd - beneficiary.agreed_amount) <= rules.amount_tolerance + EPS,
            ESCALATE,
            f"El monto {_usd(amount_usd)} no coincide con lo acordado {_usd(beneficiary.agreed_amount)}.")
    else:
        add("AGREED_AMOUNT", True, None, "", "Omitida: beneficiario no está en la lista.")

    add("PAYMENT_LIMIT", amount_usd <= rules.per_payment_limit + EPS, ESCALATE,
        f"El monto {_usd(amount_usd)} supera el límite por pago de {_usd(rules.per_payment_limit)}.")

    add("HUMAN_APPROVAL", amount_usd < rules.human_approval_threshold, ESCALATE,
        f"Los montos desde {_usd(rules.human_approval_threshold)} siempre requieren aprobación humana.")

    spent_by_provider = _spent(same)
    if beneficiary and spent_by_provider > 0:
        add("BENEFICIARY_LIMIT",
            spent_by_provider + amount_usd <= beneficiary.period_limit + EPS, HOLD,
            f"Pagar {_usd(amount_usd)} sobre {_usd(spent_by_provider)} ya pagados superaría "
            f"el límite del periodo de este proveedor de {_usd(beneficiary.period_limit)}.")
    else:
        add("BENEFICIARY_LIMIT", True, None, "", "Sin gasto previo en este proveedor (u omitida).")

    total_spent = _spent(history)
    add("BUDGET", total_spent + amount_usd <= rules.period_budget + EPS, HOLD,
        f"Pagar {_usd(amount_usd)} superaría el presupuesto del periodo de {_usd(rules.period_budget)} "
        f"({_usd(total_spent)} ya gastados).")

    if invoice.due_date is None:
        add("OVERDUE", False, ESCALATE, "La factura no tiene fecha de vencimiento, no se puede verificar.")
    else:
        add("OVERDUE", invoice.due_date >= today, ESCALATE,
            f"La factura está vencida (vencía el {invoice.due_date.isoformat()}).")

    recent = sum(
        (r.amount_usd or 0.0) for r in same
        if r.status != "rejected_human" and r.received_on >= window_start
    )
    threshold = rules.human_approval_threshold
    splitting = (
        not (exact or near)
        and recent > 0
        and amount_usd < threshold
        and recent + amount_usd > threshold
    )
    add("SPLIT_PAYMENTS", not splitting, ESCALATE,
        f"Las facturas recientes de este proveedor ({_usd(recent)}) más esta "
        f"({_usd(amount_usd)}) superan {_usd(threshold)}: posible fraccionamiento.")

    return _resolve(results, amount_usd)
