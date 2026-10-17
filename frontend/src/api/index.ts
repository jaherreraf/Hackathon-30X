// API layer.
// getInvoices / getInvoice / resolveDecision hit the real FastAPI backend.
// Everything else stays mocked until those endpoints are implemented.
// Translation from the backend's English contract to the UI's Spanish
// domain types happens here, so views and components stay untouched.

import { uploadTemplates } from "@/data/mock";
import { usePayGuardStore } from "@/store/usePayGuardStore";
import type {
  ApiDecision,
  ApiInvoiceStatus,
  ApiRuleEvaluation,
  AuditEvent,
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
      if (body && typeof body === "object" && "detail" in body) detail = (body as { detail: unknown }).detail;
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
// Real endpoints (backend implemented)
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
  // Resolve by invoice id: fetch detail to discover decision.id, post, then re-fetch.
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

// ============================================================
// Mocked endpoints (backend not implemented yet)
// ============================================================

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const store = () => usePayGuardStore.getState();
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => structuredClone(v);

export async function getRules(): Promise<Rules> {
  console.warn("[api] getRules: backend endpoint not wired yet — using mock");
  await delay();
  return clone(store().rules);
}

export async function saveRules(rules: Rules): Promise<Rules> {
  console.warn("[api] saveRules: backend endpoint not wired yet — using mock");
  await delay(500);
  store().setRules(clone(rules));
  store().addAudit({
    id: uid(),
    evento: "reglas_actualizadas",
    entidad: rules.nombre_empresa,
    fecha: new Date().toISOString(),
    detalle: { reglas: rules },
  });
  return clone(rules);
}

export async function uploadInvoice(input: UploadInput): Promise<InvoiceItem> {
  console.warn("[api] uploadInvoice: backend POST /invoices not wired yet — using mock");
  await delay(1500);
  const t = uploadTemplates[Math.floor(Math.random() * uploadTemplates.length)]!;
  const item: InvoiceItem = {
    id: `inv-${uid()}`,
    recibida: new Date().toISOString(),
    estado: "escalada",
    factura: { ...t, monto_usd: t.monto },
    decision: {
      decision: "escalar",
      razones: ["Mock: backend POST /invoices not implemented yet."],
      reglas_aplicadas: [],
      explicacion_humana: "",
      evaluacion: [],
      snapshot_reglas: emptyRulesSnapshot(),
    },
  };
  store().addInvoice(item);
  return clone(item);
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
  console.warn("[api] simulate: backend endpoint not wired yet — returning empty");
  await delay(300);
  return [];
}

export async function getMetrics(): Promise<Metrics> {
  console.warn("[api] getMetrics: backend endpoint not wired yet — using mock");
  await delay();
  return computeMetrics(store().invoices, store().rules);
}

export async function getAudit(): Promise<AuditEvent[]> {
  console.warn("[api] getAudit: backend endpoint not wired yet — using mock");
  await delay();
  return clone(store().audit).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
