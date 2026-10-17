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
            reasons=[f"Internal error, escalated for safety: {exc}"],
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
        missing.append("number")
    if not (invoice.beneficiary_text or "").strip() or not invoice.beneficiary_key:
        missing.append("beneficiary")
    if invoice.amount is None or invoice.amount <= 0:
        missing.append("amount")
    if not (invoice.currency or "").strip():
        missing.append("currency")
    if not add("INCOMPLETE_DATA", not missing, ESCALATE,
               f"Missing or invalid data: {', '.join(missing)}."):
        return _resolve(results, amount_usd)

    if not add("SUSPICIOUS_CONTENT", not invoice.suspicious, ESCALATE,
               "The invoice contained instructions aimed at the agent; they were ignored."):
        return _resolve(results, amount_usd)

    if not add("LOW_CONFIDENCE", invoice.confidence >= rules.min_confidence, ESCALATE,
               f"Extraction confidence {invoice.confidence:.2f} is below the minimum "
               f"{rules.min_confidence:.2f}."):
        return _resolve(results, amount_usd)

    currency = invoice.currency.strip().upper()
    rate = rules.exchange_rates.get(currency)
    if not add("CURRENCY", currency in rules.allowed_currencies and rate is not None and rate > 0,
               ESCALATE, f"Currency {currency} is not allowed or has no exchange rate."):
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
        "An invoice with the same number from this provider was already received." if exact
        else f"This provider already sent the same amount in the last "
             f"{rules.duplicate_window_days} days under a different number.")

    add("BENEFICIARY", beneficiary is not None, ESCALATE,
        f"'{invoice.beneficiary_text}' is not on the allowed beneficiary list.")

    if beneficiary:
        add("AGREED_AMOUNT",
            abs(amount_usd - beneficiary.agreed_amount) <= rules.amount_tolerance + EPS,
            ESCALATE,
            f"Amount {_usd(amount_usd)} does not match the agreed {_usd(beneficiary.agreed_amount)}.")
    else:
        add("AGREED_AMOUNT", True, None, "", "Skipped: beneficiary not on the list.")

    add("PAYMENT_LIMIT", amount_usd <= rules.per_payment_limit + EPS, ESCALATE,
        f"Amount {_usd(amount_usd)} exceeds the per-payment limit of {_usd(rules.per_payment_limit)}.")

    add("HUMAN_APPROVAL", amount_usd < rules.human_approval_threshold, ESCALATE,
        f"Amounts from {_usd(rules.human_approval_threshold)} always require human approval.")

    spent_by_provider = _spent(same)
    if beneficiary and spent_by_provider > 0:
        add("BENEFICIARY_LIMIT",
            spent_by_provider + amount_usd <= beneficiary.period_limit + EPS, HOLD,
            f"Paying {_usd(amount_usd)} on top of {_usd(spent_by_provider)} already paid would "
            f"exceed this provider's period limit of {_usd(beneficiary.period_limit)}.")
    else:
        add("BENEFICIARY_LIMIT", True, None, "", "No prior spending on this provider (or skipped).")

    total_spent = _spent(history)
    add("BUDGET", total_spent + amount_usd <= rules.period_budget + EPS, HOLD,
        f"Paying {_usd(amount_usd)} would exceed the period budget of {_usd(rules.period_budget)} "
        f"({_usd(total_spent)} already spent).")

    if invoice.due_date is None:
        add("OVERDUE", False, ESCALATE, "The invoice has no due date, so it cannot be verified.")
    else:
        add("OVERDUE", invoice.due_date >= today, ESCALATE,
            f"The invoice is overdue (due {invoice.due_date.isoformat()}).")

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
        f"Recent invoices from this provider ({_usd(recent)}) plus this one "
        f"({_usd(amount_usd)}) exceed {_usd(threshold)}: possible split payment.")

    return _resolve(results, amount_usd)