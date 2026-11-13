import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHead, Section } from "@/components/ui/display";
import { getBoard, getProjects } from "@/features/projects/queries";
import { boardFiltersSchema } from "@/features/projects/schema";
import { todayISO } from "@/lib/dates";
import { getActiveContext } from "@/lib/settings";
import { Board } from "./board";
import { ArchiveDoneButton, ProjectFilter, ProjectList } from "./project-ui";
import { NewProjectButton, NewTaskButton } from "./task-forms";

export const metadata: Metadata = { title: "Projetos" };

type SearchParams = PageProps<"/projetos">["searchParams"];

export default function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  return (
    <>
      <PageHead
        title="Projetos"
        meta="Trabalho, projetos pessoais e freelance num só quadro"
        actions={
          <Suspense fallback={null}>
            <HeadActions searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="label">Carregando quadro</p>}>
        <BoardSection searchParams={searchParams} />
      </Suspense>
      <Section title="Projetos">
        <Suspense fallback={<p className="label">Carregando</p>}>
          <Projects />
        </Suspense>
      </Section>
    </>
  );
}

async function HeadActions({ searchParams }: { searchParams: SearchParams }) {
  const { projeto } = boardFiltersSchema.parse(await searchParams);
  const context = await getActiveContext();
  const projects = await getProjects(context);
  const defaultContext = context === "all" ? "personal" : context;
  return (
    <>
      <NewProjectButton defaultContext={defaultContext} />
      <NewTaskButton
        defaultContext={defaultContext}
        defaultProject={projeto ?? ""}
        projects={projects
          .filter((p) => p.status === "active" || p.status === "on_hold")
          .map((p) => ({ id: p.id, name: p.name, context: p.context }))}
      />
    </>
  );
}

async function BoardSection({ searchParams }: { searchParams: SearchParams }) {
  const { projeto } = boardFiltersSchema.parse(await searchParams);
  const context = await getActiveContext();
  const [tasks, projects] = await Promise.all([getBoard(context, projeto), getProjects(context)]);
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "on_hold");
  const today = todayISO();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ProjectFilter projects={projects.map((p) => ({ id: p.id, name: p.name }))} value={projeto ?? ""} />
        <ArchiveDoneButton count={tasks.filter((t) => t.status === "done").length} />
      </div>
      <Board
        today={today}
        projectFilter={projeto ?? null}
        defaultContext={context === "all" ? "personal" : context}
        projects={activeProjects.map((p) => ({ id: p.id, name: p.name, context: p.context }))}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          due_on: t.due_on,
          context: t.context,
          project_id: t.project_id,
          project: t.project?.name ?? null,
        }))}
      />
    </div>
  );
}

async function Projects() {
  const context = await getActiveContext();
  const projects = await getProjects(context);
  if (projects.length === 0) {
    return (
      <EmptyState title="Nenhum projeto">
        Agrupe tarefas em projetos. Negócios ganhos em Freelance criam o projeto automaticamente.
      </EmptyState>
    );
  }
  return (
    <ProjectList
      today={todayISO()}
      showContext={context === "all"}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        context: p.context,
        status: p.status,
        due_on: p.due_on,
        client: p.client,
        openTasks: p.openTasks,
        doneTasks: p.doneTasks,
      }))}
    />
  );
}
