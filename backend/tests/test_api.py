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
    # Factura 1: Lumen $800 -> PAY
    lumen_json = json.dumps({
        "number": "LUM-100",
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
        "number": "ANA-200",
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
