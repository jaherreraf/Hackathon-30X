// API layer.
// This is the ONLY file that talks to the FastAPI backend.
// Every function here translates between:
//   - the backend's English JSON contract (FastAPI / Pydantic schemas)
//   - the UI's Spanish domain types (src/types.ts: Factura, Decision, Rules, ...)
// Views, components and hooks import from here; they never fetch directly.

import { uploadTemplates } from "@/data/mock";
import { usePayGuardStore } from "@/store/usePayGuardStore";
import type {
  ApiDecision,
  ApiInvoiceStatus,
  ApiRuleEvaluation,
  AuditEvent,
  Beneficiario,
  Decision,
  DecisionData,
  EvaluacionRegla,
  Factura,
  InvoiceDetailOut,
  InvoiceEstado,
  InvoiceItem,
  InvoiceListItem,
  Metrics,
  Origen,
  ResolveOut,
  RuleCode,
  Rules,
  SimulationRow,
  TasaCambio,
  UploadInput,
} from "@/types";

// ============================================================
// HTTP client
// ============================================================

const API_BASE: string =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = (body as { detail: unknown }).detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : `http_${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============================================================
// Backend (English) -> UI (Spanish) mappers
// ============================================================

function mapDecision(d: ApiDecision): Decision["decision"] {
  switch (d) {
    case "pay":
      return "pagar";
    case "hold":
      return "frenar";
    case "escalate":
      return "escalar";
  }
}

function mapStatus(s: ApiInvoiceStatus): InvoiceEstado {
  switch (s) {
    case "paid":
      return "pagada";
    case "held":
      return "frenada";
    case "escalated":
      return "escalada";
    case "approved_by_human":
      return "aprobada_humano";
    case "rejected_by_human":
      return "rechazada_humano";
  }
}

const RULE_CODE_MAP: Record<string, RuleCode> = {
  INCOMPLETE_DATA: "DATOS_INCOMPLETOS",
  LOW_CONFIDENCE: "CONFIANZA_BAJA",
  CURRENCY: "MONEDA",
  DUPLICATE: "DUPLICADO",
  BENEFICIARY: "BENEFICIARIO",
  AGREED_AMOUNT: "MONTO_ACORDADO",
  PAYMENT_LIMIT: "LIMITE_PAGO",
  HUMAN_APPROVAL: "APROBACION_HUMANA",
  BENEFICIARY_LIMIT: "LIMITE_BENEFICIARIO",
  BUDGET: "PRESUPUESTO",
  OVERDUE: "VENCIDA",
  SPLITTING: "FRACCIONAMIENTO",
};

function mapRuleCode(code: string): RuleCode {
  return RULE_CODE_MAP[code] ?? "DATOS_INCOMPLETOS";
}

function mapApiEvaluation(items: ApiRuleEvaluation[]): EvaluacionRegla[] {
  return items.map((e) => ({
    regla: mapRuleCode(e.rule),
    paso: e.passed,
    detalle: e.detail ?? undefined,
  }));
}

function mapOrigen(s: string): Origen {
  if (s === "pdf") return "pdf";
  if (s === "image") return "imagen";
  return "correo";
}

function emptyRulesSnapshot(): Rules {
  return {
    nombre_empresa: "",
    periodo: "",
    limite_por_pago: 0,
    aprobacion_humana_desde: 0,
    presupuesto_periodo: 0,
    monedas_permitidas: [],
    tolerancia_monto: 0,
    ventana_duplicado_dias: 0,
    confianza_minima: 0,
    tasas_cambio: [],
    beneficiarios: [],
  };
}

// ============================================================
// /rules + /beneficiaries <-> Rules  mappers
// ============================================================

interface ApiRuleOut {
  id: number;
  company_name: string;
  period: string;
  per_payment_limit: number;
  human_approval_threshold: number;
  period_budget: number;
  allowed_currencies: string[];
  amount_tolerance: number;
  duplicate_window_days: number;
  min_confidence: number;
  active: boolean;
  created_at: string;
  exchange_rates: { currency: string; rate_to_usd: number; id: number }[];
}

interface ApiBeneficiario {
  id: number;
  normalized_name: string;
  display_name: string;
  agreed_amount: number;
  period_limit: number;
  active: boolean;
}

function apiRuleToRules(api: ApiRuleOut, beneficiarios: Beneficiario[]): Rules {
  return {
    nombre_empresa: api.company_name,
    periodo: api.period,
    limite_por_pago: api.per_payment_limit,
    aprobacion_humana_desde: api.human_approval_threshold,
    presupuesto_periodo: api.period_budget,
    monedas_permitidas: api.allowed_currencies,
    tolerancia_monto: api.amount_tolerance,
    ventana_duplicado_dias: api.duplicate_window_days,
    confianza_minima: api.min_confidence,
    tasas_cambio: api.exchange_rates.map((e) => ({
      moneda: e.currency,
      tasa_a_usd: e.rate_to_usd,
    })),
    beneficiarios,
  };
}

function rulesToApiBody(rules: Rules) {
  // Only the fields PUT /rules accepts. Beneficiarios go via POST /beneficiaries.
  return {
    company_name: rules.nombre_empresa,
    period: rules.periodo,
    per_payment_limit: rules.limite_por_pago,
    human_approval_threshold: rules.aprobacion_humana_desde,
    period_budget: rules.presupuesto_periodo,
    allowed_currencies: rules.monedas_permitidas,
    amount_tolerance: rules.tolerancia_monto,
    duplicate_window_days: rules.ventana_duplicado_dias,
    min_confidence: rules.confianza_minima,
    exchange_rates: rules.tasas_cambio.map((t) => ({
      currency: t.moneda,
      rate_to_usd: t.tasa_a_usd,
    })),
  };
}

// ============================================================
// /metrics  <->  Metrics
// ============================================================

interface ApiMetrics {
  total: number;
  paid: number;
  held: number;
  escalated: number;
  pending: number;
  human_approved: number;
  human_rejected: number;
  autonomy: number;
  payments_outside_rules: number;
  period_budget: number;
  spent_budget: number;
  available_budget: number;
}

// ============================================================
// /audit  <->  AuditEvent
// ============================================================

interface ApiAuditEvent {
  id: number;
  event: string;
  entity: string;
  entity_id: number;
  detail: Record<string, unknown>;
  created_at: string;
}

const AUDIT_EVENT_MAP: Record<string, AuditEvent["evento"]> = {
  invoice_received: "factura_recibida",
  data_extracted: "decision_tomada",
  decision_taken: "decision_tomada",
  human_approval: "resolucion_humana",
  rules_modified: "reglas_actualizadas",
  rules_created: "reglas_actualizadas",
};

// ============================================================
// /invoices  ->  InvoiceItem
// ============================================================

function listItemToInvoiceItem(d: InvoiceListItem): InvoiceItem {
  return {
    id: String(d.id),
    recibida: d.created_at,
    estado: mapStatus(d.status),
    factura: {
      numero: d.number,
      beneficiario_texto: d.beneficiary,
      monto: d.amount_usd,
      moneda: "USD",
      monto_usd: d.amount_usd,
      vencimiento: null,
      origen: "correo",
      confianza: 0,
    },
    decision: {
      decision: mapDecision(d.decision),
      razones: d.reason_summary ? [d.reason_summary] : [],
      reglas_aplicadas: [],
      explicacion_humana: d.reason_summary ?? "",
      evaluacion: [],
      snapshot_reglas: emptyRulesSnapshot(),
    },
  };
}

function detailToInvoiceItem(d: InvoiceDetailOut): InvoiceItem {
  return {
    id: String(d.id),
    recibida: d.decision.created_at ?? new Date().toISOString(),
    estado: mapStatus(d.status),
    factura: {
      numero: d.invoice.number,
      beneficiario_texto: d.invoice.beneficiary_text,
      monto: d.invoice.amount,
      moneda: d.invoice.currency ?? "USD",
      monto_usd: d.invoice.amount_usd,
      vencimiento: d.invoice.due_date,
      origen: mapOrigen(d.invoice.source),
      confianza: d.invoice.confidence ?? 0,
    },
    decision: {
      decision: mapDecision(d.decision.decision),
      razones: d.decision.reasons,
      reglas_aplicadas: d.decision.applied_rules.map(mapRuleCode),
      explicacion_humana: d.decision.human_explanation,
      evaluacion: mapApiEvaluation(d.decision.evaluation),
      snapshot_reglas: emptyRulesSnapshot(),
    },
  };
}

// ============================================================
// Real endpoints (all implemented on the backend)
// ============================================================

export async function getInvoices(): Promise<InvoiceItem[]> {
  const data = await http<InvoiceListItem[]>("/invoices");
  return data.map(listItemToInvoiceItem);
}

export async function getInvoice(id: string): Promise<InvoiceItem> {
  const data = await http<InvoiceDetailOut>(`/invoices/${Number(id)}`);
  return detailToInvoiceItem(data);
}

export async function resolveDecision(
  id: string,
  tipo: "aprobada" | "rechazada",
  usuario: string,
  comentario?: string,
): Promise<InvoiceItem> {
  const detail = await http<InvoiceDetailOut>(`/invoices/${Number(id)}`);
  const decisionId = detail.decision.id;
  const action = tipo === "aprobada" ? "approve" : "reject";
  await http<ResolveOut>(`/decisions/${decisionId}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      action,
      user: usuario,
      comment: comentario ?? null,
    }),
  });
  return getInvoice(id);
}

