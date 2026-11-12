import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHead, Stat } from "@/components/ui/display";
import { getGoalDetails, getGoals } from "@/features/goals/queries";
import { HORIZONS } from "@/features/goals/schema";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getActiveContext } from "@/lib/settings";
import { ClosedGoals, GoalTrail, NewGoalButton, type GoalItem } from "./goal-ui";

export const metadata: Metadata = { title: "Objetivos" };

export default function GoalsPage() {
  return (
    <>
      <PageHead
        title="Objetivos"
        meta="Trilha de curto, médio e longo prazo"
        actions={
          <Suspense fallback={null}>
            <HeadActions />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="label">Carregando trilha</p>}>
        <Trail />
      </Suspense>
    </>
  );
}

async function HeadActions() {
  const context = await getActiveContext();
  return <NewGoalButton defaultContext={context === "all" ? "personal" : context} />;
}

async function Trail() {
  const context = await getActiveContext();
  const goals = await getGoals(context);
  const { milestones, contributions } = await getGoalDetails(goals.map((g) => g.id));
  const today = todayISO();

  const items: GoalItem[] = goals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    context: g.context,
    horizon: g.horizon,
    status: g.status,
    target_cents: g.target_cents,
    target_date: g.target_date,
    saved_cents: g.saved_cents,
    pct: Number(g.pct),
    months_left: g.months_left,
    monthly_needed_cents: g.monthly_needed_cents,
    is_late: g.is_late,
    milestones: milestones
      .filter((m) => m.goal_id === g.id)
      .map((m) => ({ id: m.id, title: m.title, done: m.done_at !== null })),
    contributions: contributions
      .filter((c) => c.goal_id === g.id)
      .map((c) => ({
        id: c.id,
        amount_cents: c.amount_cents,
        contributed_on: c.contributed_on,
        note: c.note,
      })),
  }));

  const open = items.filter((g) => g.status === "active" || g.status === "paused");
  const closed = items.filter((g) => g.status === "achieved" || g.status === "archived");

  if (items.length === 0) {
    return (
      <EmptyState title="Nenhum objetivo ainda">
        Crie metas de curto, médio e longo prazo. Com valor e data, o Meridian calcula quanto guardar por mês;
        sem valor, o progresso vem dos marcos.
      </EmptyState>
    );
  }

  const saved = open.reduce((s, g) => s + g.saved_cents, 0);
  const target = open.reduce((s, g) => s + (g.target_cents ?? 0), 0);
  const monthly = open
    .filter((g) => g.status === "active")
    .reduce((s, g) => s + (g.monthly_needed_cents ?? 0), 0);
  const late = open.filter((g) => g.is_late).length;

  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Guardado nos objetivos"
          size="display"
          value={formatBRL(saved)}
          hint={target ? `de ${formatBRL(target)} em metas com valor` : undefined}
        />
        <Stat label="Aporte mensal necessário" value={formatBRL(monthly)} hint="Para cumprir as datas" />
        <Stat
          label="Em andamento"
          value={open.length}
          alert={late > 0}
          hint={
            late
              ? `${late} ${late === 1 ? "atrasado" : "atrasados"}`
              : `${closed.filter((g) => g.status === "achieved").length} concluídos`
          }
        />
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        {HORIZONS.map((h) => (
          <GoalTrail key={h} horizon={h} today={today} goals={open.filter((g) => g.horizon === h)} />
        ))}
      </div>
      {closed.length > 0 ? <ClosedGoals goals={closed} today={today} /> : null}
    </>
  );
}
