import type { Metadata } from "next";
import { Suspense } from "react";
import { FinanceTabs } from "@/components/shell/finance-tabs";
import { PageHead, Section } from "@/components/ui/display";
import { getCategories, getRecurring, getRules } from "@/features/expenses/queries";
import { getActiveContext } from "@/lib/settings";
import { Categories, RecurringList, Rules } from "./manage-ui";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage() {
  return (
    <>
      <PageHead title="Finanças" meta={<FinanceTabs />} />
      <div className="panels-grid">
        <Section title="Categorias">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <CategoriesSection />
          </Suspense>
        </Section>
        <Section title="Despesas fixas">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <RecurringSection />
          </Suspense>
        </Section>
        <Section title="Regras automáticas" wide>
          <Suspense fallback={<p className="label">Carregando</p>}>
            <RulesSection />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function CategoriesSection() {
  return <Categories categories={await getCategories()} />;
}

async function RecurringSection() {
  const context = await getActiveContext();
  const [items, categories] = await Promise.all([getRecurring(context), getCategories()]);
  return (
    <RecurringList
      categories={categories}
      defaultContext={context === "all" ? "personal" : context}
      items={items.map((i) => ({
        id: i.id,
        description: i.description,
        amount_cents: i.amount_cents,
        due_day: i.due_day,
        category_id: i.category_id,
        category: i.category?.name ?? null,
        context: i.context,
        match_pattern: i.match_pattern,
        active: i.active,
      }))}
    />
  );
}

async function RulesSection() {
  const [rules, categories] = await Promise.all([getRules(), getCategories()]);
  return (
    <Rules
      categories={categories}
      rules={rules.map((r) => ({ id: r.id, pattern: r.pattern, category: r.category?.name ?? "—" }))}
    />
  );
}
