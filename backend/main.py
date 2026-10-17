from datetime import date
from pydantic import BaseModel
 
class FacturaExtraida(BaseModel):
    numero: str | None = None
    beneficiario: str | None = None
    monto: float | None = None
    moneda: str | None = None
    vencimiento: date | None = None
    confianza: float = 0.0
 
class EvaluacionRegla(BaseModel):
    regla: str          # "MONTO_ACORDADO"
    paso: bool          # True = cumple
    efecto: str | None  # "frenar" | "escalar" si fallo
    detalle: str | None # texto de la razon
 
class ResultadoDecision(BaseModel):
    decision: str                       # "pagar" | "frenar" | "escalar"
    razones: list[str]
    reglas_aplicadas: list[str]         # codigos que fallaron
    evaluacion: list[EvaluacionRegla]   # TODAS las reglas

