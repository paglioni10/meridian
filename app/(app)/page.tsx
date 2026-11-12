import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState, PageHead, Progress, Row, Section, Stat } from "@/components/ui/display";
import { getCourses } from "@/features/courses/queries";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatEditionMeta, formatEditionTitle } from "@/lib/dates";
import { formatHours } from "@/lib/hours";
import { obsidianUri } from "@/lib/obsidian";
import { getActiveContext, getSettings } from "@/lib/settings";

const PANELS = [
  { title: "Últimas transações", phase: "F4", href: "/financas", wide: false },
  { title: "Trilha de objetivos", phase: "F5", href: "/objetivos", wide: false },
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
        <Stat label="Base segura" value="—" hint="F3" />
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
