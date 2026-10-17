from pydantic import BaseModel

from features.rules.schema import RuleUpdate


class SimulationRequest(BaseModel):
    rules: RuleUpdate


class SimulationItem(BaseModel):
    invoice_id: int
    number: str | None = None
    current_decision: str
    simulated_decision: str
    changed: bool
    simulated_reasons: list[str] = []


class SimulationResponse(BaseModel):
    total: int
    changed_count: int
    results: list[SimulationItem]