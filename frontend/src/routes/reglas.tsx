import { createFileRoute } from "@tanstack/react-router";
import { ReglasPage } from "@/views/OtherPages";
export const Route = createFileRoute("/reglas")({
  head: () => ({ meta: [{ title: "Reglas · PayGuard" }, { name: "description", content: "Define las reglas de pago que sigue el agente." }, { property: "og:title", content: "Reglas · PayGuard" }, { property: "og:description", content: "Define las reglas de pago que sigue el agente." }] }),
  component: ReglasPage,
});
