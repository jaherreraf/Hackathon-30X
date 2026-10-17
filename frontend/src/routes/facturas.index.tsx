import { createFileRoute } from "@tanstack/react-router";
import { FacturasPage } from "@/views/FacturasPage";
export const Route = createFileRoute("/facturas/")({
  head: () => ({ meta: [{ title: "Facturas · PayGuard" }, { name: "description", content: "El agente lee cada factura y decide pagar, frenar o escalar." }, { property: "og:title", content: "Facturas · PayGuard" }, { property: "og:description", content: "El agente lee cada factura y decide pagar, frenar o escalar." }] }),
  component: FacturasPage,
});
