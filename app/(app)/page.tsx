import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState, PageHead, Progress, Row, Section, Stat } from "@/components/ui/display";
import { getCourses } from "@/features/courses/queries";
import { getGoals } from "@/features/goals/queries";
import { getExpenses } from "@/features/expenses/queries";
import { getDeals } from "@/features/freelance/queries";
import { getSafeBase } from "@/features/income/queries";
import { getRenewals, getServices } from "@/features/infra/queries";
import { getBoard } from "@/features/projects/queries";
import { currentMonthISO, formatDayMonth, formatEditionMeta, formatEditionTitle } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatHours } from "@/lib/hours";
import { obsidianUri } from "@/lib/obsidian";
import { getActiveContext, getSettings } from "@/lib/settings";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<PageHead title="Visão geral" meta="Carregando edição" />}>
        <EditionHead />
      </Suspense>

      <div className="stats-grid">
        <Stat label="Saldo do mês" value="—" hint="F4" />
        <Suspense fallback={<Stat label="Base segura" value="—" />}>
          <SafeBaseStat />
        </Suspense>
        <Suspense fallback={<Stat label="Pipeline aberto" value="—" />}>
          <PipelineStat />
        </Suspense>
        <Suspense fallback={<Stat label="Serviços online" value="—" />}>
          <ServicesStat />
        </Suspense>
      </div>

      <div className="panels-grid">
        <Section
          title="Servidores"
          action={
            <Link href="/infra" className="label hover:text-danger">
              Abrir →
            </Link>
          }
        >
          <Suspense fallback={<p className="label">Carregando</p>}>
            <InfraPanel />
          </Suspense>
        </Section>
        <Section
          title="Últimas despesas"
          action={
            <Link href="/financas/despesas" className="label hover:text-danger">
              Abrir →
            </Link>
          }
        >
          <Suspense fallback={<p className="label">Carregando</p>}>
            <LatestExpenses />
          </Suspense>
        </Section>
        <Section
          title="Em curso"
          wide
          action={
            <Link href="/projetos" className="label hover:text-danger">
              Abrir →
            </Link>
          }
        >
          <Suspense fallback={<p className="label">Carregando</p>}>
            <DoingTasks />
          </Suspense>
        </Section>
        <Section
          title="Trilha de objetivos"
          action={
            <Link href="/objetivos" className="label hover:text-danger">
              Abrir →
            </Link>
          }
        >
          <Suspense fallback={<p className="label">Carregando</p>}>
            <ActiveGoals />
          </Suspense>
        </Section>
        <Section
          title="Backlog de cursos"
          action={
            <Link href="/cursos" className="label hover:text-danger">
              Abrir →
            </Link>
          }
        >
          <Suspense fallback={<p className="label">Carregando</p>}>
            <NextCourses />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function NextCourses() {
  const [context, settings] = await Promise.all([getActiveContext(), getSettings()]);
  const courses = (await getCourses({ status: "abertos" }, context)).slice(0, 4);
  if (courses.length === 0) {
    return <EmptyState title="Backlog vazio">Adicione cursos em Estudos.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      {courses.map((c) => (
        <div key={c.id} className="flex flex-col gap-1">
          <Row
            left={
              settings.obsidian_vault && c.obsidian_note ? (
                <a href={obsidianUri(settings.obsidian_vault, c.obsidian_note)}>{c.title}</a>
              ) : (
                c.title
              )
            }
            right={c.status === "in_progress" ? `${c.progress_pct}%` : formatHours(c.estimated_hours)}
          />
          {c.status === "in_progress" ? (
            <Progress value={c.progress_pct} tone="active" label={`Progresso de ${c.title}`} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function EditionHead() {
  await connection();
  const [settings, context] = await Promise.all([getSettings(), getActiveContext()]);
  const now = new Date();
  return (
    <PageHead
      title={formatEditionTitle(now, settings.timezone)}
      meta={`${formatEditionMeta(now, settings.timezone)} · ${CONTEXT_LABELS[context]}`}
    />
  );
}

async function SafeBaseStat() {
  const base = await getSafeBase(await getActiveContext());
  return (
    <Stat
      label="Base segura"
      value={base.months_considered > 0 ? formatBRL(base.safe_base_cents) : "—"}
      hint={base.months_considered > 0 ? `${base.months_considered} meses` : "Lance seus ganhos"}
    />
  );
}

async function ActiveGoals() {
  const goals = (await getGoals(await getActiveContext())).filter((g) => g.status === "active").slice(0, 4);
  if (goals.length === 0) {
    return <EmptyState title="Sem objetivos ativos">Crie metas em Objetivos.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-3">
      {goals.map((g) => (
        <div key={g.id} className="flex flex-col gap-1.5">
          <Row
            left={g.title}
            right={`${Number(g.pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
            className="border-0 pb-0"
          />
          <Progress
            value={Number(g.pct)}
            tone={g.is_late ? "alert" : Number(g.pct) > 0 ? "active" : "ink"}
            label={`Progresso de ${g.title}`}
          />
          {g.target_cents !== null ? (
            <span className="label">
              {formatBRL(g.saved_cents)} de {formatBRL(g.target_cents)}
              {g.is_late ? " · atrasado" : ""}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function PipelineStat() {
  const deals = (await getDeals()).filter((d) => d.stage !== "won" && d.stage !== "lost");
  return (
    <Stat
      label="Pipeline aberto"
      value={formatBRL(deals.reduce((s, d) => s + (d.value_cents ?? 0), 0))}
      hint={`${deals.length} ${deals.length === 1 ? "negócio" : "negócios"}`}
    />
  );
}

async function DoingTasks() {
  const tasks = (await getBoard(await getActiveContext())).filter((t) => t.status === "doing").slice(0, 6);
  if (tasks.length === 0) {
    return <EmptyState title="Nada em curso">Mova tarefas para Em curso no quadro de Projetos.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((t) => (
        <Row
          key={t.id}
          left={t.project?.name ? `${t.title} · ${t.project.name}` : t.title}
          right={t.due_on ? formatDayMonth(t.due_on) : ""}
        />
      ))}
    </div>
  );
}

async function LatestExpenses() {
  await connection();
  const context = await getActiveContext();
  const expenses = (await getExpenses(context, currentMonthISO(), {})).slice(0, 5);
  if (expenses.length === 0) {
    return <EmptyState title="Sem despesas no mês">Importe o extrato em Finanças.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      {expenses.map((e) => (
        <Row
          key={e.id}
          left={`${formatDayMonth(e.occurred_on)} ${e.description}`}
          right={formatBRL(-e.amount_cents)}
        />
      ))}
    </div>
  );
}

async function ServicesStat() {
  const services = (await getServices(await getActiveContext())).filter(
    (s) => s.active && s.check_method !== "manual",
  );
  const down = services.filter((s) => s.last_state === "down");
  const online = services.filter((s) => s.last_state === "up" || s.last_state === "degraded").length;
  return (
    <Stat
      label="Serviços online"
      value={services.length ? `${online}/${services.length}` : "—"}
      alert={down.length > 0}
      hint={
        down.length
          ? `Offline: ${down.map((s) => s.name).join(", ")}`
          : services.length
            ? "Todos respondendo"
            : "Nenhum serviço"
      }
    />
  );
}

async function InfraPanel() {
  const context = await getActiveContext();
  const [services, renewals] = await Promise.all([getServices(context), getRenewals(context)]);
  const problems = services.filter(
    (s) => s.active && (s.last_state === "down" || s.last_state === "degraded"),
  );
  const due = renewals.filter((r) => r.urgency !== "ok").slice(0, 4);
  if (services.length === 0 && renewals.length === 0) {
    return <EmptyState title="Nada monitorado">Cadastre a VPS, o n8n, os sites e os vencimentos.</EmptyState>;
  }
  if (problems.length === 0 && due.length === 0) {
    return <p className="label">Tudo online e nenhum vencimento nos próximos 30 dias.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {problems.map((s) => (
        <Row
          key={s.id}
          left={s.name}
          right={
            <span className="font-mono text-label text-danger uppercase">
              {s.last_state === "down" ? "Offline" : "Lento"}
            </span>
          }
        />
      ))}
      {due.map((r) => (
        <Row
          key={r.id}
          left={r.name}
          right={
            <span
              className={
                r.urgency === "warning" ? "font-mono text-label" : "font-mono text-label text-danger"
              }
            >
              {r.days_left < 0 ? "VENCIDO" : `${r.days_left} d`}
            </span>
          }
        />
      ))}
    </div>
  );
}
