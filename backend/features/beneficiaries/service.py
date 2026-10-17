from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.utils import normalize_name

from features.beneficiaries.model import Beneficiary
from features.beneficiaries.schema import BeneficiaryCreate, BeneficiaryUpdate

class BeneficiaryExistsError(Exception):
    pass

class BeneficiaryNotFoundError(Exception):
    pass

def list_all(db: Session) -> list[Beneficiary]:
    return db.query(Beneficiary).order_by(Beneficiary.display_name).all()

def find_by_name(db: Session, name: str, include_inactive: bool = False) -> Beneficiary | None:
    normalized = normalize_name(name or "")
    if not normalized:
        return None
    query = db.query(Beneficiary).filter(Beneficiary.normalized_name == normalized)
    if not include_inactive:
        query = query.filter(Beneficiary.active.is_(True))
    return query.first()

def create(db: Session, data: BeneficiaryCreate) -> Beneficiary:
    normalized = normalize_name(data.display_name)
    if db.query(Beneficiary).filter(Beneficiary.normalized_name == normalized).first():
        raise BeneficiaryExistsError(data.display_name)

    beneficiary = Beneficiary(
        normalized_name=normalized,
        display_name=data.display_name,
        agreed_amount=data.agreed_amount,
        period_limit=data.period_limit,
        active=data.active,
    )
    try:
        db.add(beneficiary)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BeneficiaryExistsError(data.display_name)
    db.refresh(beneficiary)
    return beneficiary

def update(db: Session, beneficiary_id: int, data: BeneficiaryUpdate) -> Beneficiary:
    beneficiary = db.get(Beneficiary, beneficiary_id)
    if beneficiary is None:
        raise BeneficiaryNotFoundError(beneficiary_id)

    normalized = normalize_name(data.display_name)
    clash = (
        db.query(Beneficiary)
        .filter(Beneficiary.normalized_name == normalized, Beneficiary.id != beneficiary_id)
        .first()
    )
    if clash:
        raise BeneficiaryExistsError(data.display_name)

    beneficiary.normalized_name = normalized
    beneficiary.display_name = data.display_name
    beneficiary.agreed_amount = data.agreed_amount
    beneficiary.period_limit = data.period_limit
    beneficiary.active = data.active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BeneficiaryExistsError(data.display_name)
    db.refresh(beneficiary)
    return beneficiary