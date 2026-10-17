// Mock data layer. Later each function becomes a fetch to `${import.meta.env.VITE_API_URL}`.
import { uploadTemplates } from "@/data/mock";
import { estadoFromDecision, evaluate, spentUsd, type HistoryItem } from "@/lib/engine";
import { usePayGuardStore } from "@/store/usePayGuardStore";
import type {
  AuditEvent,
  Factura,
  InvoiceItem,
  Metrics,
  Rules,
  SimulationRow,
  UploadInput,
} from "@/types";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const store = () => usePayGuardStore.getState();
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => structuredClone(v);

export async function getRules(): Promise<Rules> {
  await delay();
  return clone(store().rules);
}

export async function saveRules(rules: Rules): Promise<Rules> {
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

export async function getInvoices(): Promise<InvoiceItem[]> {
  await delay();
  return clone(store().invoices).reverse();
}

export async function getInvoice(id: string): Promise<InvoiceItem> {
  await delay();
  const inv = store().invoices.find((i) => i.id === id);
  if (!inv) throw new Error("not_found");
  return clone(inv);
}

function parseText(texto: string, rules: Rules): Omit<Factura, "monto_usd"> | null {
  const ben = rules.beneficiarios.find((b) => texto.toLowerCase().includes(b.nombre_mostrar.toLowerCase()));
  const amount = texto.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?)/g);
  const numero = texto.match(/\b([A-Z]{1,3}-\d{1,5})\b/);
  const moneda = /\bEUR\b|€/i.test(texto) ? "EUR" : /\bCOP\b/i.test(texto) ? "COP" : "USD";
  const venc = texto.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (!ben && !numero) return null;
  const nums = (amount ?? [])
    .map((a) => Number(a.replace(/,(?=\d{3})/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")))
    .filter((n) => n >= 10 && !(venc?.[1] && venc[1].includes(String(n))));
  return {
    numero: numero?.[1] ?? null,
    beneficiario_texto: ben?.nombre_mostrar ?? texto.match(/de ([A-ZÁÉÍÓÚ][\w\s]+?SA)\b/)?.[1] ?? null,
    monto: nums.length ? Math.max(...nums) : null,
    moneda,
    vencimiento: venc?.[1] ?? "2026-11-15",
    origen: /chat|whatsapp/i.test(texto) ? "chat" : "correo",
    confianza: 0.88,
  };
}

export async function uploadInvoice(input: UploadInput): Promise<InvoiceItem> {
  await delay(1500);
  const s = store();
  let raw =
    input.tipo === "texto" && input.texto ? parseText(input.texto, s.rules) : null;
  if (!raw) {
    const t = uploadTemplates[Math.floor(Math.random() * uploadTemplates.length)]!;
    raw = {
      ...t,
      numero: t.numero ? `${t.numero.split("-")[0]}-${100 + Math.floor(Math.random() * 900)}` : null,
      origen: input.tipo === "archivo" ? (input.nombreArchivo?.toLowerCase().endsWith(".pdf") ? "pdf" : "imagen") : t.origen,
    };
  }
  const recibida = new Date().toISOString();
  const { factura, decision } = evaluate({ ...raw, monto_usd: null }, recibida, s.rules, s.invoices);
  const item: InvoiceItem = { id: `inv-${uid()}`, recibida, estado: estadoFromDecision(decision.decision), factura, decision };
  s.addInvoice(item);
  const entidad = factura.numero ?? item.id;
  s.addAudit({ id: uid(), evento: "factura_recibida", entidad, fecha: recibida, detalle: { factura, input: input.tipo } });
  s.addAudit({
    id: uid(),
    evento: "decision_tomada",
    entidad,
    fecha: new Date(Date.now() + 1).toISOString(),
    detalle: { decision: decision.decision, reglas: decision.reglas_aplicadas, razones: decision.razones },
  });
  return clone(item);
}

export async function resolveDecision(
  id: string,
  tipo: "aprobada" | "rechazada",
  usuario: string,
  comentario?: string,
): Promise<InvoiceItem> {
  await delay(500);
  const s = store();
  const inv = s.invoices.find((i) => i.id === id);
  if (!inv) throw new Error("not_found");
  if (inv.estado !== "escalada") throw new Error("only_escalated");
  if (!usuario.trim()) throw new Error("usuario_required");
  const resolucion: InvoiceItem["resolucion"] & {} = { tipo, usuario: usuario.trim(), ...(comentario?.trim() ? { comentario: comentario.trim() } : {}), fecha: new Date().toISOString() };
  const updated: InvoiceItem = {
    ...inv,
    estado: tipo === "aprobada" ? "aprobada_humano" : "rechazada_humano",
    resolucion,
  };
  s.updateInvoice(updated);
  s.addAudit({ id: uid(), evento: "resolucion_humana", entidad: inv.factura.numero ?? inv.id, fecha: resolucion.fecha, detalle: { ...resolucion } });
  return clone(updated);
}

export async function simulate(rules: Rules): Promise<SimulationRow[]> {
  await delay(700);
  const history: HistoryItem[] = [];
  return store().invoices.map((inv) => {
    const { factura, decision } = evaluate(inv.factura, inv.recibida, rules, history);
    // Simulated escalations keep the human outcome they actually received.
    let estado = estadoFromDecision(decision.decision);
    if (decision.decision === "escalar" && inv.resolucion)
      estado = inv.resolucion.tipo === "aprobada" ? "aprobada_humano" : "rechazada_humano";
    history.push({ estado, recibida: inv.recibida, factura });
    return {
      invoice: clone(inv),
      actual: inv.decision.decision,
      simulada: decision.decision,
      razones_simuladas: decision.razones,
      cambia: inv.decision.decision !== decision.decision,
    };
  });
}

export function computeMetrics(invoices: InvoiceItem[], rules: Rules): Metrics {
  const total = invoices.length;
  const pagadas = invoices.filter((i) => i.estado === "pagada" || i.estado === "aprobada_humano").length;
  const frenadas = invoices.filter((i) => i.estado === "frenada" || i.estado === "rechazada_humano").length;
  const escaladas = invoices.filter((i) => i.decision.decision === "escalar").length;
  const pendientes = invoices.filter((i) => i.estado === "escalada").length;
  const gastado = spentUsd(invoices);
  return {
    total,
    pagadas,
    frenadas,
    escaladas,
    pendientes,
    autonomia: total ? (total - escaladas) / total : 0,
    // A payment is "outside the rules" only if paid while some rule failed and no human approved it.
    pagos_fuera_de_reglas: invoices.filter((i) => i.estado === "pagada" && i.decision.reglas_aplicadas.length > 0).length,
    presupuesto_total: rules.presupuesto_periodo,
    presupuesto_gastado: gastado,
    presupuesto_disponible: rules.presupuesto_periodo - gastado,
  };
}

export async function getMetrics(): Promise<Metrics> {
  await delay();
  return computeMetrics(store().invoices, store().rules);
}

export async function getAudit(): Promise<AuditEvent[]> {
  await delay();
  return clone(store().audit).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
