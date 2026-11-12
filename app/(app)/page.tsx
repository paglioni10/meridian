import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState, PageHead, Section, Stat } from "@/components/ui/display";
import { CONTEXT_LABELS } from "@/lib/context";
import { formatEditionMeta, formatEditionTitle } from "@/lib/dates";
import { getActiveContext, getSettings } from "@/lib/settings";

const PANELS = [
  { title: "Últimas transações", phase: "F4", href: "/financas", wide: false },
  { title: "Trilha de objetivos", phase: "F5", href: "/objetivos", wide: false },
  { title: "Servidores", phase: "F7", href: "/infra", wide: false },
  { title: "Freelance", phase: "F6", href: "/freelance", wide: true },
  { title: "Backlog de cursos", phase: "F2", href: "/cursos", wide: false },
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
      </div>
    </>
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