export async function getRules(): Promise<Rules> {
  const [apiRule, apiBeneficiarios] = await Promise.all([
    http<ApiRuleOut>("/rules"),
    http<ApiBeneficiario[]>("/beneficiaries"),
  ]);
  const beneficiarios: Beneficiario[] = apiBeneficiarios.map((b) => ({
    nombre_mostrar: b.display_name,
    monto_acordado: b.agreed_amount,
    limite_periodo: b.period_limit,
    activo: b.active,
  }));
  return apiRuleToRules(apiRule, beneficiarios);
}

export async function saveRules(rules: Rules): Promise<Rules> {
  await http<ApiRuleOut>("/rules", {
    method: "PUT",
    body: JSON.stringify(rulesToApiBody(rules)),
  });
  return getRules();
}

export async function getMetrics(): Promise<Metrics> {
  const api = await http<ApiMetrics>("/metrics");
  return {
    total: api.total,
    pagadas: api.paid + api.human_approved,
    frenadas: api.held + api.human_rejected,
    escaladas: api.escalated,
    pendientes: api.pending,
    autonomia: api.autonomy,
    pagos_fuera_de_reglas: api.payments_outside_rules,
    presupuesto_total: api.period_budget,
    presupuesto_gastado: api.spent_budget,
    presupuesto_disponible: api.available_budget,
  };
}

