import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES, STATUS_FILTER_VALUES, type CourseFilters } from "./schema";

const COURSE_COLUMNS =
  "id, title, url, provider, context, priority, status, estimated_hours, progress_pct, obsidian_note, started_on, finished_on, category_id, category:course_categories(name)";

export async function getCourses(filters: CourseFilters, context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();

  let query = applyContext(supabase.from("courses").select(COURSE_COLUMNS), context);

  if (filters.horas !== undefined) {
    query = query.eq("status", "backlog").lte("estimated_hours", filters.horas);
  } else {
    query = query.in("status", STATUS_FILTER_VALUES[filters.status]);
  }
  if (filters.categoria) query = query.eq("category_id", filters.categoria);
  if (filters.prioridade) query = query.eq("priority", filters.prioridade);

  const { data, error } = await query
    .order("priority", { ascending: false })
    .order("estimated_hours", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Falha ao carregar cursos: ${error.message}`);
  return data;
}

export type CourseRow = Awaited<ReturnType<typeof getCourses>>[number];

export async function getCourseSummary(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await applyContext(
    supabase.from("courses").select("status, estimated_hours, progress_pct"),
    context,
  );
  if (error) throw new Error(`Falha ao carregar resumo: ${error.message}`);

  const open = data.filter((c) => OPEN_STATUSES.includes(c.status));
  const backlogHours = data
    .filter((c) => c.status === "backlog")
    .reduce((sum, c) => sum + (c.estimated_hours ?? 0), 0);
  const remainingHours = data
    .filter((c) => c.status === "in_progress")
    .reduce((sum, c) => sum + ((c.estimated_hours ?? 0) * (100 - c.progress_pct)) / 100, 0);

  return {
    open: open.length,
    inProgress: data.filter((c) => c.status === "in_progress").length,
    done: data.filter((c) => c.status === "done").length,
    backlogHours: Math.round(backlogHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
  };
}

export async function getCategories() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_categories").select("id, name").order("name");
  if (error) throw new Error(`Falha ao carregar categorias: ${error.message}`);
  return data;
}
