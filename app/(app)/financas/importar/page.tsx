import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FinanceTabs } from "@/components/shell/finance-tabs";
import { EmptyState, PageHead, Section } from "@/components/ui/display";
import { getCategories, getImportBatches } from "@/features/expenses/queries";
import { getIncomeSources } from "@/features/income/queries";
import { getActiveContext } from "@/lib/settings";
import { BatchList } from "./batches";
import { ImportWorkbench } from "./workbench";

export const metadata: Metadata = { title: "Importar extrato" };

export default function ImportPage() {
  return (
    <>
      <PageHead title="Finanças" meta={<FinanceTabs />} />
      <div className="panels-grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] 3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section title="Importar extrato">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Workbench />
          </Suspense>
        </Section>
        <Section title="Importações">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Batches />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function Workbench() {
  const context = await getActiveContext();
  const [categories, sources] = await Promise.all([getCategories(), getIncomeSources("all")]);
  return (
    <>
      {categories.length === 0 ? (
        <p className="label">
          Sem categorias ainda: as despesas entram sem categoria.{" "}
          <Link href="/financas/categorias" className="hover:text-danger">
            Criar categorias sugeridas
          </Link>
        </p>
      ) : null}
      <ImportWorkbench
        defaultContext={context === "all" ? "personal" : context}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        incomeSources={sources.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
      />
    </>
  );
}

async function Batches() {
  const batches = await getImportBatches();
  if (batches.length === 0) {
    return (
      <EmptyState title="Nenhuma importação">
        Os extratos importados aparecem aqui e podem ser desfeitos.
      </EmptyState>
    );
  }
  return <BatchList batches={batches} />;
}
