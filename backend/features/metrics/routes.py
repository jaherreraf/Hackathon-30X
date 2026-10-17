from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from core.database import get_db

from features.metrics.schema import MetricsResponse
from features.metrics.service import calculate_metrics

router = APIRouter()

@router.get("", response_model=MetricsResponse, summary="Obtain global agent metrics")
def get_metrics(db: Session = Depends(get_db)):
    return calculate_metrics(db)