import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { getAudit, getInvoices, getMetrics, getRules, saveRules, simulate } from "@/api";
import { InvoiceRow } from "@/components/InvoiceRow";
import { ResolveActions } from "@/components/ResolveDialog";
import { CheckOption, DecisionBadge, EmptyState, ErrorState, FloatCard, LoadingState, MetricStrip, Money, PageHero, PillButton, PillLink, RowsPanel, Section } from "@/components/ui-kit";
import { useApi } from "@/hooks/useApi";
import { es } from "@/i18n/es";
import { formatDateTime, formatMoney, formatPct } from "@/lib/format";
import type { Rules, SimulationRow } from "@/types";

export function ColaPage() {
  const { data, loading, error, reload } = useApi(getInvoices);
  const pend = (data ?? []).filter((i) => i.estado === "escalada");
  const total = pend.reduce((s, i) => s + (i.factura.monto_usd ?? 0), 0);
  return (
    <>
      <PageHero eyebrow={es.cola.eyebrow} title={es.cola.titulo} subtitle={es.cola.subtitulo} cta={<PillLink to="/reglas">{es.cola.cta}</PillLink>}
        visual={<FloatCard><p className="text-sm text-muted-foreground">{es.cola.montoPendiente}</p><Money value={total} className="mt-2 block text-5xl font-light" /><p className="mt-4 text-muted-foreground">{es.cola.pendientes}: {pend.length}</p></FloatCard>} />
      <Section title={es.cola.listaTitulo}>
        <RowsPanel>
          {loading ? <LoadingState /> : error ? <ErrorState onRetry={reload} /> : pend.length === 0 ? <EmptyState title={es.cola.vacioTitulo} sub={es.cola.vacioSub} /> : pend.map((i) => (
            <div key={i.id} className="border-b border-border last:border-0">
              <InvoiceRow inv={i} compact />
              <div className="flex flex-col gap-3 px-4 pb-4 md:flex-row md:items-center md:justify-between md:px-6">
                <ul className="list-disc pl-5 text-sm text-muted-foreground">{i.decision.razones.map((r) => <li key={r}>{r}</li>)}</ul>
                <ResolveActions inv={i} />
              </div>
            </div>
          ))}
        </RowsPanel>
      </Section>
    </>
  );
}

const NUM_FIELDS = ["limite_por_pago", "aprobacion_humana_desde", "presupuesto_periodo", "tolerancia_monto", "ventana_duplicado_dias", "confianza_minima"] as const;
const inputCls = "h-12 w-full rounded-2xl border border-border bg-card px-4 outline-none focus:border-primary";

function RulesForm({ value, onChange }: { value: Rules; onChange: (r: Rules) => void }) {
  const c = es.reglasPage.campos;
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm">{c.nombre_empresa}<input className={inputCls + " mt-2"} value={value.nombre_empresa} onChange={(e) => set("nombre_empresa", e.target.value)} /></label>
        <label className="text-sm">{c.periodo}<input className={inputCls + " mt-2"} value={value.periodo} onChange={(e) => set("periodo", e.target.value)} /></label>
        {NUM_FIELDS.map((k) => <label key={k} className="text-sm">{c[k]}<input type="number" step="any" className={inputCls + " mt-2 tabular"} value={value[k]} onChange={(e) => set(k, Number(e.target.value))} /></label>)}
      </div>
      <div><p className="mb-3">{es.reglasPage.monedas}</p><div className="grid gap-3 sm:grid-cols-3">
        {["USD", "EUR", "COP"].map((m) => (
          <CheckOption
            key={m}
            title={m}
            selected={value.monedas_permitidas.includes(m)}
            onClick={() => {
              const active = value.monedas_permitidas.includes(m);
              const next = active
                ? value.monedas_permitidas.filter((x) => x !== m)
                : [...value.monedas_permitidas, m];
              const nextTasas = [...value.tasas_cambio];
              if (!active && m === "COP" && !nextTasas.some((t) => t.moneda.toUpperCase() === "COP")) {
                nextTasas.push({ moneda: "COP", tasa_a_usd: 0.00025 });
              }
              onChange({ ...value, monedas_permitidas: next, tasas_cambio: nextTasas });
            }}
          />
        ))}
      </div></div>
    </div>
  );
}

