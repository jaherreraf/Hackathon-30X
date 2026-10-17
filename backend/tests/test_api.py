import json
import os

os.environ["EXTRACTOR"] = "stub"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_rules_and_beneficiaries():
    # 1. Rules
    res = client.get("/rules")
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Acme Corp"
    assert data["period_budget"] == 6000.0
    assert data["per_payment_limit"] == 3000.0

    # 2. Beneficiaries
    res_b = client.get("/beneficiaries")
    assert res_b.status_code == 200
    bens = res_b.json()
    names = [b["display_name"] for b in bens]
    assert "Diseños Lumen" in names
    assert "CloudHost" in names
    assert "Ana Pérez" in names


def test_invoice_flow_and_resolution():
    import uuid
    from core.database import SessionLocal
    from features.approvals.model import Approval
    from features.decisions.model import Decision
    from features.invoices.model import Invoice

    db = SessionLocal()
    db.query(Approval).delete()
    db.query(Decision).delete()
    db.query(Invoice).delete()
    db.commit()
    db.close()

    lumen_num = f"LUM-{uuid.uuid4().hex[:6].upper()}"
    ana_num = f"ANA-{uuid.uuid4().hex[:6].upper()}"

    # Factura 1: Lumen $800 -> PAY
    lumen_json = json.dumps({
        "number": lumen_num,
        "beneficiary": "Diseños Lumen",
        "amount": 800.0,
        "currency": "USD",
        "due_date": "2026-10-30",
        "confidence": 0.95,
        "suspicious": False,
    })
    res1 = client.post("/invoices", data={"source": "text", "text": lumen_json})
    assert res1.status_code == 201
    d1 = res1.json()
    assert d1["decision"]["decision"] == "pay"
    assert d1["status"] == "paid"

    # Factura 2: Duplicada de Lumen -> HOLD
    res2 = client.post("/invoices", data={"source": "text", "text": lumen_json})
    assert res2.status_code == 201
    d2 = res2.json()
    assert d2["decision"]["decision"] == "hold"
    assert d2["status"] == "held"

    # Factura 3: Ana Pérez $2500 -> ESCALATE (supera umbral humano)
    ana_json = json.dumps({
        "number": ana_num,
        "beneficiary": "Ana Pérez",
        "amount": 2500.0,
        "currency": "USD",
        "due_date": "2026-10-30",
        "confidence": 0.95,
        "suspicious": False,
    })
    res3 = client.post("/invoices", data={"source": "text", "text": ana_json})
    assert res3.status_code == 201
    d3 = res3.json()
    assert d3["decision"]["decision"] == "escalate"
    assert d3["status"] == "escalated"
    decision_id = d3["decision"]["id"]

    # Resolver Factura 3 (Humano aprueba)
    res_res = client.post(
        f"/decisions/{decision_id}/resolve",
        json={"action": "approve", "user": "maria.finanzas", "comment": "Aprobado para Ana"},
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "approved_human"

    # Verificar métricas
    res_m = client.get("/metrics")
    assert res_m.status_code == 200
    m = res_m.json()
    assert m["total"] >= 3
    assert m["payments_outside_rules"] == 0
    assert m["spent_budget"] >= 3300.0


def test_simulator_is_read_only():
    # Estado previo de auditoría y reglas
    res_audit_before = client.get("/audit")
    assert res_audit_before.status_code == 200
    count_audit_before = len(res_audit_before.json())

    res_rules_before = client.get("/rules")
    assert res_rules_before.status_code == 200
    rules_before = res_rules_before.json()

    # Ejecutar simulación con reglas distintas
    sim_payload = {
        "rules": {
            "company_name": "Acme Corp",
            "period": "2026-10",
            "per_payment_limit": 5000,
            "human_approval_threshold": 4000,
            "period_budget": 10000,
            "allowed_currencies": ["USD", "EUR"],
            "amount_tolerance": 800,
            "duplicate_window_days": 30,
            "min_confidence": 0.7,
            "exchange_rates": [
                {"currency": "USD", "rate_to_usd": 1.0},
                {"currency": "EUR", "rate_to_usd": 1.08},
            ],
        }
    }
    res_sim = client.post("/simulator", json=sim_payload)
    assert res_sim.status_code == 200

    # Comprobar que no escribió en la base
    res_audit_after = client.get("/audit")
    assert len(res_audit_after.json()) == count_audit_before

    res_rules_after = client.get("/rules")
    assert res_rules_after.json()["human_approval_threshold"] == rules_before["human_approval_threshold"]
    assert res_rules_after.json()["amount_tolerance"] == rules_before["amount_tolerance"]
