import { createFileRoute } from "@tanstack/react-router";
import { ColaPage } from "@/views/OtherPages";
export const Route = createFileRoute("/cola")({
  head: () => ({ meta: [{ title: "Cola de aprobación · PayGuard" }, { name: "description", content: "Facturas escaladas que esperan una decisión humana." }, { property: "og:title", content: "Cola de aprobación · PayGuard" }, { property: "og:description", content: "Facturas escaladas que esperan una decisión humana." }] }),
  component: ColaPage,
});
