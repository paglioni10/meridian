import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Estudos" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Estudos"
      phase="F2"
      description="Backlog de cursos por prioridade e tempo livre, com notas abertas direto no Obsidian."
    />
  );
}
