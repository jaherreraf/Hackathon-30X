import { createFileRoute } from "@tanstack/react-router";
import { AuditoriaPage } from "@/views/OtherPages";
export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría · PayGuard" }, { name: "description", content: "Registro completo de decisiones del agente de pagos." }, { property: "og:title", content: "Auditoría · PayGuard" }, { property: "og:description", content: "Registro completo de decisiones del agente de pagos." }] }),
  component: AuditoriaPage,
});
