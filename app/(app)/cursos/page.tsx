import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHead, Stat } from "@/components/ui/display";
import { getCategories, getCourseSummary, getCourses } from "@/features/courses/queries";
import { filtersSchema, PRIORITY_LABELS, STATUS_FILTER_LABELS } from "@/features/courses/schema";
import { getActiveContext, getSettings } from "@/lib/settings";
import { formatHours } from "@/lib/hours";
import { CourseList } from "./course-list";
import { NewCourseButton } from "./course-form";
import { CourseFilters } from "./filters";

export const metadata: Metadata = { title: "Estudos" };

export default function CoursesPage({ searchParams }: PageProps<"/cursos">) {
  return (
    <>
      <PageHead
        title="Estudos"
        meta="Backlog de cursos"
        actions={
          <Suspense fallback={null}>
            <NewCourse />
          </Suspense>
        }
      />
      <Suspense fallback={<SummarySkeleton />}>
        <Summary />
      </Suspense>
      <Suspense fallback={<p className="label">Carregando filtros</p>}>
        <Filters />
      </Suspense>
      <Suspense fallback={<p className="label">Carregando cursos</p>}>
        <Courses searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewCourse() {
  const [categories, context] = await Promise.all([getCategories(), getActiveContext()]);
  return (
    <NewCourseButton
      categories={categories.map((c) => c.name)}
      defaultContext={context === "all" ? "personal" : context}
    />
  );
}

function SummarySkeleton() {
  return (
    <div className="stats-grid">
      {["Abertos", "Em curso", "Horas no backlog", "Concluídos"].map((label) => (
        <Stat key={label} label={label} value="—" />
      ))}
    </div>
  );
}

async function Summary() {
  const summary = await getCourseSummary(await getActiveContext());
  return (
    <div className="stats-grid">
      <Stat label="Abertos" value={summary.open} />
      <Stat
        label="Em curso"
        value={summary.inProgress}
        hint={summary.inProgress ? `${formatHours(summary.remainingHours)} restantes` : undefined}
      />
      <Stat label="Horas no backlog" value={formatHours(summary.backlogHours)} />
      <Stat label="Concluídos" value={summary.done} />
    </div>
  );
}

async function Filters() {
  return <CourseFilters categories={await getCategories()} />;
}

async function Courses({ searchParams }: { searchParams: PageProps<"/cursos">["searchParams"] }) {
  const filters = filtersSchema.parse(await searchParams);
  const context = await getActiveContext();
  const [courses, categories, settings] = await Promise.all([
    getCourses(filters, context),
    getCategories(),
    getSettings(),
  ]);

  if (courses.length === 0) {
    const reason =
      filters.horas !== undefined
        ? `Nenhum curso do backlog cabe em ${formatHours(filters.horas)}.`
        : `Nenhum curso em “${STATUS_FILTER_LABELS[filters.status]}”${
            filters.prioridade ? ` com prioridade ${PRIORITY_LABELS[filters.prioridade].toLowerCase()}` : ""
          }.`;
    return (
      <EmptyState title="Nada por aqui">
        {reason} Use <strong>Novo curso</strong> para adicionar ou ajuste os filtros.
      </EmptyState>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {filters.horas !== undefined ? (
        <p className="label">
          {courses.length} {courses.length === 1 ? "curso cabe" : "cursos cabem"} em{" "}
          {formatHours(filters.horas)}, por prioridade
        </p>
      ) : null}
      {!settings.obsidian_vault && courses.some((c) => c.obsidian_note) ? (
        <p className="label">
          Para abrir as notas, informe o nome do vault em{" "}
          <Link href="/ajustes" className="hover:text-danger">
            Ajustes
          </Link>
          .
        </p>
      ) : null}
      <CourseList
        vault={settings.obsidian_vault}
        categories={categories.map((c) => c.name)}
        showContext={context === "all"}
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          url: c.url,
          provider: c.provider,
          category: c.category?.name ?? null,
          context: c.context,
          priority: c.priority,
          status: c.status,
          estimated_hours: c.estimated_hours,
          progress_pct: c.progress_pct,
          obsidian_note: c.obsidian_note,
        }))}
      />
    </section>
  );
}
