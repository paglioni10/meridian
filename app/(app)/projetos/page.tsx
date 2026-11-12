import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Projetos" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Projetos"
      phase="F6"
      description="Kanban unificado de trabalho, projetos pessoais e demandas freelance."
    />
  );
}