export function ReglasPage() {
  const { data, loading, error, reload } = useApi(getRules);
  const [form, setForm] = useState<Rules | null>(null);
  useEffect(() => { if (data && !form) setForm(data); return undefined; }, [data, form]);
  if (loading || !form) return error ? <ErrorState onRetry={reload} /> : <LoadingState />;
  const c = es.reglasPage.campos;
  const save = async () => {
    const bad = NUM_FIELDS.some((k) => k !== "tolerancia_monto" && !(form[k] > 0)) || form.tolerancia_monto < 0 ||
      form.beneficiarios.some((b) => !(b.monto_acordado > 0) || !(b.limite_periodo > 0)) || form.tasas_cambio.some((t) => !(t.tasa_a_usd > 0));
    if (bad) { toast.error(es.reglasPage.errorNumeros); return; }
    await saveRules(form); toast.success(es.reglasPage.guardado);
  };
  const setB = (i: number, p: Partial<Rules["beneficiarios"][number]>) => setForm({ ...form, beneficiarios: form.beneficiarios.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const setT = (i: number, p: Partial<Rules["tasas_cambio"][number]>) => setForm({ ...form, tasas_cambio: form.tasas_cambio.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  return (
    <>
      <PageHero eyebrow={es.reglasPage.eyebrow} title={es.reglasPage.titulo} subtitle={es.reglasPage.subtitulo} cta={<PillLink to="/simulador">{es.reglasPage.cta}</PillLink>}
        visual={<FloatCard><p className="text-sm text-muted-foreground">{es.reglasPage.tarjetaTitulo}</p><p className="mt-4 text-2xl">{form.nombre_empresa}</p><p className="mt-2 text-muted-foreground tabular">{c.limite_por_pago}: {formatMoney(form.limite_por_pago)}</p><p className="text-muted-foreground tabular">{c.presupuesto_periodo}: {formatMoney(form.presupuesto_periodo)}</p></FloatCard>} />
      <Section title={es.reglasPage.limites}><div className="panel p-5 md:p-8"><RulesForm value={form} onChange={setForm} /></div></Section>
      <Section title={es.reglasPage.beneficiarios} sub={es.reglasPage.beneficiariosSub}>
        <RowsPanel>
          {form.beneficiarios.map((b, i) => (
            <div key={i} className="grid gap-3 border-b border-border p-4 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-end">
              <label className="text-xs text-muted-foreground">{c.nombre}<input className={inputCls + " mt-1 text-foreground"} value={b.nombre_mostrar} onChange={(e) => setB(i, { nombre_mostrar: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">{c.monto_acordado}<input type="number" className={inputCls + " mt-1 text-foreground"} value={b.monto_acordado} onChange={(e) => setB(i, { monto_acordado: Number(e.target.value) })} /></label>
              <label className="text-xs text-muted-foreground">{c.limite_periodo}<input type="number" className={inputCls + " mt-1 text-foreground"} value={b.limite_periodo} onChange={(e) => setB(i, { limite_periodo: Number(e.target.value) })} /></label>
              <CheckOption title={c.activo} selected={b.activo} onClick={() => setB(i, { activo: !b.activo })} />
              <button className="min-h-11 text-sm text-block" onClick={() => setForm({ ...form, beneficiarios: form.beneficiarios.filter((_, j) => j !== i) })}>{es.reglasPage.quitar}</button>
            </div>
          ))}
          <div className="p-4"><PillButton variant="outline" arrow="none" onClick={() => setForm({ ...form, beneficiarios: [...form.beneficiarios, { nombre_mostrar: "", monto_acordado: 0, limite_periodo: 0, activo: true }] })}>{es.reglasPage.agregarBeneficiario}</PillButton></div>
        </RowsPanel>
      </Section>
      <Section title={es.reglasPage.tasas} sub={es.reglasPage.tasasSub}>
        <RowsPanel>
          {form.tasas_cambio.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 border-b border-border p-4">
              <label className="text-xs text-muted-foreground">{c.moneda}<input className={inputCls + " mt-1 text-foreground"} value={t.moneda} onChange={(e) => setT(i, { moneda: e.target.value.toUpperCase() })} /></label>
              <label className="text-xs text-muted-foreground">{c.tasa_a_usd}<input type="number" step="any" className={inputCls + " mt-1 text-foreground"} value={t.tasa_a_usd} onChange={(e) => setT(i, { tasa_a_usd: Number(e.target.value) })} /></label>
              <button className="min-h-11 text-sm text-block" onClick={() => setForm({ ...form, tasas_cambio: form.tasas_cambio.filter((_, j) => j !== i) })}>{es.reglasPage.quitar}</button>
            </div>
          ))}
          <div className="p-4"><PillButton variant="outline" arrow="none" onClick={() => setForm({ ...form, tasas_cambio: [...form.tasas_cambio, { moneda: "", tasa_a_usd: 0 }] })}>{es.reglasPage.agregarTasa}</PillButton></div>
        </RowsPanel>
      </Section>
      <div className="sticky bottom-0 z-30 mt-12 border-t border-border bg-background/90 backdrop-blur-xl"><div className="container-page flex justify-end py-4"><PillButton className="w-full md:w-auto" arrow="right" onClick={save}>{es.reglasPage.guardar}</PillButton></div></div>
    </>
  );
}

export function SimuladorPage() {
  const { data, loading } = useApi(getRules);
  const [form, setForm] = useState<Rules | null>(null);
  const [rows, setRows] = useState<SimulationRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data && !form) setForm(data); return undefined; }, [data, form]);
  if (loading || !form) return <LoadingState />;
  const run = async () => { setBusy(true); setRows(await simulate(form)); setBusy(false); };
  const changes = rows?.filter((r) => r.cambia).length ?? 0;
  return (
    <>
      <PageHero eyebrow={es.simulador.eyebrow} title={es.simulador.titulo} subtitle={es.simulador.subtitulo} cta={<PillButton onClick={run} disabled={busy}>{es.simulador.cta}</PillButton>} />
      <Section title={es.simulador.formTitulo} sub={es.simulador.nota}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-5 md:p-8"><RulesForm value={form} onChange={setForm} /><div className="mt-6 flex gap-3"><PillButton onClick={run} disabled={busy}>{es.simulador.cta}</PillButton><PillButton variant="outline" arrow="none" onClick={() => { setForm(data!); setRows(null); }}>{es.simulador.restablecer}</PillButton></div></div>
          <RowsPanel header={rows && <p className="text-lg">{es.simulador.cambian(changes, rows.length)}</p>}>
            {busy ? <LoadingState /> : !rows ? <EmptyState title={es.simulador.sinResultados} /> : rows.map((r) => (
              <div key={r.invoice.id} className={`flex items-center justify-between gap-3 border-b border-border px-4 py-3 ${r.cambia ? "bg-accent" : ""}`}>
                <div className="min-w-0"><p className="truncate">{r.invoice.factura.beneficiario_texto ?? "—"}</p><p className="truncate text-xs text-muted-foreground">{r.invoice.factura.numero ?? es.facturas.sinNumero} · {formatMoney(r.invoice.factura.monto, r.invoice.factura.moneda)}</p></div>
                <div className="flex shrink-0 items-center gap-2"><DecisionBadge decision={r.actual} />→<DecisionBadge decision={r.simulada} /></div>
              </div>
            ))}
          </RowsPanel>
        </div>
      </Section>
    </>
  );
}

export function MetricasPage() {
  const { data: m, loading, error, reload } = useApi(getMetrics);
  if (loading) return <LoadingState />;
  if (error || !m) return <ErrorState onRetry={reload} />;
  const chart = [{ name: es.metricas.pagadas, v: m.pagadas, c: "var(--pay)" }, { name: es.metricas.frenadas, v: m.frenadas, c: "var(--block)" }, { name: es.estadoFactura.escalada, v: m.pendientes, c: "var(--escalate)" }];
  return (
    <>
      <PageHero eyebrow={es.metricas.eyebrow} title={es.metricas.titulo} subtitle={es.metricas.subtitulo} cta={<PillLink to="/auditoria">{es.metricas.cta}</PillLink>}
        visual={<FloatCard><p className="text-sm text-muted-foreground">{es.metricas.grafico}</p><div className="h-56"><ResponsiveContainer><PieChart><Pie data={chart} dataKey="v" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>{chart.map((d) => <Cell key={d.name} fill={d.c} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></FloatCard>} />
      <Section title={es.metricas.eyebrow}>
        <MetricStrip items={[{ label: es.metricas.total, value: m.total }, { label: es.metricas.pagadas, value: m.pagadas }, { label: es.metricas.frenadas, value: m.frenadas }, { label: es.metricas.escaladas, value: m.escaladas }, { label: es.metricas.autonomia, value: formatPct(m.autonomia) }]} />
      </Section>
      <Section title={es.metricas.fueraReglas}>
        <div className="flex items-center gap-6 rounded-[32px] bg-pay-soft p-8 text-pay md:p-12"><ShieldCheck className="h-12 w-12 shrink-0" /><div><p className="text-4xl font-light md:text-5xl">{es.metricas.fueraReglas}: {m.pagos_fuera_de_reglas}</p><p className="mt-2">{es.metricas.fueraReglasSub}</p></div></div>
      </Section>
    </>
  );
}

export function AuditoriaPage() {
  const { data, loading, error, reload } = useApi(getAudit);
  return (
    <>
      <PageHero eyebrow={es.auditoria.eyebrow} title={es.auditoria.titulo} subtitle={es.auditoria.subtitulo} cta={<PillLink to="/facturas">{es.auditoria.cta}</PillLink>} />
      <Section title={es.auditoria.listaTitulo}>
        <RowsPanel>
          {loading ? <LoadingState /> : error ? <ErrorState onRetry={reload} /> : !data?.length ? <EmptyState /> : data.map((e) => (
            <details key={e.id} className="border-b border-border px-4 py-3 last:border-0 md:px-6">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><span className="min-w-0"><span className="block">{es.auditoria.eventos[e.evento]}</span><span className="block truncate text-sm text-muted-foreground">{e.entidad}</span></span><span className="shrink-0 text-sm text-muted-foreground">{formatDateTime(e.fecha)}</span></summary>
              <pre className="mt-2 overflow-x-auto rounded-2xl bg-muted p-4 text-xs">{JSON.stringify(e.detalle, null, 2)}</pre>
            </details>
          ))}
        </RowsPanel>
      </Section>
    </>
  );
}
