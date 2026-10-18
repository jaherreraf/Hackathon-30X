// ============================================================
// UI / Domain types (Spanish) — used by components and views.
// These stay as-is. The backend contract lives at the bottom.
// ============================================================

export type Moneda = string;

export interface TasaCambio {
  moneda: Moneda;
  tasa_a_usd: number;
}

export interface Beneficiario {
  nombre_mostrar: string;
  monto_acordado: number;
  limite_periodo: number;
  activo: boolean;
}

export interface Rules {
  nombre_empresa: string;
  periodo: string;
  limite_por_pago: number;
  aprobacion_humana_desde: number;
  presupuesto_periodo: number;
  monedas_permitidas: Moneda[];
  tolerancia_monto: number;
  ventana_duplicado_dias: number;
  confianza_minima: number;
  tasas_cambio: TasaCambio[];
  beneficiarios: Beneficiario[];
}

export type RuleCode =
  | "DATOS_INCOMPLETOS"
  | "CONFIANZA_BAJA"
  | "MONEDA"
  | "DUPLICADO"
  | "BENEFICIARIO"
  | "MONTO_ACORDADO"
  | "LIMITE_PAGO"
  | "APROBACION_HUMANA"
  | "LIMITE_BENEFICIARIO"
  | "PRESUPUESTO"
  | "VENCIDA"
  | "FRACCIONAMIENTO";

export type DecisionType = "pagar" | "frenar" | "escalar";
export type InvoiceEstado =
  | "pagada"
  | "frenada"
  | "escalada"
  | "aprobada_humano"
  | "rechazada_humano";

export type Origen = "pdf" | "imagen" | "correo" | "chat";

export interface Factura {
  numero: string | null;
  beneficiario_texto: string | null;
  monto: number | null;
  moneda: Moneda;
  monto_usd: number | null;
  vencimiento: string | null;
  origen: Origen;
  confianza: number;
}

export interface EvaluacionRegla {
  regla: RuleCode;
  paso: boolean;
  detalle?: string | undefined;
}

export interface Decision {
  decision: DecisionType;
  razones: string[];
  reglas_aplicadas: RuleCode[];
  explicacion_humana: string;
  evaluacion: EvaluacionRegla[];
  snapshot_reglas: Rules;
}

export interface Resolucion {
  tipo: "aprobada" | "rechazada";
  usuario: string;
  comentario?: string | undefined;
  fecha: string;
}

export interface InvoiceItem {
  id: string;
  recibida: string;
  estado: InvoiceEstado;
  factura: Factura;
  decision: Decision;
  resolucion?: Resolucion | undefined;
}

export interface AuditEvent {
  id: string;
  evento:
    | "factura_recibida"
    | "decision_tomada"
    | "resolucion_humana"
    | "reglas_actualizadas";
  entidad: string;
  fecha: string;
  detalle: Record<string, unknown>;
}

export interface Metrics {
  total: number;
  pagadas: number;
  frenadas: number;
  escaladas: number;
  pendientes: number;
  autonomia: number;
  pagos_fuera_de_reglas: number;
  presupuesto_total: number;
  presupuesto_gastado: number;
  presupuesto_disponible: number;
}

export interface UploadInput {
  tipo: "archivo" | "texto";
  nombreArchivo?: string;
  texto?: string;
  file?: File;        // ← agregar esta línea
}

export interface SimulationRow {
  invoice: InvoiceItem;
  actual: DecisionType;
  simulada: DecisionType;
  razones_simuladas: string[];
  cambia: boolean;
}

// ============================================================
// Backend contract types (English) — mirrors FastAPI schemas.
// Used ONLY in src/api/index.ts to talk to the backend.
// The rest of the app keeps using the Spanish domain types above.
// ============================================================

export type ApiDecision = "pay" | "hold" | "escalate";

export type ApiInvoiceStatus =
  | "paid"
  | "held"
  | "escalated"
  | "approved_by_human"
  | "rejected_by_human";

export type ApiInvoiceSource = "pdf" | "image" | "text";

export interface InvoiceListItem {
  id: number;
  number: string | null;
  beneficiary: string | null;
  amount_usd: number | null;
  decision: ApiDecision;
  reason_summary: string | null;
  status: ApiInvoiceStatus;
  created_at: string;
}

export interface InvoiceData {
  number: string | null;
  beneficiary_text: string | null;
  beneficiary_id: number | null;
  amount: number | null;
  currency: string | null;
  amount_usd: number | null;
  due_date: string | null;
  source: ApiInvoiceSource;
  confidence: number | null;
}

export interface ApiRuleEvaluation {
  rule: string;
  passed: boolean;
  effect: "hold" | "escalate" | null;
  detail: string | null;
}

export interface DecisionData {
  id: number;
  decision: ApiDecision;
  reasons: string[];
  applied_rules: string[];
  human_explanation: string;
  evaluation: ApiRuleEvaluation[];
  rules_snapshot: Record<string, unknown>;
  engine_version: string;
  created_at: string | null;
}

export interface InvoiceDetailOut {
  id: number;
  status: ApiInvoiceStatus;
  invoice: InvoiceData;
  decision: DecisionData;
}

export interface ResolveOut {
  decision_id: number;
  invoice_id: number;
  action: "approve" | "reject";
  new_status: "approved_by_human" | "rejected_by_human";
}
