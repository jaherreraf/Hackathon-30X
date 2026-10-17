import { createFileRoute } from "@tanstack/react-router";
import { SimuladorPage } from "@/views/OtherPages";
export const Route = createFileRoute("/simulador")({
  head: () => ({ meta: [{ title: "Simulador · PayGuard" }, { name: "description", content: "Prueba nuevas reglas sobre facturas existentes." }, { property: "og:title", content: "Simulador · PayGuard" }, { property: "og:description", content: "Prueba nuevas reglas sobre facturas existentes." }] }),
  component: SimuladorPage,
});
