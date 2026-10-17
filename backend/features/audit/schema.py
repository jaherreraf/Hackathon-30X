from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event: str
    entity: str
    entity_id: int | None = None
    detail: dict[str, Any] = {}
    created_at: datetime