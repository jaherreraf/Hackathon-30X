import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { computeMetrics, getInvoices, getRules, uploadInvoice } from "@/api";
import { HeroRibbon } from "@/components/HeroRibbon";
import { InvoiceRow } from "@/components/InvoiceRow";
import { Marquee } from "@/components/Marquee";
import {
  DecisionBadge,
  EmptyState,
  ErrorState,
  FloatCard,
  LoadingState,
  MetricStrip,
  Money,
  PageHero,
  PillButton,
  PillLink,
  RowsPanel,
  Section,
  TextLink,
} from "@/components/ui-kit";
import { useApi } from "@/hooks/useApi";
import { es } from "@/i18n/es";
import { formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DecisionType, InvoiceItem, Rules } from "@/types";

type Filter = "todas" | DecisionType;

export function FacturasPage() {
  const inv = useApi(getInvoices);
  const rules = useApi(getRules);
  const [filter, setFilter] = useState<Filter>("todas");
  const data = inv.data;
  const metrics = data && rules.data ? computeMetrics(data, rules.data) : null;
  const filtered = (data ?? []).filter((i) => filter === "todas" || i.decision.decision === filter);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#subir") {
      const timer = setTimeout(() => {
        document.getElementById("subir")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <PageHero
        background={<HeroRibbon />}
        eyebrow={es.facturas.eyebrow}
        title={es.facturas.titulo}
        subtitle={es.facturas.subtitulo}
        cta={<PillLink to="/facturas" hash="subir">{es.app.subirFactura}</PillLink>}
        visual={
          data && rules.data && metrics ? (
            <BudgetCard invoices={data} rules={rules.data} gastado={metrics.presupuesto_gastado} />
          ) : (
            <FloatCard>
              <LoadingState />
            </FloatCard>
          )
        }
      />

      <section className="pt-20 md:pt-28">
        <p className="eyebrow container-page mb-6 text-center">{es.facturas.marqueeTitulo}</p>
        {data && <Marquee invoices={data} />}
      </section>

      <Section id="subir" title={es.facturas.subirTitulo} sub={es.facturas.subirSub}>
        <UploadBox />
      </Section>

      <Section title={es.facturas.todasTitulo}>
        <RowsPanel
          header={
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
              {(["todas", "pagar", "frenar", "escalar"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors duration-150",
                    filter === f
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {es.facturas.filtros[f]}
                  {data && (
                    <span className="ml-1.5 opacity-60">
                      {f === "todas" ? data.length : data.filter((i) => i.decision.decision === f).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          }
        >
          {inv.loading ? (
            <LoadingState />
          ) : inv.error ? (
            <ErrorState onRetry={inv.reload} />
          ) : filtered.length === 0 ? (
            <EmptyState title={es.facturas.vacioFiltro} />
          ) : (
            filtered.map((i) => <InvoiceRow key={i.id} inv={i} />)
          )}
        </RowsPanel>
      </Section>

      <Section title={es.facturas.metricasTitulo} aside={<TextLink to="/metricas">{es.nav.metricas}</TextLink>}>
        {metrics ? (
          <MetricStrip
            items={[
              { label: es.metricas.pagadas, value: metrics.pagadas },
              { label: es.metricas.frenadas, value: metrics.frenadas },
              { label: es.metricas.escaladas, value: metrics.escaladas },
              { label: es.metricas.autonomia, value: formatPct(metrics.autonomia) },
            ]}
          />
        ) : (
          <LoadingState />
        )}
      </Section>
    </>
  );
}

function BudgetCard({ invoices, rules, gastado }: { invoices: InvoiceItem[]; rules: Rules; gastado: number }) {
  const disponible = Math.max(rules.presupuesto_periodo - gastado, 0);
  const pct = Math.min(gastado / rules.presupuesto_periodo, 1);
  return (
    <FloatCard className="relative">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">{es.facturas.presupuesto}</p>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground tabular">{rules.periodo}</span>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">{es.facturas.disponible}</p>
      <Money
        value={disponible}
        className="mt-1 block text-[44px] leading-none font-light tracking-tight text-foreground md:text-[52px]"
      />
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular">
        {es.facturas.gastado} {formatMoney(gastado)} {es.facturas.de} {formatMoney(rules.presupuesto_periodo)}
      </p>
      <p className="mt-8 mb-2 text-sm text-foreground">{es.facturas.actividad}</p>
      <div className="fade-bottom -mx-2">
        {invoices.slice(0, 3).map((i) => (
          <Link
            key={i.id}
            to="/facturas/$id"
            params={{ id: i.id }}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-xs">
              {(i.factura.beneficiario_texto ?? "?").charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {i.factura.beneficiario_texto ?? es.explicacion.sinProveedor}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {i.factura.numero ?? es.facturas.sinNumero}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm tabular text-foreground">
                {formatMoney(i.factura.monto, i.factura.moneda)}
              </span>
              <span className="block text-xs text-muted-foreground">{es.estadoFactura[i.estado]}</span>
            </span>
          </Link>
        ))}
      </div>
    </FloatCard>
  );
}

function UploadBox() {
  const [tab, setTab] = useState<"archivo" | "texto">("archivo");
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<InvoiceItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if ((tab === "archivo" && !file) || (tab === "texto" && !texto.trim()))
      return setErr(es.facturas.errorVacio);
    setErr(null);
    setBusy(true);
    setResult(null);
    try {
      const r = await uploadInvoice(
        tab === "archivo"
          ? { tipo: "archivo", nombreArchivo: file!.name, file: file! }
          : { tipo: "texto", texto },
      );
      setResult(r);
      setFile(null);
      setTexto("");
    } catch {
      setErr(es.estados.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel grid gap-3 p-2 md:p-3 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-[24px] bg-card p-5 shadow-soft md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["archivo", "texto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "min-h-11 truncate rounded-full px-3 text-sm transition-all duration-150",
                tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {t === "archivo" ? es.facturas.tabArchivo : es.facturas.tabTexto}
            </button>
          ))}
        </div>
        {tab === "archivo" ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={cn(
              "flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-[20px] border-[1.5px] border-dashed p-6 text-center transition-colors duration-150",
              drag ? "border-primary bg-accent" : "border-border hover:border-foreground/30",
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
              <FileUp className="h-5 w-5" />
            </span>
            <span className="text-foreground">{file ? file.name : es.facturas.soltar}</span>
            <span className="text-sm text-muted-foreground">
              {file ? es.facturas.archivoSeleccionado : es.facturas.soltarSub}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </button>
        ) : (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={es.facturas.textoPlaceholder}
            rows={8}
            className="min-h-52 w-full rounded-[20px] border border-border bg-card p-4 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        )}
        {err && <p className="mt-3 text-sm text-block">{err}</p>}
        <div className="mt-6">
          <PillButton onClick={submit} disabled={busy} arrow="right" className="w-full sm:w-auto">
            {es.facturas.enviar}
          </PillButton>
        </div>
      </div>

      {/* -------- Panel de resultado (mejorado) -------- */}
      <div className="flex min-h-64 flex-col justify-center rounded-[24px] p-6 md:p-8">
        {busy ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-lg text-foreground">{es.facturas.leyendo}</p>
          </div>
        ) : result ? (
          <ResultPanel result={result} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Sparkles className="h-6 w-6" />
            <p className="max-w-xs text-sm">{es.facturas.subirSub}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Panel de resultado con jerarquía visual ---------- */

const DECISION_VISUAL: Record<
  DecisionType,
  { Icon: typeof CheckCircle2; ring: string; soft: string; text: string; label: string }
> = {
  pagar: { Icon: CheckCircle2, ring: "ring-pay/30", soft: "bg-pay-soft", text: "text-pay", label: "Aprobada" },
  frenar: { Icon: XCircle, ring: "ring-block/30", soft: "bg-block-soft", text: "text-block", label: "Frenada" },
  escalar: { Icon: AlertCircle, ring: "ring-escalate/30", soft: "bg-escalate-soft", text: "text-escalate", label: "Escalada" },
};

function ResultPanel({ result }: { result: InvoiceItem }) {
  const v = DECISION_VISUAL[result.decision.decision];
  const Icon = v.Icon;
  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-12 w-12 place-items-center rounded-2xl ring-2", v.soft, v.text, v.ring)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{es.facturas.resultado}</p>
          <p className={cn("text-lg font-medium leading-tight", v.text)}>{v.label}</p>
        </div>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {result.factura.numero ?? es.facturas.sinNumero}
        {result.factura.beneficiario_texto ? ` · ${result.factura.beneficiario_texto}` : ""}
      </p>

      <Money
        value={result.factura.monto}
        currency={result.factura.moneda}
        className="mt-3 block text-4xl font-light tracking-tight"
      />

      <div className="mt-4 space-y-2">
        <p className="text-base text-foreground leading-relaxed">{result.decision.explicacion_humana}</p>
      </div>

      <div className="mt-5">
        <TextLink to={`/facturas/${result.id}`}>{es.facturas.verDetalle}</TextLink>
      </div>
    </div>
  );
}
