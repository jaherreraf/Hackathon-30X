import { Check, X } from "lucide-react";
import { getInvoice } from "@/api";
import { ResolveActions } from "@/components/ResolveDialog";
import { DecisionBadge, ErrorState, EstadoLabel, FloatCard, LoadingState, Money, PageHero, RowsPanel, Section, TextLink } from "@/components/ui-kit";
import { useApi } from "@/hooks/useApi";
import { es } from "@/i18n/es";
import { formatDate, formatDateTime, formatMoney, formatPct } from "@/lib/format";

export function DetallePage({ id }: { id: string }) {
  const { data: inv, loading, error, reload } = useApi(() => getInvoice(id), [id]);
  if (loading) return <LoadingState />;
  if (error || !inv) return <ErrorState onRetry={reload} message={es.detalle.noEncontrada} />;
  const f = inv.factura;
  const c = es.detalle.campos;
  const rows: [string, string][] = [
    [c.numero, f.numero ?? "—"], [c.beneficiario, f.beneficiario_texto ?? "—"], [c.monto, formatMoney(f.monto, f.moneda)],
    [c.moneda, f.moneda], [c.monto_usd, formatMoney(f.monto_usd)], [c.vencimiento, formatDate(f.vencimiento)],
    [c.origen, es.origen[f.origen]], [c.recibida, formatDateTime(inv.recibida)],
  ];
  const s = inv.decision.snapshot_reglas;
  return (
    <>
      <PageHero
        eyebrow={es.detalle.eyebrow}
        title={f.numero ?? es.facturas.sinNumero}
        subtitle={<span className="flex flex-wrap items-center gap-3"><DecisionBadge decision={inv.decision.decision} size="lg" /><EstadoLabel estado={inv.estado} /></span>}
        cta={<TextLink to="/facturas">{es.detalle.volver}</TextLink>}
        visual={
          <FloatCard>
            <p className="text-sm text-muted-foreground">{es.detalle.montoA}</p>
            <p className="mt-1 text-lg">{f.beneficiario_texto ?? es.explicacion.sinProveedor}</p>
            <Money value={f.monto} currency={f.moneda} className="mt-6 block text-5xl font-light tracking-tight" />
            {inv.resolucion && <p className="mt-6 text-sm text-muted-foreground">{es.estadoFactura[inv.estado]} {es.detalle.resueltaPor(inv.resolucion.usuario, formatDateTime(inv.resolucion.fecha))}{inv.resolucion.comentario && ` — "${inv.resolucion.comentario}"`}</p>}
          </FloatCard>
        }
      />
      <Section title={es.detalle.explicacion}>
        <div className="rounded-[28px] border-l-4 border-primary bg-accent p-6 text-xl text-foreground md:p-8 md:text-2xl">{inv.decision.explicacion_humana}</div>
      </Section>
      <Section title={es.detalle.reglasEvaluadas} sub={es.detalle.reglasSub}>
        <RowsPanel>
          {inv.decision.evaluacion.map((e) => (
            <div key={e.regla} className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${e.paso ? "bg-pay-soft text-pay" : "bg-block-soft text-block"}`}>{e.paso ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
              <div className="min-w-0"><p className="text-foreground">{es.reglas[e.regla]}</p>{e.detalle && <p className="text-sm text-muted-foreground">{e.detalle}</p>}</div>
            </div>
          ))}
        </RowsPanel>
      </Section>
      <Section title={es.detalle.datos}>
        <RowsPanel>
          <dl className="grid md:grid-cols-2">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border px-5 py-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right tabular">{v}</dd></div>)}
            <div className="px-5 py-4 md:col-span-2"><div className="flex justify-between"><span className="text-muted-foreground">{c.confianza}</span><span>{formatPct(f.confianza)}</span></div><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${f.confianza * 100}%` }} /></div></div>
          </dl>
        </RowsPanel>
      </Section>
      <Section title={es.detalle.snapshot} sub={es.detalle.snapshotSub}>
        <details className="panel p-6"><summary className="min-h-11 cursor-pointer">{s.nombre_empresa} · {s.periodo}</summary>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-card p-4 text-xs">{JSON.stringify(s, null, 2)}</pre></details>
      </Section>
      {inv.estado === "escalada" && (
        <div className="sticky bottom-0 z-30 mt-16 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><p>{es.detalle.accionTitulo}</p><ResolveActions inv={inv} /></div>
        </div>
      )}
    </>
  );
}
