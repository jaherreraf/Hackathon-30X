import { estadoFromDecision, evaluate, type HistoryItem } from "@/lib/engine";
import type { AuditEvent, Factura, InvoiceItem, Rules } from "@/types";

export const defaultRules: Rules = {
  nombre_empresa: "Acme Corp",
  periodo: "2026-10",
  limite_por_pago: 3000,
  aprobacion_humana_desde: 1500,
  presupuesto_periodo: 6000,
  monedas_permitidas: ["USD", "EUR"],
  tolerancia_monto: 0,
  ventana_duplicado_dias: 30,
  confianza_minima: 0.7,
  tasas_cambio: [{ moneda: "EUR", tasa_a_usd: 1.08 }],
  beneficiarios: [
    { nombre_mostrar: "Diseños Lumen", monto_acordado: 800, limite_periodo: 2000, activo: true },
    { nombre_mostrar: "CloudHost", monto_acordado: 1200, limite_periodo: 4000, activo: true },
    { nombre_mostrar: "Ana Pérez", monto_acordado: 2500, limite_periodo: 6000, activo: true },
    { nombre_mostrar: "Consultora Zeta", monto_acordado: 3500, limite_periodo: 5000, activo: true },
  ],
};

type Raw = {
  id: string;
  recibida: string;
  factura: Omit<Factura, "monto_usd">;
  resolucion?: InvoiceItem["resolucion"];
};

const f = (
  numero: string | null,
  beneficiario_texto: string | null,
  monto: number | null,
  moneda: string,
  vencimiento: string,
  origen: Factura["origen"],
  confianza: number,
): Omit<Factura, "monto_usd"> => ({ numero, beneficiario_texto, monto, moneda, vencimiento, origen, confianza });

/** Processed in order: each decision sees the invoices before it. */
export const rawInvoices: Raw[] = [
  { id: "inv-01", recibida: "2026-10-01T09:12:00Z", factura: f("L-001", "Diseños Lumen", 800, "USD", "2026-10-20", "pdf", 0.97) },
  { id: "inv-02", recibida: "2026-10-02T10:30:00Z", factura: f("CL-88", "CloudHost", 1200, "USD", "2026-10-25", "correo", 0.95) },
  { id: "inv-03", recibida: "2026-10-03T08:45:00Z", factura: f("L-001", "Diseños Lumen", 800, "USD", "2026-10-20", "correo", 0.93) },
  { id: "inv-04", recibida: "2026-10-04T15:02:00Z", factura: f("X-9", "Empresa Nueva SA", 500, "USD", "2026-10-30", "chat", 0.88) },
  { id: "inv-05", recibida: "2026-10-05T09:05:00Z", factura: f("C-5", "CloudHost", 1900, "USD", "2026-11-02", "pdf", 0.94) },
  { id: "inv-06", recibida: "2026-10-06T13:15:00Z", factura: f("Z-3", "Consultora Zeta", 3500, "USD", "2026-11-05", "pdf", 0.91) },
  { id: "inv-07", recibida: "2026-10-07T17:48:00Z", factura: f(null, "CloudHost", 1200, "USD", "2026-11-08", "chat", 0.74) },
  { id: "inv-08", recibida: "2026-10-08T10:00:00Z", factura: f("AP-21", "Ana Pérez", 9_800_000, "COP", "2026-11-10", "correo", 0.9) },
  {
    id: "inv-09",
    recibida: "2026-10-09T11:20:00Z",
    factura: f("A-7", "Ana Pérez", 2500, "USD", "2026-10-31", "pdf", 0.96),
    resolucion: { tipo: "aprobada", usuario: "María López", comentario: "Honorarios de octubre, verificados.", fecha: "2026-10-09T16:40:00Z" },
  },
  { id: "inv-10", recibida: "2026-10-12T12:30:00Z", factura: f("A-8", "Ana Pérez", 2500, "USD", "2026-11-12", "pdf", 0.95) },
];

export function buildInvoices(rules: Rules, raws: Raw[] = rawInvoices): InvoiceItem[] {
  const history: HistoryItem[] = [];
  const out: InvoiceItem[] = [];
  for (const r of raws) {
    const { factura, decision } = evaluate({ ...r.factura, monto_usd: null }, r.recibida, rules, history);
    let estado = estadoFromDecision(decision.decision);
    if (decision.decision === "escalar" && r.resolucion)
      estado = r.resolucion.tipo === "aprobada" ? "aprobada_humano" : "rechazada_humano";
    const item: InvoiceItem = { id: r.id, recibida: r.recibida, estado, factura, decision, resolucion: r.resolucion };
    out.push(item);
    history.push(item);
  }
  return out;
}

export function buildAudit(invoices: InvoiceItem[]): AuditEvent[] {
  const ev: AuditEvent[] = [];
  invoices.forEach((inv) => {
    const entidad = inv.factura.numero ?? inv.id;
    ev.push({
      id: `${inv.id}-r`,
      evento: "factura_recibida",
      entidad,
      fecha: inv.recibida,
      detalle: { factura: inv.factura },
    });
    ev.push({
      id: `${inv.id}-d`,
      evento: "decision_tomada",
      entidad,
      fecha: new Date(new Date(inv.recibida).getTime() + 4000).toISOString(),
      detalle: { decision: inv.decision.decision, reglas: inv.decision.reglas_aplicadas, razones: inv.decision.razones },
    });
    if (inv.resolucion)
      ev.push({ id: `${inv.id}-h`, evento: "resolucion_humana", entidad, fecha: inv.resolucion.fecha, detalle: { ...inv.resolucion } as Record<string, unknown> });
  });
  return ev.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Templates used by the mock upload when the text gives no usable clues. */
export const uploadTemplates: Omit<Factura, "monto_usd">[] = [
  f("L-014", "Diseños Lumen", 800, "USD", "2026-11-15", "pdf", 0.95),
  f("N-2", "Servicios Delta", 640, "USD", "2026-11-18", "pdf", 0.86),
  f("CL-91", "CloudHost", 1200, "USD", "2026-11-20", "pdf", 0.62),
  f("E-40", "Diseños Lumen", 740.74, "EUR", "2026-11-22", "imagen", 0.9),
];

export const marqueeSuppliers = [
  "Diseños Lumen",
  "CloudHost",
  "Ana Pérez",
  "Empresa Nueva SA",
  "Consultora Zeta",
  "Servicios Delta",
  "Logística Norte",
  "Papelería Sol",
];
