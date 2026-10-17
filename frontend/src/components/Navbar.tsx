import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { es } from "@/i18n/es";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { to: "/facturas", label: es.nav.facturas },
  { to: "/cola", label: es.nav.cola },
  { to: "/reglas", label: es.nav.reglas },
  { to: "/simulador", label: es.nav.simulador },
  { to: "/metricas", label: es.nav.metricas },
  { to: "/auditoria", label: es.nav.auditoria },
] as const;

export function Logo() {
  return (
    <Link to="/facturas" className="flex shrink-0 items-center gap-2 text-[19px] tracking-tight text-foreground">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-[13px] font-medium text-background">
        P
      </span>
      {es.app.nombre}
    </Link>
  );
}

export function SimPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-escalate/30 bg-escalate-soft px-2.5 py-1 text-xs text-escalate",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-escalate" />
      {es.app.simulacion}
    </span>
  );
}

export function UploadPill({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      to="/facturas"
      hash="subir"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm text-primary-foreground transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft",
        className,
      )}
    >
      {es.app.subirFactura}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              activeProps={{ className: "!text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <SimPill />
          <UploadPill />
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <SimPill />
          <button
            aria-label={es.app.menu}
            onClick={() => setOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full text-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex h-dvh flex-col bg-background lg:hidden">
          <div className="container-page flex h-16 items-center justify-between border-b border-border">
            <Logo />
            <button
              aria-label={es.app.cerrar}
              onClick={() => setOpen(false)}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="container-page flex flex-1 flex-col gap-1 overflow-y-auto py-8">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="py-2 text-[28px] tracking-tight text-muted-foreground"
                activeProps={{ className: "!text-foreground" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="container-page pb-8">
            <UploadPill className="w-full min-h-12" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
