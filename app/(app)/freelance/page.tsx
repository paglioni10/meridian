import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Freelance" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Freelance"
      phase="F6"
      description="Pipeline de clientes e orçamentos ligado à renda variável."
    />
  );
}
