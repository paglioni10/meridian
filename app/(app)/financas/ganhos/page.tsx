import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IncomeChart } from "@/components/charts/income-chart";
import { FinanceTabs } from "@/components/shell/finance-tabs";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import { getIncomeSeries, getIncomeSources, getIncomes, getSafeBase } from "@/features/income/queries";
import { RANGES, rangeSchema, type Range } from "@/features/income/schema";
import { cn } from "@/lib/cn";
import { currentMonthISO, formatMonthLong, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getActiveContext } from "@/lib/settings";
import { NewIncomeButton, NewSourceButton } from "./forms";
import { IncomeList, SourceList } from "./lists";

export const metadata: Metadata = { title: "Ganhos" };

type SearchParams = PageProps<"/financas/ganhos">["searchParams"];

export default function IncomePage({ searchParams }: PageProps<"/financas/ganhos">) {
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
      <Suspense fallback={<SummarySkeleton />}>
        <Summary />
      </Suspense>
      <Section
        title="Evolução"
        action={
          <Suspense fallback={null}>
            <RangePicker searchParams={searchParams} />
          </Suspense>
        }
      >
        <Suspense fallback={<div className="h-[260px]" />}>
          <Evolution searchParams={searchParams} />
        </Suspense>
      </Section>
      <div className="panels-grid xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] 3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Section title="Fontes de renda">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Sources />
          </Suspense>
        </Section>
        <Section title="Lançamentos">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Incomes searchParams={searchParams} />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function HeadActions() {
  const context = await getActiveContext();
  const sources = await getIncomeSources(context);
  return (
    <>
      <NewSourceButton defaultContext={context === "all" ? "work" : context} primary={sources.length === 0} />
      {sources.length > 0 ? (
        <NewIncomeButton
          sources={sources.map((s) => ({ id: s.id, name: s.name, kind: s.kind, active: s.active }))}
          month={currentMonthISO()}
          today={todayISO()}
        />
      ) : null}
    </>
  );
}

async function readRange(searchParams: SearchParams): Promise<Range> {
  return rangeSchema.parse((await searchParams).meses);
}

async function RangePicker({ searchParams }: { searchParams: SearchParams }) {
  const range = await readRange(searchParams);
  return (
    <nav aria-label="Período" className="flex gap-3">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={r === 12 ? "/financas/ganhos" : `/financas/ganhos?meses=${r}`}
          scroll={false}
          aria-current={r === range ? "page" : undefined}
          className={cn(
            "label hover:text-danger",
            r === range && "text-foreground underline underline-offset-4",
          )}
        >
          {r} meses
        </Link>
      ))}
    </nav>
  );
}

function SummarySkeleton() {
  return (
    <div className="stats-grid">
      <Stat label="Base segura mensal" value="—" size="display" />
      <Stat label="Garantida no mês" value="—" />
      <Stat label="Variável no mês" value="—" />
    </div>
  );
}

async function Summary() {
  const context = await getActiveContext();
  const [base, series] = await Promise.all([getSafeBase(context), getIncomeSeries(context, 12)]);
  const current = series[series.length - 1];
  const monthName = formatMonthLong(current.month).split(" ")[0].toLowerCase();

  return (
    <div className="stats-grid">
      <Stat
        label="Base segura mensal"
        size="display"
        value={base.months_considered > 0 ? formatBRL(base.safe_base_cents) : "—"}
        hint={
          base.months_considered > 0
            ? `${formatBRL(base.guaranteed_cents)} garantida + ${formatBRL(base.variable_floor_cents)} variável · ${base.months_considered} ${base.months_considered === 1 ? "mês" : "meses"}`
            : "Lance ganhos de um mês fechado para calcular"
        }
      />
      <Stat
        label={`Garantida em ${monthName}`}
        value={formatBRL(current.guaranteed_cents)}
        hint="CLT e fixos"
      />
      <Stat
        label={`Variável em ${monthName}`}
        value={formatBRL(current.variable_cents)}
        hint="PJ e freelance"
      />
    </div>
  );
}

async function Evolution({ searchParams }: { searchParams: SearchParams }) {
  const range = await readRange(searchParams);
  const context = await getActiveContext();
  const [series, base] = await Promise.all([getIncomeSeries(context, range), getSafeBase(context)]);

  if (series.every((p) => p.total_cents === 0)) {
    return (
      <EmptyState title="Sem ganhos no período">Cadastre uma fonte e lance o primeiro ganho.</EmptyState>
    );
  }

  const closed = series.slice(0, -1).filter((p) => p.total_cents > 0);
  const average = closed.length
    ? Math.round(closed.reduce((s, p) => s + p.total_cents, 0) / closed.length)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {closed.length ? (
        <p className="label">
          Média mensal <span className="text-foreground tabular-nums">{formatBRL(average)}</span> ·{" "}
          {closed.length} {closed.length === 1 ? "mês fechado" : "meses fechados"} com ganhos no período
        </p>
      ) : null}
      <IncomeChart
        safeBase={base.months_considered > 0 ? base.safe_base_cents : 0}
        points={series.map((p) => ({
          month: p.month,
          total: p.total_cents,
          guaranteed: p.guaranteed_cents,
          variable: p.variable_cents,
        }))}
      />
    </div>
  );
}

async function Sources() {
  const context = await getActiveContext();
  const sources = await getIncomeSources(context);
  if (sources.length === 0) {
    return (
      <EmptyState title="Nenhuma fonte">
        Cadastre de onde vem sua renda: o salário CLT como renda garantida e clientes PJ ou freelas como renda
        variável.
      </EmptyState>
    );
  }
  return <SourceList sources={sources} showContext={context === "all"} />;
}

async function Incomes({ searchParams }: { searchParams: SearchParams }) {
  const range = await readRange(searchParams);
  const context = await getActiveContext();
  const series = await getIncomeSeries(context, range);
  const [incomes, sources] = await Promise.all([
    getIncomes(context, series[0].month),
    getIncomeSources(context),
  ]);

  if (incomes.length === 0) {
    return <EmptyState title="Nenhum lançamento">Nada lançado nos últimos {range} meses.</EmptyState>;
  }

  return (
    <IncomeList
      showContext={context === "all"}
      sources={sources.map((s) => ({ id: s.id, name: s.name, kind: s.kind, active: s.active }))}
      incomes={incomes.map((i) => ({
        id: i.id,
        source_id: i.source_id,
        source: i.source?.name ?? "Fonte",
        kind: i.kind,
        context: i.context,
        competence_month: i.competence_month,
        received_on: i.received_on,
        amount_cents: i.amount_cents,
        gross_cents: i.gross_cents,
        description: i.description,
      }))}
    />
  );
}
