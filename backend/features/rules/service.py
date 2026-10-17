from sqlalchemy.orm import Session, selectinload

from features.audit.service import log_event  
from features.rules.model import ExchangeRate, Rule
from features.rules.schema import RuleUpdate

def get_active(db: Session) -> Rule | None:
    return (
        db.query(Rule)
        .options(selectinload(Rule.exchange_rates))
        .filter(Rule.active.is_(True))
        .first()
    )

def snapshot(rule: Rule) -> dict:
    return {
        "rule_id": rule.id,
        "company_name": rule.company_name,
        "period": rule.period,
        "per_payment_limit": rule.per_payment_limit,
        "human_approval_threshold": rule.human_approval_threshold,
        "period_budget": rule.period_budget,
        "allowed_currencies": list(rule.allowed_currencies or []),
        "amount_tolerance": rule.amount_tolerance,
        "duplicate_window_days": rule.duplicate_window_days,
        "min_confidence": rule.min_confidence,
        "exchange_rates": [
            {"currency": r.currency, "rate_to_usd": r.rate_to_usd}
            for r in rule.exchange_rates
        ],
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }

def save(db: Session, data: RuleUpdate) -> Rule:
    try:
        previous = get_active(db)
        if previous:
            previous.active = False
            db.flush()  

        new_rule = Rule(
            **data.model_dump(exclude={"exchange_rates", "beneficiaries"}),
            active=True,
        )
        new_rule.exchange_rates = [
            ExchangeRate(currency=r.currency, rate_to_usd=r.rate_to_usd)
            for r in data.exchange_rates
        ]
        db.add(new_rule)
        db.flush() 

        log_event(
            db,
            event="rules_modified",
            entity="rule",
            entity_id=new_rule.id,
            detail={
                "previous_rule_id": previous.id if previous else None,
                "snapshot": snapshot(new_rule),
            },
        )

        db.commit()
        db.refresh(new_rule)
        return new_rule
    except Exception:
        db.rollback()
        raise