import { useState } from "react";
import { toast } from "sonner";
import { resolveDecision } from "@/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { es } from "@/i18n/es";
import type { InvoiceItem } from "@/types";
import { CheckOption, PillButton } from "./ui-kit";

export function ResolveActions({ inv, className }: { inv: InvoiceItem; className?: string }) {
  const [open, setOpen] = useState<null | "aprobada" | "rechazada">(null);
  if (inv.estado !== "escalada") return null;
  return (
    <div className={className}>
      <div className="flex gap-3">
        <PillButton arrow="none" onClick={() => setOpen("aprobada")} className="flex-1 sm:flex-none">
          {es.resolver.aprobar}
        </PillButton>
        <PillButton variant="outline" arrow="none" onClick={() => setOpen("rechazada")} className="flex-1 sm:flex-none">
          {es.resolver.rechazar}
        </PillButton>
      </div>
      {open && <ResolveDialog inv={inv} initial={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ResolveDialog({ inv, initial, onClose }: { inv: InvoiceItem; initial: "aprobada" | "rechazada"; onClose: () => void }) {
  const [tipo, setTipo] = useState(initial);
  const [usuario, setUsuario] = useState("");
  const [comentario, setComentario] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!usuario.trim()) return setErr(es.resolver.requerido);
    setBusy(true);
    try {
      await resolveDecision(inv.id, tipo, usuario, comentario);
      toast.success(tipo === "aprobada" ? es.resolver.okAprobada : es.resolver.okRechazada);
      onClose();
    } catch {
      setErr(es.estados.error);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-auto bottom-0 max-w-full translate-y-0 gap-0 rounded-t-[28px] rounded-b-none border-border p-6 sm:max-w-full md:top-[50%] md:bottom-auto md:max-w-lg md:translate-y-[-50%] md:rounded-[28px] md:p-8">
        <DialogTitle className="text-2xl font-normal tracking-tight">{es.resolver.titulo}</DialogTitle>
        <DialogDescription className="mt-1">
          {inv.factura.numero ?? es.facturas.sinNumero} · {inv.factura.beneficiario_texto} · {es.resolver.sub}
        </DialogDescription>
        <div className="mt-6 grid gap-3">
          <CheckOption selected={tipo === "aprobada"} onClick={() => setTipo("aprobada")} title={es.resolver.opcionAprobar} sub={es.resolver.opcionAprobarSub} />
          <CheckOption selected={tipo === "rechazada"} onClick={() => setTipo("rechazada")} title={es.resolver.opcionRechazar} sub={es.resolver.opcionRechazarSub} />
        </div>
        <label className="mt-6 block text-sm text-foreground">
          {es.resolver.usuario} *
          <input
            value={usuario}
            onChange={(e) => {
              setUsuario(e.target.value);
              setErr(null);
            }}
            placeholder={es.resolver.usuarioPh}
            className="mt-2 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <label className="mt-4 block text-sm text-foreground">
          {es.resolver.comentario}
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={es.resolver.comentarioPh}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </label>
        {err && <p className="mt-3 text-sm text-block">{err}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <PillButton variant="outline" arrow="none" onClick={onClose}>
            {es.resolver.cancelar}
          </PillButton>
          <PillButton arrow="right" onClick={submit} disabled={busy}>
            {es.resolver.confirmar}
          </PillButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
