from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


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
