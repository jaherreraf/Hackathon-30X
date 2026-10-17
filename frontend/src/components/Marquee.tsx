import { marqueeSuppliers } from "@/data/mock";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DecisionType, InvoiceItem } from "@/types";
import { dotTone } from "./ui-kit";

interface Chip {
  name: string;
  monto: number;
  moneda: string;
  decision: DecisionType;
}

function Row({ chips, dir }: { chips: Chip[]; dir: "left" | "right" }) {
  return (
    <div className="marquee-row marquee-mask overflow-hidden py-1.5">
      <div className="marquee-track" data-dir={dir}>
        {[...chips, ...chips].map((c, i) => (
          <div
            key={i}
            aria-hidden={i >= chips.length}
            className="mr-3 flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card py-2 pr-4 pl-2 shadow-soft md:mr-4 md:py-2.5 md:pr-5"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs text-foreground md:h-8 md:w-8">
              {c.name.charAt(0)}
            </span>
            <span className="text-xs whitespace-nowrap text-foreground md:text-sm">{c.name}</span>
            <span className="tabular text-xs whitespace-nowrap text-muted-foreground md:text-sm">
              {formatMoney(c.monto, c.moneda)}
            </span>
            <span className={cn("h-2 w-2 rounded-full", dotTone[c.decision])} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Marquee({ invoices }: { invoices: InvoiceItem[] }) {
  const real: Chip[] = invoices.map((i) => ({
    name: i.factura.beneficiario_texto ?? "—",
    monto: i.factura.monto ?? 0,
    moneda: i.factura.moneda,
    decision: i.decision.decision,
  }));
  const decisions: DecisionType[] = ["pagar", "pagar", "escalar", "pagar", "frenar"];
  const extra: Chip[] = marqueeSuppliers.map((name, i) => ({
    name,
    monto: 320 + ((i * 437) % 2400),
    moneda: "USD",
    decision: decisions[i % decisions.length]!,
  }));
  const all = [...real, ...extra];
  const half = Math.ceil(all.length / 2);
  return (
    <div className="space-y-2 md:space-y-3">
      <Row chips={all.slice(0, half)} dir="left" />
      <Row chips={all.slice(half).concat(all.slice(0, 3))} dir="right" />
    </div>
  );
}
