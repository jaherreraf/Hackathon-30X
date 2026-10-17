import { createFileRoute } from "@tanstack/react-router";
import { DetallePage } from "@/views/DetallePage";
export const Route = createFileRoute("/facturas/$id")({
  head: () => ({ meta: [{ title: "Detalle de decisión · PayGuard" }, { name: "description", content: "Explicación de la decisión del agente." }, { property: "og:title", content: "Detalle de decisión · PayGuard" }, { property: "og:description", content: "Explicación de la decisión del agente." }] }),
  component: () => <DetallePage id={Route.useParams().id} />,
});
