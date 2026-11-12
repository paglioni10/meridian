import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState, PageHead, Progress, Row, Section, Stat } from "@/components/ui/display";
import { getCourses } from "@/features/courses/queries";
import { getGoals } from "@/features/goals/queries";
import { getSafeBase } from "@/features/income/queries";
import { formatBRL } from "@/lib/money";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatEditionMeta, formatEditionTitle } from "@/lib/dates";
import { formatHours } from "@/lib/hours";
import { obsidianUri } from "@/lib/obsidian";
import { getActiveContext, getSettings } from "@/lib/settings";

const PANELS = [
  { title: "Últimas transações", phase: "F4", href: "/financas", wide: false },
  { title: "Servidores", phase: "F7", href: "/infra", wide: false },
  { title: "Freelance", phase: "F6", href: "/freelance", wide: true },
];

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
        <Stat label="Pipeline aberto" value="—" hint="F6" />
        <Stat label="Serviços online" value="—" hint="F7" />
      </div>

      <div className="panels-grid">
        {PANELS.map((panel) => (
          <Section
            key={panel.title}
            title={panel.title}
            wide={panel.wide}
            action={
              <Link href={panel.href} className="label hover:text-danger">
                Abrir →
              </Link>
            }
          >
            <EmptyState title="Sem dados">Disponível na fase {panel.phase}.</EmptyState>
          </Section>
        ))}
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
