import random
from datetime import date, timedelta

from core.utils import normalize_name
from features.decisions.engine import (
    BeneficiaryInfo, InvoiceInput, PriorRecord, RulesConfig, decide,
)

TODAY = date(2026, 10, 17)
RULES = RulesConfig(
    per_payment_limit=3000, human_approval_threshold=1500, period_budget=6000,
    allowed_currencies=("USD", "EUR"), exchange_rates={"USD": 1.0, "EUR": 1.08},
)

LUMEN = BeneficiaryInfo("disenos lumen", "Diseños Lumen", 800, 800)
CLOUD = BeneficiaryInfo("cloudhost", "CloudHost", 1200, 1200)
ANA = BeneficiaryInfo("ana perez", "Ana Pérez", 2500, 2500)
BIG = BeneficiaryInfo("bigcorp", "BigCorp", 3500, 4000)
EUROCO = BeneficiaryInfo("euroco", "EuroCo", 1080, 1080)


def invoice(b=LUMEN, amount=None, **kw):
    base = dict(
        number="INV-1",
        beneficiary_text=b.display_name if b else "Proveedor X",
        beneficiary_key=b.key if b else "proveedor x",
        beneficiary=b,
        amount=amount if amount is not None else (b.agreed_amount if b else 100),
        currency="USD",
        due_date=TODAY + timedelta(days=15),
        confidence=0.95,
    )
    base.update(kw)
    return InvoiceInput(**base)


def prior(b, amount, status="paid", days_ago=5, number="OLD-1"):
    return PriorRecord(number, b.key, amount, status, TODAY - timedelta(days=days_ago))


def run(inv, history=()):
    return decide(inv, RULES, list(history), today=TODAY)


def test_normal_payment():
    r = run(invoice())
    assert r.decision == "pay"
    assert all(step.passed for step in r.evaluation)


def test_exact_duplicate_is_held():
    r = run(invoice(number="L-1"), [prior(LUMEN, 800, number="L-1")])
    assert r.decision == "hold" and "DUPLICATE" in r.applied_rules


def test_near_duplicate_is_held():
    r = run(invoice(number="L-2"), [prior(LUMEN, 800, number="L-1")])
    assert r.decision == "hold" and "DUPLICATE" in r.applied_rules


def test_unknown_beneficiary_escalates():
    r = run(invoice(None))
    assert r.decision == "escalate" and r.applied_rules == ["BENEFICIARY"]


def test_amount_differs_from_agreed():
    r = run(invoice(CLOUD, amount=1900))
    assert r.decision == "escalate"
    assert "AGREED_AMOUNT" in r.applied_rules and "HUMAN_APPROVAL" in r.applied_rules


def test_human_approval_threshold():
    r = run(invoice(ANA))
    assert r.decision == "escalate" and r.applied_rules == ["HUMAN_APPROVAL"]


def test_over_payment_limit():
    r = run(invoice(BIG, amount=3500))
    assert r.decision == "escalate" and "PAYMENT_LIMIT" in r.applied_rules


def test_budget_exhausted_is_held():
    history = [prior(ANA, 2500, "approved_human"), prior(CLOUD, 1200), prior(BIG, 1800)]
    r = run(invoice(), history)
    assert r.decision == "hold" and "BUDGET" in r.applied_rules


def test_beneficiary_period_limit_is_held():
    r = run(invoice(number="L-9"), [prior(LUMEN, 800, number="L-1", days_ago=40)])
    assert r.decision == "hold" and "BENEFICIARY_LIMIT" in r.applied_rules


def test_missing_number():
    r = run(invoice(number=None))
    assert r.decision == "escalate" and r.applied_rules == ["INCOMPLETE_DATA"]


def test_currency_not_allowed():
    r = run(invoice(currency="COP", amount=1_000_000))
    assert r.decision == "escalate" and r.applied_rules == ["CURRENCY"]


def test_name_normalization_matches_beneficiary_key():
    assert normalize_name("DISENOS LUMEN") == LUMEN.key
    assert normalize_name("  Diseños   Lumen ") == LUMEN.key


def test_overdue():
    r = run(invoice(due_date=TODAY - timedelta(days=1)))
    assert r.decision == "escalate" and r.applied_rules == ["OVERDUE"]


def test_split_payments():
    r = run(invoice(BIG, amount=1300), [prior(BIG, 1400)])
    assert r.decision == "escalate" and "SPLIT_PAYMENTS" in r.applied_rules


def test_prompt_injection_is_escalated():
    r = run(invoice(suspicious=True))
    assert r.decision == "escalate" and r.applied_rules == ["SUSPICIOUS_CONTENT"]


def test_eur_within_rules_pays_with_conversion():
    r = run(invoice(EUROCO, amount=1000, currency="EUR"))
    assert r.decision == "pay" and r.amount_usd == 1080.0


def test_low_confidence():
    r = run(invoice(confidence=0.4))
    assert r.decision == "escalate" and r.applied_rules == ["LOW_CONFIDENCE"]


def test_engine_error_escalates_never_pays():
    r = decide(invoice(), None, [], today=TODAY)   
    assert r.decision == "escalate" and "ENGINE_ERROR" in r.applied_rules


def test_property_pay_never_violates_rules():
    rnd = random.Random(42)
    providers = [LUMEN, CLOUD, ANA, BIG, EUROCO, None]
    pays = 0
    for _ in range(5000):
        b = rnd.choice(providers)
        agreed = b.agreed_amount if b else 100
        inv = invoice(
            b,
            amount=rnd.choice([agreed, round(rnd.uniform(1, 5000), 2)]),
            currency=rnd.choice(["USD", "EUR", "COP"]),
            confidence=rnd.uniform(0.3, 1.0),
            due_date=TODAY + timedelta(days=rnd.randint(-5, 20)),
            number=rnd.choice(["A", "B", "C", None]),
            suspicious=rnd.random() < 0.1,
        )
        history = [
            prior(rnd.choice([LUMEN, CLOUD, ANA, BIG]), round(rnd.uniform(100, 2000), 2),
                  status=rnd.choice(["paid", "held", "escalated", "approved_human", "rejected_human"]),
                  days_ago=rnd.randint(0, 60), number=rnd.choice(["A", "B", "X"]))
            for _ in range(rnd.randint(0, 4))
        ]
        r = run(inv, history)
        if r.decision == "pay":
            pays += 1
            assert all(step.passed for step in r.evaluation)
            assert r.amount_usd <= RULES.per_payment_limit
            assert r.amount_usd < RULES.human_approval_threshold
            assert inv.beneficiary is not None
            assert inv.confidence >= RULES.min_confidence
            assert inv.due_date >= TODAY
    assert pays > 0   