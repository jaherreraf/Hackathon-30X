import { createFileRoute } from "@tanstack/react-router";
import { MetricasPage } from "@/views/OtherPages";
export const Route = createFileRoute("/metricas")({
  head: () => ({ meta: [{ title: "Métricas · PayGuard" }, { name: "description", content: "Autonomía y decisiones del agente de pagos." }, { property: "og:title", content: "Métricas · PayGuard" }, { property: "og:description", content: "Autonomía y decisiones del agente de pagos." }] }),
  component: MetricasPage,
});
