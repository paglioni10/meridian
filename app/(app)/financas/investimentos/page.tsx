import type { Metadata } from "next";
import { Suspense } from "react";
import { ContributionChart, type ContributionPoint } from "@/components/charts/contribution-chart";
import { FinanceTabs } from "@/components/shell/finance-tabs";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import { getGoals } from "@/features/goals/queries";
import {
  getMonthlyFlows,
  getPortfolioSummary,
  getPositions,
  getTargets,
  getTransactions,
} from "@/features/investments/queries";
import { currentMonthISO, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getActiveContext } from "@/lib/settings";
import {
  AllocationBars,
  HeadActions,
  Portfolio,
  TransactionList,
  type PositionItem,
  type TransactionItem,
} from "./investments-ui";

export const metadata: Metadata = { title: "Investimentos" };

export default function InvestmentsPage() {
  return (
    <>
      <PageHead
        title="Finanças"
        meta={<FinanceTabs />}
        actions={
          <Suspense fallback={null}>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="label">Carregando patrimônio</p>}>
        <Summary />
      </Suspense>
      <div className="panels-grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] 3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section title="Carteira">
          <Suspense fallback={<p className="label">Carregando carteira</p>}>
            <PortfolioSection />
          </Suspense>
        </Section>
        <Section title="Alocação">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Allocation />
          </Suspense>
        </Section>
      </div>
      <Section title="Aportes × sobra de caixa">
        <Suspense fallback={<div className="h-[240px]" />}>
          <Contributions />
        </Suspense>
      </Section>
      <Section title="Movimentações">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Transactions />
        </Suspense>
      </Section>
    </>
  );
}

async function goalOptions() {
  const goals = await getGoals("all");
  return goals.filter((g) => g.status === "active").map((g) => ({ id: g.id, name: g.title }));
}

async function Actions() {
  const context = await getActiveContext();
  const [positions, goals, targets] = await Promise.all([getPositions(context), goalOptions(), getTargets()]);
  return (
    <HeadActions assets={positions as PositionItem[]} goals={goals} targets={targets} today={todayISO()} />
  );
}

async function Summary() {
  const context = await getActiveContext();
  const s = await getPortfolioSummary(context, currentMonthISO());
  const sign = s.result_cents === 0 ? "" : s.result_cents > 0 ? "+" : "−";
  return (
    <div className="stats-grid">
      <Stat
        label="Patrimônio"
        size="display"
        value={formatBRL(s.equity_cents)}
        hint={`Aportado ${formatBRL(s.invested_cents)}`}
      />
      <Stat
        label="Resultado"
        value={`${sign}${formatBRL(Math.abs(s.result_cents))}`}
        hint={
          s.return_pct !== null
            ? `${Number(s.return_pct) >= 0 ? "+" : "−"}${Math.abs(Number(s.return_pct)).toFixed(1).replace(".", ",")}% desde o início`
            : "Sem aportes"
        }
      />
      <Stat
        label="Aporte no mês"
        value={formatBRL(s.net_contribution_month_cents, { sign: s.net_contribution_month_cents < 0 })}
        hint="Aportes − resgates"
      />
      <Stat
        label="Proventos no mês"
        value={formatBRL(s.income_month_cents)}
        hint="Dividendos e rendimentos"
      />
    </div>
  );
}

async function PortfolioSection() {
  const context = await getActiveContext();
  const [positions, goals] = await Promise.all([getPositions(context), goalOptions()]);
  if (positions.length === 0) {
    return (
      <EmptyState title="Carteira vazia">
        Cadastre cada investimento como ativo. Ações, FIIs, ETFs e cripto usam cotação automática; Caixinhas,
        CDB e Tesouro usam o saldo que você informa.
      </EmptyState>
    );
  }
  const now = Date.parse(`${todayISO()}T12:00:00Z`);
  const staleDays = Object.fromEntries(
    positions.map((p) => [
      p.id,
      p.price_updated_at ? Math.floor((now - Date.parse(p.price_updated_at)) / 86_400_000) : null,
    ]),
  );
  return (
    <Portfolio
      positions={positions as PositionItem[]}
      goals={goals}
      today={todayISO()}
      staleDays={staleDays}
    />
  );
}

async function Allocation() {
  const context = await getActiveContext();
  const s = await getPortfolioSummary(context, currentMonthISO());
  if (s.equity_cents === 0 && s.classes.every((c) => c.target_pct === 0)) {
    return <p className="label">A alocação aparece quando houver ativos com saldo.</p>;
  }
  return <AllocationBars classes={s.classes} equityCents={s.equity_cents} />;
}

async function Contributions() {
  const context = await getActiveContext();
  const flows = await getMonthlyFlows(context, 12);
  const byMonth = new Map<string, ContributionPoint>();
  for (const row of flows.incomes) {
    const month = String(row.month);
    byMonth.set(month, { month, contributed: 0, surplus: Number(row.total_cents ?? 0) });
  }
  for (const row of flows.expenses) {
    const month = String(row.month);
    const p = byMonth.get(month) ?? { month, contributed: 0, surplus: 0 };
    p.surplus -= Number(row.total_cents ?? 0);
    byMonth.set(month, p);
  }
  for (const t of flows.transactions) {
    const month = `${t.occurred_on.slice(0, 7)}-01`;
    const p = byMonth.get(month);
    if (!p) continue;
    p.contributed += t.type === "contribution" ? t.total_amount_cents : -t.total_amount_cents;
  }
  const points = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (points.every((p) => p.contributed === 0 && p.surplus === 0)) {
    return (
      <p className="label">
        Lance ganhos, despesas e aportes para comparar quanto sobra e quanto é investido.
      </p>
    );
  }
  return <ContributionChart points={points} />;
}

async function Transactions() {
  const rows = await getTransactions();
  if (rows.length === 0) return <p className="label">Nenhuma movimentação ainda.</p>;
  const items: TransactionItem[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    quantity: t.quantity === null ? null : Number(t.quantity),
    unit_price: t.unit_price === null ? null : Number(t.unit_price),
    total_amount_cents: t.total_amount_cents,
    occurred_on: t.occurred_on,
    notes: t.notes,
    asset: t.asset?.ticker_or_name ?? "Ativo",
  }));
  return <TransactionList items={items} />;
}
