import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Finanças" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Finanças"
      phase="F3"
      description="Ganhos CLT e PJ, base segura mensal, despesas fixas e variáveis e importação de extratos do Nubank."
    />
  );
}
