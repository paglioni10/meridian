"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contributionInputSchema, goalInputSchema } from "./schema";

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

export async function saveGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, [
    "id",
    "title",
    "description",
    "horizon",
    "context",
    "target_cents",
    "target_date",
    "milestones",
  ]);
  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id, milestones, ...values } = parsed.data;

  if (id) {
    const { error } = await supabase.from("goals").update(values).eq("id", id);
    if (error) return { status: "error", message: "Não foi possível salvar o objetivo.", values: raw };
  } else {
    const { data: last } = await supabase
      .from("goals")
      .select("position")
      .eq("horizon", values.horizon)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: goal, error } = await supabase
      .from("goals")
      .insert({ ...values, user_id: user.id, position: (last?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (error) return { status: "error", message: "Não foi possível criar o objetivo.", values: raw };
    if (milestones.length > 0) {
      const { error: msError } = await supabase
        .from("goal_milestones")
        .insert(
          milestones.map((title, position) => ({ user_id: user.id, goal_id: goal.id, title, position })),
        );
      if (msError)
        return { status: "error", message: "Objetivo criado, mas os marcos falharam.", values: raw };
    }
  }

  refresh();
  return { status: "saved", message: id ? "Objetivo atualizado." : "Objetivo criado." };
}

export async function deleteGoal(id: string) {
  const goalId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw new Error("Não foi possível excluir o objetivo.");
  refresh();
}

export async function setGoalStatus(id: string, status: string) {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["active", "paused", "achieved", "archived"]) })
    .parse({ id, status });
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      status: parsed.status,
      achieved_at: parsed.status === "achieved" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.id);
  if (error) throw new Error("Não foi possível mudar o status.");
  refresh();
}

export async function moveGoal(id: string, direction: "up" | "down") {
  const goalId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("goals")
    .select("id, horizon, position")
    .eq("id", goalId)
    .single();
  if (!goal) throw new Error("Objetivo não encontrado.");
  const { data: siblings } = await supabase
    .from("goals")
    .select("id, position")
    .eq("horizon", goal.horizon)
    .in("status", ["active", "paused"])
    .order("position")
    .order("created_at");
  const list = siblings ?? [];
  const index = list.findIndex((g) => g.id === goalId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= list.length) return;
  const reordered = [...list];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
  for (const [position, item] of reordered.entries()) {
    if (item.position !== position) await supabase.from("goals").update({ position }).eq("id", item.id);
  }
  refresh();
}

export async function addContribution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = collect(formData, ["goal_id", "direction", "amount_cents", "contributed_on", "note"]);
  const parsed = contributionInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues, raw);

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { direction, amount_cents, ...values } = parsed.data;
  const { error } = await supabase.from("goal_contributions").insert({
    ...values,
    user_id: user.id,
    amount_cents: direction === "withdraw" ? -amount_cents : amount_cents,
  });
  if (error?.code === "23514") {
    return {
      status: "error",
      message: "Retirada maior que o guardado.",
      fieldErrors: { amount_cents: "A retirada passa do valor guardado neste objetivo" },
      values: raw,
    };
  }
  if (error) return { status: "error", message: "Não foi possível registrar.", values: raw };

  refresh();
  return {
    status: "saved",
    message: direction === "withdraw" ? "Retirada registrada." : "Aporte registrado.",
  };
}

export async function deleteContribution(id: string) {
  const contributionId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("goal_contributions").delete().eq("id", contributionId);
  if (error) throw new Error("Não foi possível excluir o aporte.");
  refresh();
}

export async function addMilestone(goalId: string, title: string) {
  const parsed = z
    .object({ goalId: z.uuid(), title: z.string().trim().min(1).max(80) })
    .parse({ goalId, title });
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("goal_milestones")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", parsed.goalId);
  const { error } = await supabase
    .from("goal_milestones")
    .insert({ user_id: user.id, goal_id: parsed.goalId, title: parsed.title, position: count ?? 0 });
  if (error) throw new Error("Não foi possível adicionar o marco.");
  refresh();
}

export async function toggleMilestone(id: string, done: boolean) {
  const milestoneId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("goal_milestones")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", milestoneId);
  if (error) throw new Error("Não foi possível atualizar o marco.");
  refresh();
}

export async function deleteMilestone(id: string) {
  const milestoneId = z.uuid().parse(id);
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("goal_milestones").delete().eq("id", milestoneId);
  if (error) throw new Error("Não foi possível excluir o marco.");
  refresh();
}
