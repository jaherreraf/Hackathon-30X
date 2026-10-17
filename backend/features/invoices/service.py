import hashlib
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.utils import normalize_name
from features.audit.service import log_event
from features.beneficiaries import service as beneficiaries_service
from features.decisions import service as decisions_service
from features.decisions.engine import BeneficiaryInfo, InvoiceInput, PriorRecord, RulesConfig, decide
from features.decisions.explainer import explain
from features.extraction import service as extraction_service
from features.extraction.schema import ExtractedInvoice
from features.invoices.model import Invoice
from features.rules import service as rules_service


class NoActiveRulesError(Exception):
    pass


def get_by_id(db: Session, invoice_id: int) -> Invoice | None:
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.decision))
        .where(Invoice.id == invoice_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def list_all(db: Session, status: str | None = None) -> list[Invoice]:
    stmt = select(Invoice).options(selectinload(Invoice.decision))
    if status is not None:
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.created_at.desc())
    return list(db.execute(stmt).scalars().all())


# ---------- helpers ----------

def _content_hash(text: str | None, file_bytes: bytes | None) -> str:
    data = file_bytes if file_bytes is not None else (text or "").encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    year, month = (int(p) for p in period.split("-"))
    return datetime(year, month, 1), datetime(year + (month == 12), month % 12 + 1, 1)


def _build_history(db: Session, period: str) -> list[PriorRecord]:
    start, end = _period_bounds(period)
    rows = db.execute(
        select(Invoice).where(Invoice.created_at >= start, Invoice.created_at < end)
    ).scalars().all()
    return [
        PriorRecord(
            number=i.number,
            beneficiary_key=normalize_name(i.beneficiary_text) if i.beneficiary_text else None,
            amount_usd=i.amount_usd,
            status=i.status,
            received_on=i.created_at.date(),
        )
        for i in rows
    ]


def _to_info(b) -> BeneficiaryInfo:
    return BeneficiaryInfo(
        key=b.normalized_name,
        display_name=b.display_name,
        agreed_amount=b.agreed_amount,
        period_limit=b.period_limit,
    )


# ---------- main flow ----------

def process(
    db: Session,
    *,
    source: str,
    text: str | None = None,
    file_bytes: bytes | None = None,
    file_path: str | None = None,
    media_type: str | None = None,
) -> Invoice:
    rule = rules_service.get_active(db)
    if rule is None:
        raise NoActiveRulesError()

    try:
        extracted = extraction_service.extract(
            source, text=text, file_bytes=file_bytes, media_type=media_type
        )
    except Exception:
        extracted = ExtractedInvoice()  

    try:
        snapshot = rules_service.snapshot(rule)
        history = _build_history(db, rule.period)   

        beneficiary = None
        key = None
        if extracted.beneficiary and extracted.beneficiary.strip():
            key = normalize_name(extracted.beneficiary)
            beneficiary = beneficiaries_service.find_by_name(db, extracted.beneficiary)
        currency = extracted.currency.strip().upper() if extracted.currency else None

        invoice = Invoice(
            number=extracted.number,
            beneficiary_text=extracted.beneficiary,
            beneficiary_id=beneficiary.id if beneficiary else None,
            amount=extracted.amount,
            currency=currency,
            due_date=extracted.due_date,
            confidence=extracted.confidence,
            source=source,
            file_path=file_path,
            raw_text=text,
            extracted_json=extracted.model_dump(mode="json"),
            content_hash=_content_hash(text, file_bytes),
            status="escalated",       
        )
        db.add(invoice)
        db.flush()
        log_event(db, "invoice_received", "invoice", invoice.id, {"source": source})
        log_event(db, "data_extracted", "invoice", invoice.id, invoice.extracted_json)

        invoice_input = InvoiceInput(
            number=extracted.number,
            beneficiary_text=extracted.beneficiary,
            beneficiary_key=key,
            beneficiary=_to_info(beneficiary) if beneficiary else None,
            amount=extracted.amount,
            currency=currency,
            due_date=extracted.due_date,
            confidence=extracted.confidence,
            suspicious=extracted.suspicious,
        )
        try:
            config = RulesConfig.from_snapshot(snapshot)
        except Exception:
            config = None           
        result = decide(invoice_input, config, history, today=datetime.utcnow().date())

        invoice.amount_usd = result.amount_usd
        explanation = explain(
            result,
            extracted.number,
            beneficiary.display_name if beneficiary else extracted.beneficiary,
        )
        decisions_service.save_decision(db, invoice, result, snapshot, explanation)

        db.commit()
        db.refresh(invoice)
        return invoice
    except Exception:
        db.rollback()
        raise