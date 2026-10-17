from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import Base, engine

from features.rules         import model as rules_model          
from features.beneficiaries import model as beneficiaries_model  
from features.invoices      import model as invoices_model       
from features.decisions     import model as decisions_model      
from features.approvals     import model as approvals_model      
from features.audit         import model as audit_model          

from features.rules.routes         import router as rules_router
from features.beneficiaries.routes import router as beneficiaries_router
from features.invoices.routes      import router as invoices_router
from features.decisions.routes     import router as decisions_router
from features.simulator.routes     import router as simulator_router
from features.audit.routes         import router as audit_router
from features.metrics.routes       import router as metrics_router

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Agent that decides which invoices to pay, hold or escalate.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(rules_router,         prefix="/rules",         tags=["rules"])
app.include_router(beneficiaries_router, prefix="/beneficiaries", tags=["beneficiaries"])
app.include_router(invoices_router,      prefix="/invoices",      tags=["invoices"])
app.include_router(decisions_router,     prefix="/decisions",     tags=["decisions"])
app.include_router(simulator_router,     prefix="/simulator",     tags=["simulator"])
app.include_router(audit_router,         prefix="/audit",         tags=["audit"])
app.include_router(metrics_router,       prefix="/metrics",       tags=["metrics"])

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "engine_version": settings.ENGINE_VERSION}
