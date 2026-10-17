import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { es } from "@/i18n/es";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceItem } from "@/types";
import { DecisionBadge, EstadoLabel, InitialIcon, Money } from "./ui-kit";

export function shortReason(inv: InvoiceItem): string {
  const fail = inv.decision.reglas_aplicadas[0];
  return fail ? es.reglas[fail] + " ✕" : es.reglas.PRESUPUESTO + " ✓";
}

export function InvoiceRow({ inv, compact = false }: { inv: InvoiceItem; compact?: boolean }) {
  const f = inv.factura;
  return (
    <Link
      to="/facturas/$id"
      params={{ id: inv.id }}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border px-4 py-4 last:border-b-0 transition-colors duration-150 hover:bg-muted/60 md:px-6",
        !compact && "lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]",
      )}
    >
      <InitialIcon name={f.beneficiario_texto} decision={inv.decision.decision} />
      <div className="min-w-0">
        <p className="truncate text-[15px] text-foreground">{f.beneficiario_texto ?? es.explicacion.sinProveedor}</p>
        <p className="truncate text-sm text-muted-foreground">
          {f.numero ?? es.facturas.sinNumero} · {inv.decision.razones[0] ?? inv.decision.explicacion_humana}
        </p>
      </div>
      <div className="text-right lg:hidden">
        <p className="tabular text-[15px] text-foreground">{formatMoney(f.monto, f.moneda)}</p>
        {compact ? <EstadoLabel estado={inv.estado} /> : <DecisionBadge decision={inv.decision.decision} />}
      </div>
      {!compact && (
        <>
          <div className="hidden text-right lg:block">
            <Money value={f.monto} currency={f.moneda} className="text-[15px] text-foreground" />
            {f.moneda !== "USD" && <p className="tabular text-xs text-muted-foreground">{formatMoney(f.monto_usd)}</p>}
          </div>
          <div className="hidden text-sm text-muted-foreground lg:block">
            {es.facturas.vence} {formatDate(f.vencimiento)}
          </div>
          <div className="hidden flex-col items-end gap-1 lg:flex">
            <DecisionBadge decision={inv.decision.decision} />
            {inv.estado !== "escalada" && inv.decision.decision === "escalar" && <EstadoLabel estado={inv.estado} />}
          </div>
          <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" />
        </>
      )}
    </Link>
  );
}
