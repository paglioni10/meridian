"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CONTEXT_KINDS, projectInputSchema, TASK_STATUSES, taskInputSchema } from "./schema";

export type ActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function collect(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function invalid(issues: z.core.$ZodIssue[], values: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return { status: "error", message: "Revise os campos destacados.", fieldErrors, values };
}

async function nextPosition(status: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("position")
    .eq("status", status as (typeof TASK_STATUSES)[number])
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.position ?? 0) + 1024;
}

export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "title",
    "description",
    "project_id",
    "context",
    "priority",
    "status",
    "due_on",
  ]);
  const parsed = taskInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  if (id) {
    const { data: current } = await supabase.from("tasks").select("status").eq("id", id).single();
    const position =
      current && current.status !== values.status ? await nextPosition(values.status) : undefined;
    const { error } = await supabase
      .from("tasks")
      .update({ ...values, ...(position !== undefined ? { position } : {}) })
      .eq("id", id);
    if (error) return { status: "error", message: "Não foi possível salvar a tarefa.", values: raw };
  } else {
    const { error } = await supabase
      .from("tasks")
      .insert({ ...values, user_id: user.id, position: await nextPosition(values.status) });
    if (error) return { status: "error", message: "Não foi possível criar a tarefa.", values: raw };
  }

  refresh();
  return { status: "saved", message: id ? "Tarefa atualizada." : "Tarefa criada." };
}

export async function quickAddTask(input: {
  title: string;
  status: string;
  projectId: string | null;
  context: string;
}) {
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(160),
      status: z.enum(TASK_STATUSES),
      projectId: z.uuid().nullable(),
      context: z.enum(CONTEXT_KINDS),
    })
    .parse(input);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title: parsed.title,
    status: parsed.status,
    project_id: parsed.projectId,
    context: parsed.context,
    position: await nextPosition(parsed.status),
  });
  if (error) throw new Error("Não foi possível criar a tarefa.");
  refresh();
}

export async function moveTask(id: string, status: string, beforeId: string | null, afterId: string | null) {
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(TASK_STATUSES),
      beforeId: z.uuid().nullable(),
      afterId: z.uuid().nullable(),
    })
    .parse({ id, status, beforeId, afterId });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_task", {
    p_task_id: parsed.id,
    p_status: parsed.status,
    p_before_id: parsed.beforeId ?? undefined,
    p_after_id: parsed.afterId ?? undefined,
  });
  if (error) throw new Error("Não foi possível mover a tarefa.");
  refresh();
}

export async function deleteTask(id: string) {
  const taskId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error("Não foi possível excluir a tarefa.");
  refresh();
}

export async function archiveDoneTasks(): Promise<number> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("status", "done")
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error("Não foi possível arquivar.");
  refresh();
  return data.length;
}

export async function saveProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["id", "name", "description", "context", "status", "due_on"]);
  const parsed = projectInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { error } = id
    ? await supabase.from("projects").update(values).eq("id", id)
    : await supabase.from("projects").insert({ ...values, user_id: user.id });
  if (error) return { status: "error", message: "Não foi possível salvar o projeto.", values: raw };

  refresh();
  return { status: "saved", message: id ? "Projeto atualizado." : "Projeto criado." };
}

export async function deleteProject(id: string) {
  const projectId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error("Não foi possível excluir o projeto.");
  refresh();
}
