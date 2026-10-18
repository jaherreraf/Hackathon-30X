import sys
from datetime import date

from core.database import SessionLocal, Base, engine
from core.utils import normalize_name
from features.rules.model import Rule, ExchangeRate
from features.beneficiaries.model import Beneficiary
from features.invoices import model as _invoices    # noqa: F401
from features.decisions import model as _decisions  # noqa: F401
from features.approvals import model as _approvals  # noqa: F401
from features.audit.service import log_event


def seed_database():
    if "--reset" in sys.argv:
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped.")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Regla Activa
        active_rule = db.query(Rule).filter(Rule.active.is_(True)).first()
        if not active_rule:
            print("Creating default active rule...")
            rule = Rule(
                company_name="Acme Corp",
                period=date.today().strftime("%Y-%m"),
                per_payment_limit=3000.0,
                human_approval_threshold=1500.0,
                period_budget=6000.0,
                allowed_currencies=["USD", "EUR"],
                amount_tolerance=0.0,
                duplicate_window_days=30,
                min_confidence=0.7,
                active=True,
            )
            rule.exchange_rates = [
                ExchangeRate(currency="USD", rate_to_usd=1.0),
                ExchangeRate(currency="EUR", rate_to_usd=1.08),
                ExchangeRate(currency="COP", rate_to_usd=0.00025),
            ]
            db.add(rule)
            db.flush()
            log_event(
                db,
                event="rules_created",
                entity="rule",
                entity_id=rule.id,
                detail={"message": "Initial seed rule created"},
            )
            print(f"Rule created with ID {rule.id}")
        else:
            print(f"Active rule already exists with ID {active_rule.id}")

        # 2. Beneficiarios iniciales
        initial_beneficiaries = [
            {"display_name": "Diseños Lumen", "agreed_amount": 800.0, "period_limit": 800.0, "active": True},
            {"display_name": "CloudHost", "agreed_amount": 1200.0, "period_limit": 1200.0, "active": True},
            {"display_name": "Ana Pérez", "agreed_amount": 2500.0, "period_limit": 2500.0, "active": True},
        ]

        for b_data in initial_beneficiaries:
            norm = normalize_name(b_data["display_name"])
            existing = db.query(Beneficiary).filter(Beneficiary.normalized_name == norm).first()
            if not existing:
                b = Beneficiary(
                    normalized_name=norm,
                    display_name=b_data["display_name"],
                    agreed_amount=b_data["agreed_amount"],
                    period_limit=b_data["period_limit"],
                    active=b_data["active"],
                )
                db.add(b)
                print(f"Created beneficiary: {b_data['display_name']} (active={b_data['active']})")
            else:
                existing.display_name = b_data["display_name"]
                existing.agreed_amount = b_data["agreed_amount"]
                existing.period_limit = b_data["period_limit"]
                existing.active = b_data["active"]
                print(f"Updated beneficiary: {existing.display_name} to active={existing.active}")

        db.commit()
        print("Database seeded successfully!")

    except Exception as exc:
        db.rollback()
        print(f"Error seeding database: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
