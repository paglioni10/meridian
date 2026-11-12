import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Servidores" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Servidores"
      phase="F7"
      description="Status da VPS, do n8n e dos sites, com alertas de vencimento de domínios e créditos."
    />
  );
}
