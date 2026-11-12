import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseChart } from "@/components/charts/expense-chart";
import { FinanceTabs } from "@/components/shell/finance-tabs";
import { EmptyState, PageHead, Progress, Section, Stat, Tag } from "@/components/ui/display";
import {
  getCategories,
  getExpenseSeries,
  getExpenses,
  getMonthSeries,
  getRanking,
  getRecurring,
  getRecurringPayments,
} from "@/features/expenses/queries";
import { expenseFiltersSchema, NATURE_LABELS, NATURES } from "@/features/expenses/schema";
import { cn } from "@/lib/cn";
import { currentMonthISO, formatMonthLong, paydayISO, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getActiveContext } from "@/lib/settings";
import { ExpenseList, FixedChecklist, NewExpenseButton, type FixedItem } from "./expense-ui";

export const metadata: Metadata = { title: "Despesas" };

type SearchParams = PageProps<"/financas/despesas">["searchParams"];

async function readFilters(searchParams: SearchParams) {
  const parsed = expenseFiltersSchema.parse(await searchParams);
  await connection();
  return { ...parsed, month: parsed.mes ?? currentMonthISO() };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

function href(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const s = qs.toString();
  return s ? `/financas/despesas?${s}` : "/financas/despesas";
}

export default function ExpensesPage({ searchParams }: PageProps<"/financas/despesas">) {
  return (
    <>
      <PageHead
        title="Finanças"
        meta={<FinanceTabs />}
        actions={
          <Suspense fallback={null}>
            <HeadActions />
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-8" />}>
        <MonthNav searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<SummarySkeleton />}>
        <Summary searchParams={searchParams} />
      </Suspense>
      <div className="panels-grid">
        <Section title="Fixas do mês">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Fixed searchParams={searchParams} />
          </Suspense>
        </Section>
        <Section title="Por categoria">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Ranking searchParams={searchParams} />
          </Suspense>
        </Section>
        <Section title="Histórico" wide>
          <Suspense fallback={<div className="h-[260px]" />}>
            <History />
          </Suspense>
        </Section>
      </div>
      <Section title="Lançamentos">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Entries searchParams={searchParams} />
        </Suspense>
      </Section>
    </>
  );
}

async function HeadActions() {
  const [categories, context] = await Promise.all([getCategories(), getActiveContext()]);
  return (
    <>
      <Link href="/financas/importar" className="btn no-underline">
        Importar extrato
      </Link>
      <NewExpenseButton
        categories={categories.map((c) => ({ id: c.id, name: c.name, nature: c.nature }))}
        today={todayISO()}
        defaultContext={context === "all" ? "personal" : context}
      />
    </>
  );
}

async function MonthNav({ searchParams }: { searchParams: SearchParams }) {
  const f = await readFilters(searchParams);
  const current = currentMonthISO();
  const prev = shiftMonth(f.month, -1);
  const next = shiftMonth(f.month, 1);
  const keep = { categoria: f.categoria, natureza: f.natureza };
  return (
    <nav
      aria-label="Mês"
      className="flex items-center justify-between gap-3 border-b border-border-soft pb-2"
    >
      <Link
        href={href({ ...keep, mes: prev.slice(0, 7) })}
        className="btn btn-ghost no-underline"
        scroll={false}
      >
        ← {formatMonthLong(prev).split(" ")[0]}
      </Link>
      <span className="font-display text-h2 font-extrabold">{formatMonthLong(f.month)}</span>
      {f.month < current ? (
        <Link
          href={href({ ...keep, mes: next === current ? undefined : next.slice(0, 7) })}
          className="btn btn-ghost no-underline"
          scroll={false}
        >
          {formatMonthLong(next).split(" ")[0]} →
        </Link>
      ) : (
        <span className="w-24" />
      )}
    </nav>
  );
}

function SummarySkeleton() {
  return (
    <div className="stats-grid">
      <Stat label="Despesas no mês" value="—" size="display" />
      <Stat label="Fixas" value="—" />
      <Stat label="Variáveis" value="—" />
    </div>
  );
}

async function Summary({ searchParams }: { searchParams: SearchParams }) {
  const f = await readFilters(searchParams);
  const context = await getActiveContext();
  const m = await getMonthSeries(context, f.month);
  const balance = m.income_cents - m.total_cents;
  return (
    <div className="stats-grid">
      <Stat
        label="Despesas no mês"
        size="display"
        value={formatBRL(m.total_cents)}
        hint={`Ganhos ${formatBRL(m.income_cents)} · saldo ${formatBRL(balance, { sign: true })}`}
      />
      <Stat label="Fixas" value={formatBRL(m.fixed_cents)} hint="Aluguel, contas, assinaturas" />
      <Stat label="Variáveis" value={formatBRL(m.variable_cents)} hint="Mercado, lazer, compras" />
    </div>
  );
}

async function Fixed({ searchParams }: { searchParams: SearchParams }) {
  const f = await readFilters(searchParams);
  const context = await getActiveContext();
  const [recurring, payments] = await Promise.all([getRecurring(context), getRecurringPayments(f.month)]);
  const monthEnd = shiftMonth(f.month, 1);
  const today = todayISO();
  const active = recurring.filter(
    (r) => r.active && r.starts_on < monthEnd && (!r.ends_on || r.ends_on >= f.month),
  );

  if (active.length === 0) {
    return (
      <EmptyState
        title="Nenhuma fixa"
        action={
          <Link href="/financas/categorias" className="btn no-underline">
            Cadastrar fixas
          </Link>
        }
      >
        Cadastre aluguel, contas e assinaturas para acompanhar o que já foi pago.
      </EmptyState>
    );
  }

  const items: FixedItem[] = active.map((r) => {
    const paid = payments.filter((p) => p.recurring_expense_id === r.id);
    const due = paydayISO(f.month, r.due_day);
    return {
      id: r.id,
      description: r.description,
      amount_cents: r.amount_cents,
      due_day: r.due_day,
      paid_cents: paid.reduce((s, p) => s + p.amount_cents, 0),
      status: paid.length > 0 ? "paid" : today > due ? "late" : "pending",
    };
  });
  const paidCount = items.filter((i) => i.status === "paid").length;

  return (
    <div className="flex flex-col gap-2">
      <p className="label">
        {paidCount} de {items.length} pagas · {formatBRL(items.reduce((s, i) => s + i.amount_cents, 0))}{" "}
        previstos
      </p>
      <FixedChecklist items={items} month={f.month} />
    </div>
  );
}

async function Ranking({ searchParams }: { searchParams: SearchParams }) {
  const f = await readFilters(searchParams);
  const context = await getActiveContext();
  const ranking = await getRanking(context, f.month);
  if (ranking.length === 0) return <EmptyState title="Sem despesas">Nada lançado neste mês.</EmptyState>;
  const top = Math.max(...ranking.map((r) => r.total_cents));

  return (
    <ul className="flex flex-col gap-3">
      {ranking.map((r) => {
        const over = r.budget_cents !== null && r.total_cents > r.budget_cents;
        return (
          <li key={r.category_id ?? "sem"} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 font-mono text-data">
              <Link
                href={href({ mes: f.mes?.slice(0, 7), categoria: r.category_id ?? "sem" })}
                className={cn("truncate text-foreground hover:text-danger", !r.category_id && "text-danger")}
                scroll={false}
              >
                {r.name}
              </Link>
              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                {over ? <Tag>Estouro</Tag> : null}
                {formatBRL(r.total_cents)}
              </span>
            </div>
            <Progress value={(r.total_cents / top) * 100} tone={over ? "alert" : "ink"} label={r.name} />
            <span className="label">
              {r.qty} {r.qty === 1 ? "lançamento" : "lançamentos"}
              {r.budget_cents ? ` · orçamento ${formatBRL(r.budget_cents)}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

async function History() {
  const context = await getActiveContext();
  const series = await getExpenseSeries(context, 12);
  if (series.every((p) => p.total_cents === 0 && p.income_cents === 0)) {
    return <EmptyState title="Sem histórico">Importe um extrato para ver a evolução.</EmptyState>;
  }
  return (
    <ExpenseChart
      points={series.map((p) => ({
        month: p.month,
        fixed: p.fixed_cents,
        variable: p.variable_cents,
        income: p.income_cents,
      }))}
    />
  );
}

async function Entries({ searchParams }: { searchParams: SearchParams }) {
  const f = await readFilters(searchParams);
  const context = await getActiveContext();
  const [expenses, categories] = await Promise.all([
    getExpenses(context, f.month, { categoria: f.categoria, natureza: f.natureza }),
    getCategories(),
  ]);
  const base = { mes: f.mes?.slice(0, 7) };
  const activeCategory =
    f.categoria === "sem" ? "Sem categoria" : categories.find((c) => c.id === f.categoria)?.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {NATURES.map((n) => (
          <Link
            key={n}
            href={href({ ...base, categoria: f.categoria, natureza: f.natureza === n ? undefined : n })}
            aria-current={f.natureza === n ? "true" : undefined}
            className="label hover:text-danger aria-[current=true]:text-foreground aria-[current=true]:underline"
            scroll={false}
          >
            {NATURE_LABELS[n]}s
          </Link>
        ))}
        <Link
          href={href({ ...base, natureza: f.natureza, categoria: f.categoria === "sem" ? undefined : "sem" })}
          aria-current={f.categoria === "sem" ? "true" : undefined}
          className="label hover:text-danger aria-[current=true]:text-foreground aria-[current=true]:underline"
          scroll={false}
        >
          Sem categoria
        </Link>
        {f.categoria || f.natureza ? (
          <Link href={href(base)} className="label text-secondary hover:text-danger" scroll={false}>
            Limpar filtros{activeCategory ? ` (${activeCategory})` : ""}
          </Link>
        ) : null}
      </div>
      {expenses.length === 0 ? (
        <EmptyState title="Nenhuma despesa">
          Nada encontrado em {formatMonthLong(f.month).toLowerCase()} com esses filtros.
        </EmptyState>
      ) : (
        <ExpenseList
          showContext={context === "all"}
          categories={categories.map((c) => ({ id: c.id, name: c.name, nature: c.nature }))}
          expenses={expenses.map((e) => ({
            id: e.id,
            description: e.description,
            amount_cents: e.amount_cents,
            occurred_on: e.occurred_on,
            category_id: e.category_id,
            category: e.category?.name ?? null,
            nature: e.nature,
            context: e.context,
            source: e.source,
            recurring_expense_id: e.recurring_expense_id,
          }))}
        />
      )}
    </div>
  );
}
