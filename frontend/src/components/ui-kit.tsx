import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, ArrowUpRight, Check, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { es } from "@/i18n/es";
import { splitMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DecisionType, InvoiceEstado } from "@/types";

/* ---------- Hero ---------- */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  cta,
  visual,
  background,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  cta?: ReactNode;
  visual?: ReactNode;
  background?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      {background}
      <div className="container-page relative grid gap-12 pt-14 pb-4 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-24">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title mt-5 break-words">{title}</h1>
          {subtitle && <p className="mt-6 max-w-xl text-lg text-muted-foreground">{subtitle}</p>}
          {cta && <div className="mt-8 flex flex-wrap items-center gap-4">{cta}</div>}
        </div>
        {visual && <div className="min-w-0">{visual}</div>}
      </div>
    </section>
  );
}

/* ---------- Section ---------- */
export function Section({
  title,
  sub,
  id,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  id?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("container-page scroll-mt-24 pt-20 md:pt-28", className)}>
      <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 className="text-3xl tracking-tight text-foreground md:text-[44px] md:leading-[1.1]">{title}</h2>
          {sub && <p className="mt-3 max-w-xl text-muted-foreground">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ---------- Buttons ---------- */
const pillBase =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";

export function PillButton({
  children,
  variant = "primary",
  arrow = "up",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline"; arrow?: "up" | "right" | "none" }) {
  return (
    <button
      className={cn(
        pillBase,
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-soft"
          : "border border-border bg-card text-foreground hover:border-foreground/30",
        className,
      )}
      {...props}
    >
      {children}
      {arrow === "up" && <ArrowUpRight className="h-4 w-4" />}
      {arrow === "right" && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

export function PillLink({
  to,
  children,
  hash,
  onClick,
}: {
  to: "/facturas" | "/reglas" | "/simulador" | "/auditoria" | "/cola" | "/metricas";
  children: ReactNode;
  hash?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth" });
        if (window.location.hash !== `#${hash}`) {
          window.history.pushState(null, "", `${window.location.pathname}#${hash}`);
        }
      }
    }
  };

  return (
    <Link
      to={to}
      {...(hash ? { hash } : {})}
      onClick={handleClick}
      className={cn(pillBase, "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-soft")}
    >
      {children}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to as "/"} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">
      {children}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

/* ---------- Money ---------- */
export function Money({ value, currency = "USD", className, centsClassName }: { value: number | null; currency?: string; className?: string; centsClassName?: string }) {
  if (value == null) return <span className={className}>—</span>;
  const { int, cents } = splitMoney(value);
  const sym = currency === "EUR" ? "€" : "$";
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {int.startsWith("-") ? "-" : ""}
      {sym}
      {int.replace("-", "")}
      <span className={cn("text-[0.55em] text-muted-foreground", centsClassName)}>.{cents}</span>
      <span className="ml-1.5 text-[0.35em] tracking-wider text-muted-foreground">{currency}</span>
    </span>
  );
}

/* ---------- Decision badges ---------- */
const tone: Record<DecisionType, string> = {
  pagar: "bg-pay-soft text-pay",
  frenar: "bg-block-soft text-block",
  escalar: "bg-escalate-soft text-escalate",
};
export const dotTone: Record<DecisionType, string> = { pagar: "bg-pay", frenar: "bg-block", escalar: "bg-escalate" };

export function DecisionBadge({ decision, size = "sm" }: { decision: DecisionType; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium",
        tone[decision],
        size === "lg" ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs",
      )}
    >
      <span className={cn("rounded-full", dotTone[decision], size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5")} />
      {es.decision[decision]}
    </span>
  );
}

export function EstadoLabel({ estado }: { estado: InvoiceEstado }) {
  const d: DecisionType =
    estado === "pagada" || estado === "aprobada_humano" ? "pagar" : estado === "escalada" ? "escalar" : "frenar";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone[d].split(" ")[1])}>
      {(estado === "aprobada_humano" || estado === "pagada") && <Check className="h-3 w-3" />}
      {es.estadoFactura[estado]}
    </span>
  );
}

/* ---------- Containers & rows ---------- */
export function RowsPanel({ children, header, className }: { children: ReactNode; header?: ReactNode; className?: string }) {
  return (
    <div className={cn("panel p-2 md:p-3", className)}>
      {header && <div className="px-3 pt-3 pb-4 md:px-4">{header}</div>}
      <div className="overflow-hidden rounded-[24px] bg-card shadow-soft">{children}</div>
    </div>
  );
}

export function InitialIcon({ name, decision, className }: { name: string | null; decision?: DecisionType; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-medium",
        decision ? tone[decision] : "bg-muted text-foreground",
        className,
      )}
    >
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function FloatCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[28px] border border-border bg-card p-6 shadow-float md:p-8", className)}>{children}</div>;
}

/* ---------- Selection option ---------- */
export function CheckOption({
  selected,
  onClick,
  title,
  sub,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-all duration-150",
        selected ? "border-primary shadow-[0_0_0_0.5px_var(--primary)]" : "border-border hover:border-foreground/25",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{title}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

/* ---------- Metric strip ---------- */
export function MetricStrip({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-y-10 border-y border-border py-10 md:flex md:py-12">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "min-w-0 px-4 md:flex-1 md:px-8",
            i % 2 === 1 && "border-l border-border md:border-l",
            i > 0 && "md:border-l md:border-border",
            i === 0 && "md:pl-0",
          )}
        >
          <div className="tabular text-5xl font-light tracking-tight text-foreground md:text-6xl">{it.value}</div>
          <div className="mt-2 text-sm text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- States ---------- */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {es.estados.cargando}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="h-6 w-6 text-block" />
      <p className="text-muted-foreground">{message ?? es.estados.error}</p>
      {onRetry && (
        <PillButton variant="outline" arrow="none" onClick={onRetry}>
          {es.estados.reintentar}
        </PillButton>
      )}
    </div>
  );
}

export function EmptyState({ title, sub, icon }: { title?: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <p className="text-xl text-foreground">{title ?? es.estados.vacio}</p>
      {sub && <p className="max-w-sm text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
