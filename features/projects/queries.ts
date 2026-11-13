import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { applyContext, type AppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export async function getProjects(context: AppContext) {
  await getCurrentUser();
  const supabase = await createClient();
  const [{ data: projects, error }, { data: tasks, error: taskError }] = await Promise.all([
    applyContext(
      supabase
        .from("projects")
        .select(
          "id, name, description, context, status, due_on, deal_id, deal:deals(title, client:clients(name))",
        ),
      context,
    )
      .order("status")
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("project_id, status").is("archived_at", null).not("project_id", "is", null),
  ]);
  if (error) throw new Error(`Falha ao carregar projetos: ${error.message}`);
  if (taskError) throw new Error(`Falha ao contar tarefas: ${taskError.message}`);
  return projects.map((p) => {
    const own = tasks.filter((t) => t.project_id === p.id);
    return {
      ...p,
      client: p.deal?.client?.name ?? null,
      openTasks: own.filter((t) => t.status !== "done").length,
      doneTasks: own.filter((t) => t.status === "done").length,
    };
  });
}

export type ProjectRow = Awaited<ReturnType<typeof getProjects>>[number];

export async function getBoard(context: AppContext, projectId?: string) {
  await getCurrentUser();
  const supabase = await createClient();
  let query = applyContext(
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, due_on, position, context, project_id, project:projects(name)",
      )
      .is("archived_at", null),
    context,
  );
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("position").order("created_at");
  if (error) throw new Error(`Falha ao carregar o quadro: ${error.message}`);
  return data;
}

export type BoardTaskRow = Awaited<ReturnType<typeof getBoard>>[number];
