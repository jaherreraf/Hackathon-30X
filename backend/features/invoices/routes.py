from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.database import get_db
from features.decisions.schema import DecisionData
from features.invoices import service
from features.invoices.schema import InvoiceData, InvoiceDetailOut, InvoiceListItem

router = APIRouter()

VALID_SOURCES = {"pdf", "image", "text"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
UPLOAD_DIR = Path("uploads")


def _bad_request(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": code, "message": message})


def _detail(invoice) -> InvoiceDetailOut:
    return InvoiceDetailOut(
        id=invoice.id,
        status=invoice.status,
        invoice=InvoiceData.model_validate(invoice),
        decision=DecisionData.model_validate(invoice.decision),
    )


@router.get("", response_model=list[InvoiceListItem])
def list_invoices(status: str | None = None, db: Session = Depends(get_db)):
    invoices = service.list_all(db, status)
    return [
        InvoiceListItem(
            id=inv.id,
            number=inv.number,
            beneficiary=inv.beneficiary_text,
            amount_usd=inv.amount_usd,
            decision=inv.decision.decision if inv.decision else "escalate",
            reason_summary=(
                inv.decision.reasons[0] if inv.decision and inv.decision.reasons else None
            ),
            status=inv.status,
            created_at=inv.created_at,
        )
        for inv in invoices
    ]


@router.get("/{invoice_id}", response_model=InvoiceDetailOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = service.get_by_id(db, invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "invoice_not_found", "message": "Invoice not found"},
        )
    if invoice.decision is None:
        raise HTTPException(
            status_code=500,
            detail={"error": "decision_missing", "message": "Invoice has no decision"},
        )
    return _detail(invoice)


@router.post("", response_model=InvoiceDetailOut, status_code=201)
def create_invoice(
    source: str = Form(...),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if source not in VALID_SOURCES:
        raise _bad_request("invalid_source", "source must be 'pdf', 'image' or 'text'")

    file_bytes = file_path = media_type = None
    if source == "text":
        if not text or not text.strip():
            raise _bad_request("missing_text", "text is required when source is 'text'")
    else:
        if file is None:
            raise _bad_request("missing_file", "A file is required for pdf or image")
        file_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise _bad_request("file_too_large", "The file exceeds 10 MB")
        media_type = file.content_type
        UPLOAD_DIR.mkdir(exist_ok=True)
        path = UPLOAD_DIR / f"{uuid4().hex}_{Path(file.filename or 'upload').name}"
        path.write_bytes(file_bytes)
        file_path = str(path)

    try:
        invoice = service.process(
            db, source=source, text=text, file_bytes=file_bytes,
            file_path=file_path, media_type=media_type,
        )
    except service.NoActiveRulesError:
        raise HTTPException(
            status_code=409,
            detail={"error": "no_active_rules",
                    "message": "Configure the rules (PUT /rules) before sending invoices"},
        )
    return _detail(invoice)