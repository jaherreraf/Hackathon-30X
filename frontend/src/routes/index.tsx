import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/facturas" }); },
  head: () => ({ meta: [{ title: "PayGuard — Agente de pagos" }, { name: "description", content: "Agente que revisa facturas y decide pagar, frenar o escalar." }, { property: "og:title", content: "PayGuard" }, { property: "og:description", content: "Agente que revisa facturas y decide pagar, frenar o escalar." }] }),
});
