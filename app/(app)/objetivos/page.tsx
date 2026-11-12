import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Objetivos" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Objetivos"
      phase="F5"
      description="Trilha de metas de curto, médio e longo prazo com progresso financeiro e marcos."
    />
  );
}
