from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class DecisionData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    invoice_id: int | None = None
    decision: str
    reasons: list[str] = []
    applied_rules: list[str] = []
    evaluation: list[dict[str, Any]] = []
    human_explanation: str = ""
    rules_snapshot: dict[str, Any] = {}
    engine_version: str = "1.0.0"
    created_at: datetime | None = None


class ResolveRequest(BaseModel):
    action: Literal["approve", "reject"]
    user: str = Field(..., min_length=1, max_length=80)
    comment: str | None = None


class ResolveResponse(BaseModel):
    decision_id: int
    invoice_id: int
    status: str            
    action: str
    user: str
    comment: str | None = None