export async function getAudit(): Promise<AuditEvent[]> {
  const api = await http<ApiAuditEvent[]>("/audit");
  return api.map((e) => ({
    id: String(e.id),
    evento: AUDIT_EVENT_MAP[e.event] ?? "decision_tomada",
    entidad: e.entity,
    fecha: e.created_at,
    detalle: e.detail,
  }));
}

// ============================================================
// Still mocked (backend endpoint not consumed by UI yet)
// ============================================================

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const store = () => usePayGuardStore.getState();
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => structuredClone(v);


export async function uploadInvoice(input: UploadInput): Promise<InvoiceItem> {
  const form = new FormData();

  if (input.tipo === "texto") {
    form.append("source", "text");
    form.append("text", input.texto ?? "");
  } else {
    const isPdf = input.nombreArchivo?.toLowerCase().endsWith(".pdf");
    form.append("source", isPdf ? "pdf" : "image");
    if (!input.file) {
      throw new Error("No file provided");
    }
    form.append("file", input.file);
  }

  const res = await fetch(`${API_BASE}/invoices`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail: unknown = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = (body as { detail: unknown }).detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : `http_${res.status}`);
  }
  const detail = (await res.json()) as InvoiceDetailOut;
  return detailToInvoiceItem(detail);
}
export function computeMetrics(invoices: InvoiceItem[], rules: Rules): Metrics {
  const total = invoices.length;
  const pagadas = invoices.filter(
    (i) => i.estado === "pagada" || i.estado === "aprobada_humano",
  ).length;
  const frenadas = invoices.filter(
    (i) => i.estado === "frenada" || i.estado === "rechazada_humano",
  ).length;
  const escaladas = invoices.filter((i) => i.decision.decision === "escalar").length;
  const pendientes = invoices.filter((i) => i.estado === "escalada").length;
  const gastado = invoices
    .filter((i) => i.estado === "pagada" || i.estado === "aprobada_humano")
    .reduce((acc, i) => acc + (i.factura.monto_usd ?? 0), 0);
  const presupuesto = rules.presupuesto_periodo || 0;
  return {
    total,
    pagadas,
    frenadas,
    escaladas,
    pendientes,
    autonomia: total ? (total - escaladas) / total : 0,
    pagos_fuera_de_reglas: 0,
    presupuesto_total: presupuesto,
    presupuesto_gastado: gastado,
    presupuesto_disponible: Math.max(presupuesto - gastado, 0),
  };
}

export async function simulate(_rules: Rules): Promise<SimulationRow[]> {
  console.warn("[api] simulate: POST /simulator not wired in UI yet — returning empty");
  await delay(300);
  return [];
}
