from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from features.simulator import service
from features.simulator.schema import SimulationRequest, SimulationResponse

router = APIRouter()


@router.post("", response_model=SimulationResponse)
def run_simulation(data: SimulationRequest, db: Session = Depends(get_db)):
    return service.simulate(db, data.rules)