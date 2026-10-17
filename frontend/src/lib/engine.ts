import { es } from "@/i18n/es";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import type {
  Decision,
  DecisionType,
  EvaluacionRegla,
  Factura,
  InvoiceEstado,
  RuleCode,
  Rules,
} from "@/types";

export const RULE_ORDER: RuleCode[] = [
  "DATOS_INCOMPLETOS",
  "CONFIANZA_BAJA",
  "MONEDA",
  "DUPLICADO",
  "BENEFICIARIO",
  "MONTO_ACORDADO",
  "LIMITE_PAGO",
  "APROBACION_HUMANA",
  "LIMITE_BENEFICIARIO",
  "PRESUPUESTO",
  "VENCIDA",
  "FRACCIONAMIENTO",
];

/** Rules whose failure blocks the payment outright; every other failure escalates to a human. */
export const FRENAR_RULES: RuleCode[] = ["DUPLICADO", "PRESUPUESTO"];

export interface HistoryItem {
  estado: InvoiceEstado;
  recibida: string;
  factura: Factura;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isPaid = (e: InvoiceEstado) => e === "pagada" || e === "aprobada_humano";

export function toUsd(monto: number | null, moneda: string, rules: Rules): number | null {
  if (monto == null) return null;
  if (moneda === "USD") return monto;
  const t = rules.tasas_cambio.find((x) => x.moneda === moneda);
  return t ? Math.round(monto * t.tasa_a_usd * 100) / 100 : null;
}

export function spentUsd(history: HistoryItem[]): number {
  return history.filter((h) => isPaid(h.estado)).reduce((s, h) => s + (h.factura.monto_usd ?? 0), 0);
}

const daysBetween = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

export function evaluate(
  input: Factura,
  recibida: string,
  rules: Rules,
  history: HistoryItem[],
): { factura: Factura; decision: Decision } {
  const factura: Factura = { ...input, monto_usd: toUsd(input.monto, input.moneda, rules) };
  const usd = factura.monto_usd;
  const m = (v: number) => formatMoney(v, "USD");
  const ben = rules.beneficiarios.find((b) => norm(b.nombre_mostrar) === norm(factura.beneficiario_texto));
  const nombre = factura.beneficiario_texto || es.explicacion.sinProveedor;
  const ev: EvaluacionRegla[] = [];
  const add = (regla: RuleCode, paso: boolean, detalle?: string) => ev.push({ regla, paso, detalle });
  const na = (regla: RuleCode) => add(regla, true, es.razones.NO_EVALUABLE);

  const completos = !!factura.numero && !!factura.beneficiario_texto && factura.monto != null;
  add("DATOS_INCOMPLETOS", completos, completos ? undefined : es.razones.DATOS_INCOMPLETOS);

  const conf = factura.confianza >= rules.confianza_minima;
  add(
    "CONFIANZA_BAJA",
    conf,
    conf ? undefined : es.razones.CONFIANZA_BAJA(formatPct(factura.confianza), formatPct(rules.confianza_minima)),
  );

  const monedaOk = rules.monedas_permitidas.includes(factura.moneda) && (factura.moneda === "USD" || usd != null || factura.monto == null);
  add("MONEDA", monedaOk, monedaOk ? undefined : es.razones.MONEDA(factura.moneda));

  if (factura.numero) {
    const dup = history.some(
      (h) =>
        h.estado !== "rechazada_humano" &&
        norm(h.factura.numero) === norm(factura.numero) &&
        norm(h.factura.beneficiario_texto) === norm(factura.beneficiario_texto) &&
        daysBetween(h.recibida, recibida) <= rules.ventana_duplicado_dias,
    );
    add("DUPLICADO", !dup, dup ? es.razones.DUPLICADO(factura.numero, rules.ventana_duplicado_dias) : undefined);
  } else na("DUPLICADO");

  if (!factura.beneficiario_texto) na("BENEFICIARIO");
  else if (!ben) add("BENEFICIARIO", false, es.razones.BENEFICIARIO_DESCONOCIDO(factura.beneficiario_texto));
  else if (!ben.activo) add("BENEFICIARIO", false, es.razones.BENEFICIARIO_INACTIVO(ben.nombre_mostrar));
  else add("BENEFICIARIO", true);

  if (usd == null) {
    (["MONTO_ACORDADO", "LIMITE_PAGO", "APROBACION_HUMANA", "LIMITE_BENEFICIARIO", "PRESUPUESTO"] as RuleCode[]).forEach(na);
  } else {
    if (ben) {
      const ok = Math.abs(usd - ben.monto_acordado) <= rules.tolerancia_monto;
      add("MONTO_ACORDADO", ok, ok ? undefined : es.razones.MONTO_ACORDADO(m(usd), m(ben.monto_acordado)));
    } else na("MONTO_ACORDADO");

    const lim = usd <= rules.limite_por_pago;
    add("LIMITE_PAGO", lim, lim ? undefined : es.razones.LIMITE_PAGO(m(usd), m(rules.limite_por_pago)));

    // Above the payment limit LIMITE_PAGO already escalates; avoid a redundant second reason.
    const apr = !(usd >= rules.aprobacion_humana_desde && usd <= rules.limite_por_pago);
    add("APROBACION_HUMANA", apr, apr ? undefined : es.razones.APROBACION_HUMANA(m(usd), m(rules.aprobacion_humana_desde)));

    if (ben) {
      const gastadoBen = spentUsd(history.filter((h) => norm(h.factura.beneficiario_texto) === norm(ben.nombre_mostrar)));
      const ok = gastadoBen + usd <= ben.limite_periodo;
      add("LIMITE_BENEFICIARIO", ok, ok ? undefined : es.razones.LIMITE_BENEFICIARIO(ben.nombre_mostrar, m(ben.limite_periodo)));
    } else na("LIMITE_BENEFICIARIO");

    const disponible = rules.presupuesto_periodo - spentUsd(history);
    const pres = usd <= disponible;
    add("PRESUPUESTO", pres, pres ? undefined : es.razones.PRESUPUESTO(m(usd), m(Math.max(disponible, 0))));
  }

  if (factura.vencimiento) {
    const ok = factura.vencimiento >= recibida.slice(0, 10);
    add("VENCIDA", ok, ok ? undefined : es.razones.VENCIDA(formatDate(factura.vencimiento)));
  } else na("VENCIDA");

  if (usd != null && factura.beneficiario_texto) {
    const recientes = history.filter(
      (h) =>
        isPaid(h.estado) &&
        norm(h.factura.beneficiario_texto) === norm(factura.beneficiario_texto) &&
        daysBetween(h.recibida, recibida) <= 7,
    );
    const suma = recientes.reduce((s, h) => s + (h.factura.monto_usd ?? 0), 0) + usd;
    const frac = recientes.length >= 2 && suma > rules.limite_por_pago && usd <= rules.limite_por_pago;
    add("FRACCIONAMIENTO", !frac, frac ? es.razones.FRACCIONAMIENTO(nombre) : undefined);
  } else na("FRACCIONAMIENTO");

  const fallidas = ev.filter((e) => !e.paso);
  let decision: DecisionType = "pagar";
  if (fallidas.some((f) => FRENAR_RULES.includes(f.regla))) decision = "frenar";
  else if (fallidas.length) decision = "escalar";

  const principal =
    decision === "frenar" ? fallidas.find((f) => FRENAR_RULES.includes(f.regla))! : fallidas[0];
  const lower = (s?: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");
  const explicacion_humana =
    decision === "pagar"
      ? es.explicacion.pagar(nombre, formatMoney(factura.monto, factura.moneda))
      : decision === "frenar"
        ? es.explicacion.frenar(nombre, lower(principal?.detalle))
        : es.explicacion.escalar(nombre, lower(principal?.detalle));

  return {
    factura,
    decision: {
      decision,
      razones: fallidas.map((f) => f.detalle!).filter(Boolean),
      reglas_aplicadas: fallidas.map((f) => f.regla),
      explicacion_humana,
      evaluacion: ev,
      snapshot_reglas: structuredClone(rules),
    },
  };
}

export const estadoFromDecision = (d: DecisionType): InvoiceEstado =>
  d === "pagar" ? "pagada" : d === "frenar" ? "frenada" : "escalada";
